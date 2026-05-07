import os
import re
import json
from datetime import datetime
from dataclasses import dataclass
from groq import Groq
from sqlalchemy.orm import Session
from app.db import crud

REQUIRED_FIELDS = [
    "name", "age", "policy_type", "premium",
    "benefit_amount", "elimination_period", "inflation_protection",
]

FIELD_LABELS = {
    "name":                 "Full Name",
    "age":                  "Age",
    "policy_type":          "Policy Type (Traditional / Hybrid / Annuity / Chronic illness rider)",
    "premium":              "Monthly Premium ($)",
    "benefit_amount":       "Daily/Monthly Benefit Amount ($)",
    "elimination_period":   "Elimination Period (days: 30 / 60 / 90 / 180)",
    "inflation_protection": "Inflation Protection (None / 3% compound / 5% compound / CPI-linked)",
}

FETCH_KEYWORDS = {
    "name":                ["name", "i am", "my name"],
    "age":                 ["age", "year old"],
    "policy_type":         ["policy type", "type of policy", "which policy", "what policy"],
    "premium":             ["premium", "monthly payment", "payment", "cost", "how much do i pay"],
    "benefit_amount":      ["benefit", "amount", "coverage", "vimo", "how much covered"],
    "elimination_period":  ["elimination", "waiting period", "period"],
    "inflation_protection":["inflation", "inflation protection"],
}
_pending_name_request: dict[str, dict] = {}

@dataclass
class ChatMessage:
    sender:     str
    content:    str
    created_at: datetime
    db_id:      int = 0

def _build_system_prompt(user_text: str, current_data: dict, missing_fields: list) -> str:
    if missing_fields:
        next_field = missing_fields[0]
        next_label = FIELD_LABELS[next_field]
        filled = len(REQUIRED_FIELDS) - len(missing_fields)

        # Field-specific validation hints for AI
        validation_rules = {
            "age": "Must be between 18 and 100. If user gives something outside this range, reject it and ask again.",
            "premium": "Monthly premium for LTC insurance is typically 50 to 2,000/month. If user gives a value above $2,000 or below $10, ask: 'That seems unusual — is that your monthly amount, or could it be annual? Typical monthly premiums range from $50 to $1,500.'",
            "benefit_amount": "Daily/Monthly benefit amount is typically $1,000 to $15,000/month or $50 to $500/day. If user gives a value above $20,000, ask: 'Just to confirm — is that your daily or monthly benefit amount? Typical monthly benefits range from $1,000 to $15,000.'",
            "elimination_period": "Must be one of: 30 days, 60 days, 90 days, 180 days. If user gives something else, ask them to choose one of these options.",
            "inflation_protection": "Must be one of: None, 3% compound, 5% compound, CPI-linked. If user gives something else, ask them to choose one of these.",
            "policy_type": "Must be one of: Traditional, Hybrid, Annuity, Chronic illness rider. If user gives something else, ask them to choose one of these.",
            "name": "Must be a real person's name (2+ characters, letters only). Reject numbers or gibberish.",
        }

        validation_hint = validation_rules.get(next_field, "")

        return f"""You are a professional Policy Intake Assistant for long-term care insurance.
Progress: {filled}/{len(REQUIRED_FIELDS)} fields completed.
Currently collecting: {next_label}

The user said: "{user_text}"

VALIDATION RULE for {next_label}: {validation_hint}

INSTRUCTIONS:
1. First, validate the user's input using the VALIDATION RULE above.
2. If the value seems wrong or unusual, do NOT save it. Instead ask a clarifying question.
3. If the value is valid, confirm it briefly (1 line) and save using EXACTLY this format:
   SAVING: {{"{next_field}": "extracted_value"}}
4. After SAVING line, ALWAYS ask for the next field on a new line.
5. If user asks a question, answer it first, then ask for {next_label}.
6. Keep responses concise and professional."""

    else:
        summary = "\n".join([
            f"• {FIELD_LABELS.get(k, k)}: {v}"
            for k, v in current_data.items() if v
        ])
        return f"""You are a professional Policy Intake Assistant for long-term care insurance.
All fields are complete! Here is the collected data:
{summary}

The user said: "{user_text}"

INSTRUCTIONS:
1. Inform the user their policy form is complete.
2. Answer any questions they have about their policy.
3. Suggest they check the 'My Policy' tab to review or analyze their data.
4. Keep responses concise and professional."""


def _detect_fetch_field(text_lower: str) -> str | None:
    if any(w in text_lower for w in [
        "show all", "all details", "all data",
        "everything", "full details", "badhu batavo", "my details", "my information",
    ]):
        return "__all__"

    for field_key, keywords in FETCH_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return field_key

    return None

def _answer_from_policy(policy,field_key:str)->str:
    if field_key=="__all__":
        lines=[
            f"• **{FIELD_LABELS.get(k,k)}** :{getattr(policy,k)}"
            for k in REQUIRED_FIELDS if getattr(policy,k,None)                
        ]
        if not lines:
            return "Your policy form is empty. fill it in — what is full name?"
        return "here are all your saved policy details:\n\n" + "\n".join(lines)
    
    val = getattr(policy,field_key,None)
    label=FIELD_LABELS.get(field_key,field_key)
    if val:
        return f"Your **{label}** is: **{val}**"
    return f"I don't have your **{label}** yet.could you share it?"

def handle_fetch_request(user_text: str, session_id: str, db: Session) -> str | None:
    text_lower = user_text.lower()

    if session_id in _pending_name_request:
        pending = _pending_name_request.pop(session_id)  
        entered_name = user_text.strip()

        existing = crud.find_policy_by_name(db, entered_name)
        if existing:
            # Restore found policy into current session
            data = {
                k: getattr(existing, k)
                for k in REQUIRED_FIELDS if getattr(existing, k, None)
            }
            crud.upsert_policy(db, session_id, data)

            # Answer the original question using restored data
            policy = crud.get_policy(db, session_id)
            answer = _answer_from_policy(policy, pending["field_key"])
            return f"Welcome back **{entered_name}**! I found your records.\n\n{answer}"
        else:
            return (
                f"I couldn't find any records for **{entered_name}**. "
                "Let's start fresh — what is your full name to begin your intake?"
            )

    field_key = _detect_fetch_field(text_lower)

    if field_key is None:
        # Not a fetch intent — handle cross-session name restore (e.g. "my name is John")
        name_match = re.search(
            r"(?:my name is|maru naam|i am|iam|this is)\s+([a-zA-Z\s]+)", text_lower
        )
        if name_match:
            extracted_name = name_match.group(1).strip()
            existing = crud.find_policy_by_name(db, extracted_name)
            if existing and existing.session_id != session_id:
                data = {
                    k: getattr(existing, k)
                    for k in REQUIRED_FIELDS if getattr(existing, k, None)
                }
                crud.upsert_policy(db, session_id, data)
                return (
                    f"Welcome back **{extracted_name}**! "
                    "I found your previous records and restored your data."
                )
        return None  # not a fetch intent — let AI handle it

    policy = crud.get_policy(db, session_id)
    if policy:
        # Session has data — answer directly, no name needed
        return _answer_from_policy(policy, field_key)

    _pending_name_request[session_id] = {
        "field_key":      field_key,
        "original_query": user_text,
    }
    return (
        "I don't have your details on file yet. "
        "Could you please tell me your **full name** so I can look up your records?"
    )
    
def get_ai_intake_response(user_text: str, session_id: str, db: Session) -> str:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    policy = crud.get_policy(db, session_id)
    current_data = {}
    if policy:
        current_data = {
            k: getattr(policy, k)
            for k in REQUIRED_FIELDS if getattr(policy, k, None)
        }

    missing_fields = [f for f in REQUIRED_FIELDS if f not in current_data]
    system_prompt = _build_system_prompt(user_text, current_data, missing_fields)

    try:
        completion = client.chat.completions.create(
            model="qwen/qwen3-32b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_text},
            ],
            temperature=0.4,
            max_tokens=512,
        )
        raw = completion.choices[0].message.content
        clean = re.sub(r'<think>[\s\S]*?<\/think>', '', raw, flags=re.IGNORECASE).strip()
        return clean

    except Exception as e:
        print(f"[AI] Groq error: {e}")
        next_label = (
            FIELD_LABELS.get(missing_fields[0], "next field")
            if missing_fields else "policy details"
        )
        return f"I'm having trouble right now. Could you please share your **{next_label}**?"

def parse_and_save(raw_response: str, session_id: str, db: Session) -> str:
    if "SAVING:" not in raw_response:
        return raw_response.strip()

    try:
        parts = raw_response.split("SAVING:", 1)
        clean_msg = parts[0].strip()
        raw_json = parts[1].strip().replace("'", '"')

        match = re.search(r'\{[^}]+\}', raw_json)
        if match:
            data_to_save = json.loads(match.group())
            data_to_save = {
                k: str(v).strip()
                for k, v in data_to_save.items()
                if k in REQUIRED_FIELDS and v
            }
            if data_to_save:
                crud.upsert_policy(db, session_id, data_to_save)
                print(f"[PolicyForm] Saved to MySQL: {list(data_to_save.keys())}")

        # Check what is still missing and ask next question
        policy = crud.get_policy(db, session_id)
        current_data = {}
        if policy:
            current_data = {
                k: getattr(policy, k)
                for k in REQUIRED_FIELDS if getattr(policy, k, None)
            }
        missing_fields = [f for f in REQUIRED_FIELDS if f not in current_data]

        if not clean_msg:
            clean_msg = "Got it!"

        if missing_fields:
            next_label = FIELD_LABELS[missing_fields[0]]
            filled = len(REQUIRED_FIELDS) - len(missing_fields)
            clean_msg += f"\n\n({filled}/{len(REQUIRED_FIELDS)} complete) Could you please share your **{next_label}**?"
        else:
            clean_msg += "\n\n All details collected! Head to the **My Policy** tab to review or **analyze** your policy."

        return clean_msg

    except Exception as e:
        print(f"[PolicyForm] Parse error: {e}")
        return raw_response.split("SAVING:")[0].strip()
    
def save_and_get_bot_response(
    user_text: str, session_id: str, db: Session
) -> ChatMessage:
    crud.save_message(db, session_id, "user", user_text)

    bot_text = handle_fetch_request(user_text, session_id, db)

    if not bot_text:
        raw_ai = get_ai_intake_response(user_text, session_id, db)
        bot_text = parse_and_save(raw_ai, session_id, db)

    saved = crud.save_message(db, session_id, "bot", bot_text)

    return ChatMessage(
        sender="bot",
        content=bot_text,
        created_at=saved.created_at,
        db_id=saved.id,
    )

# DECISION ANALYSIS ENGINE
def generate_decision_analysis(policy_data: dict) -> dict:
    age         = int(policy_data.get("age", 60))
    premium     = float(policy_data.get("premium", 0))
    benefit     = float(policy_data.get("benefit_amount", 0))
    elim_period = policy_data.get("elimination_period", "90 days")
    inflation   = policy_data.get("inflation_protection", "None")
    policy_type = policy_data.get("policy_type", "Traditional")

    elim_match = re.search(r'\d+', elim_period)
    elim_days  = int(elim_match.group()) if elim_match else 90

    inflation_good = inflation in ["3% compound", "5% compound", "CPI-linked"]
    is_hybrid      = policy_type in ["Hybrid", "Annuity"]
    breakeven_yrs  = (premium * 12) / max(benefit, 1)

    keep_score = 50
    keep_pros, keep_cons = [], []

    if inflation_good:
        keep_score += 15
        keep_pros.append(f"Your benefit grows over time ({inflation}) — keeps up with rising care costs")
    else:
        keep_cons.append("No inflation protection — your benefit loses real value as costs rise each year")

    if elim_days <= 60:
        keep_score += 8
        keep_pros.append(f"Short {elim_period} wait — coverage kicks in quickly when you need care")
    elif elim_days >= 180:
        keep_score -= 10
        keep_cons.append(f"Long {elim_period} wait — you pay all care costs yourself before benefits begin")

    if breakeven_yrs < 3:
        keep_score += 10
        keep_pros.append(f"Great value — after just {breakeven_yrs:.1f} years of care you've gotten your money's worth")
    elif breakeven_yrs > 6:
        keep_score -= 12
        keep_cons.append(f"High cost for the benefit — takes {breakeven_yrs:.1f} years of care to break even")

    if age < 65:
        keep_score += 10
        keep_pros.append("You're younger — more years of protection ahead, premiums are still manageable")
    elif age >= 65 and age < 75:
        keep_score -= 5
        keep_cons.append("Review whether premiums remain affordable as you age")
    elif age >= 75 and age < 80:
        keep_score -= 15
        keep_cons.append("At 75+, premiums often rise sharply — carefully review affordability")
    elif age >= 80:
        keep_score -= 25  
        keep_cons.append("At 80+, very few people claim benefits — premiums often outweigh what's received")

    if is_hybrid:
        keep_score += 8
        keep_pros.append(f"Your {policy_type} policy keeps value even if you never use care benefits")
    else:
        keep_cons.append("Traditional policy — if you stop paying, you lose everything paid so far")

    if premium > 600:
        keep_score -= 15
        keep_cons.append(f"Very high premium (${premium:.0f}/mo) is a heavy burden — worth reconsidering")
    elif premium > 400:
        keep_score -= 8
        keep_cons.append(f"High premium (${premium:.0f}/mo) — ensure it stays within your budget")

    lapse_score = 25
    lapse_pros, lapse_cons = [], []

    lapse_pros.append(f"Puts ${premium:.0f} back in your pocket every month — immediately")
    lapse_cons.append("You lose all premiums paid so far — no refund on standard policies")
    lapse_cons.append("Getting new coverage later will be much harder and more expensive")

    if premium > 600:
        lapse_score += 30
        lapse_pros.append(f"Very high premium (${premium:.0f}/mo) — stopping frees up major cash")
    elif premium > 400:
        lapse_score += 18
        lapse_pros.append(f"High premium (${premium:.0f}/mo) — stopping frees up significant cash")
    elif premium > 200:
        lapse_score += 8
        lapse_pros.append(f"Stopping saves ${premium:.0f} every month")

    if not inflation_good and age > 70:
        lapse_score += 12
        lapse_pros.append("Without inflation protection, future benefits may not actually cover real care costs")

    if age >= 80:
        lapse_score += 15
        lapse_pros.append("At 80+, alternatives like Medicaid planning may be more practical")
    elif age >= 75:
        lapse_score += 8
        lapse_pros.append("At this age, review whether keeping the policy still makes financial sense")

    if breakeven_yrs > 8:
        lapse_score += 12
        lapse_pros.append(f"Very high break-even ({breakeven_yrs:.1f} yrs) — premium may not be worth it")

    if is_hybrid:
        lapse_score -= 20
        lapse_cons.append(f"Your {policy_type} policy has real cash value — walking away means losing it")

    if elim_days <= 30:
        lapse_score -= 8
        lapse_cons.append("Your short elimination period is valuable — very hard to find in new policies")

    sell_score = 20
    sell_pros, sell_cons = [], []

    sell_pros.append("Get a lump-sum cash payment now — usually more than just cancelling the policy")
    sell_cons.append("May be taxable — talk to a tax advisor before accepting any offer")
    sell_cons.append("Offers vary widely — always compare multiple buyers before deciding")

    if age >= 80:
        sell_score += 35
        sell_pros.append("Age 80+ makes your policy highly attractive to settlement buyers")
    elif age >= 75:
        sell_score += 25
        sell_pros.append("Age 75+ makes your policy significantly more attractive to settlement buyers")
    elif age >= 70:
        sell_score += 15
        sell_pros.append("Age 70+ makes your policy more attractive to settlement buyers")

    if benefit >= 5000:
        sell_score += 20
        sell_pros.append(f"Very high benefit (${benefit:,.0f}/mo) makes your policy highly attractive to buyers")
    elif benefit >= 3000:
        sell_score += 12
        sell_pros.append(f"High benefit (${benefit:,.0f}/mo) increases settlement attractiveness")
    elif benefit >= 1500:
        sell_score += 5
        sell_pros.append(f"Your benefit amount (${benefit:,.0f}/mo) may attract some settlement buyers")

    if policy_type in ["Traditional", "Hybrid"]:
        sell_score += 10
        sell_pros.append(f"{policy_type} policies are accepted by most buyers in the settlement market")

    if premium > 400:
        sell_score += 10
        sell_pros.append("The buyer takes over your monthly payments — you stop paying immediately")
    elif premium > 200:
        sell_score += 5
        sell_pros.append("The buyer takes over your premium payments")

    if not inflation_good:
        sell_score -= 5
        sell_cons.append("No inflation protection slightly reduces what buyers will offer")

    keep_score  = max(0, min(100, keep_score))
    lapse_score = max(0, min(100, lapse_score))
    sell_score  = max(0, min(100, sell_score))

    scores      = {"keep": keep_score, "lapse": lapse_score, "sell": sell_score}
    recommended = max(scores, key=scores.get)

    # After existing score calculations, add this override logic before the final max():

# Low premium override — very cheap policy, lapsing saves almost nothing
    if premium < 50:
        lapse_score = max(0, lapse_score - 25)  
        sell_score = max(0, sell_score - 15)    

    # Age 88 + low benefit override
    if age >= 85 and benefit < 2000:
        sell_score = max(0, sell_score - 20)   

    option_labels = {
        "keep": "Stay Protected",
        "lapse": "Stop & Walk Away",
        "sell": "Cash Out",
    }

    final_answer = {
        "keep": f"Stay Protected is the best choice. Your coverage remains active and still offers value, especially with your current policy details.",
        "lapse": f"Stop & Walk Away is the best choice. Your premium is relatively high and the policy may no longer be cost-effective for you.",
        "sell": f"Cash Out is the best choice. Your policy is likely attractive to buyers and can free up a lump sum now.",
    }[recommended]

    return {
        "recommended": recommended,
        "recommendation_label": option_labels[recommended],
        "final_answer": final_answer,
        "options": {
            "keep": {
                "score":   keep_score,
                "label":   option_labels["keep"],
                "summary": f"Keep paying ${premium:.0f}/mo — your coverage stays fully active.",
                "pros":    keep_pros,
                "cons":    keep_cons,
            },
            "lapse": {
                "score":   lapse_score,
                "label":   option_labels["lapse"],
                "summary": "Stop paying premiums and give up your coverage.",
                "pros":    lapse_pros,
                "cons":    lapse_cons,
            },
            "sell": {
                "score":   sell_score,
                "label":   option_labels["sell"],
                "summary": "Sell your policy to a third party and receive a lump-sum payment.",
                "pros":    sell_pros,
                "cons":    sell_cons,
            },
        },
        "disclaimer": "This is educational guidance only — not financial or legal advice. Please consult a licensed advisor before making any decisions.",
    }
