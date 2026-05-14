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

# These keywords trigger a field-fetch lookup — but ONLY during intake (missing fields exist).
# Once all fields are collected the AI handles everything; fetch keywords become ambiguous.
FETCH_KEYWORDS = {
    "name":                ["name", "i am", "my name"],
    "age":                 ["age", "year old"],
    "policy_type":         ["policy type", "type of policy", "which policy", "what policy"],
    "premium":             ["premium", "monthly payment", "payment", "cost", "how much do i pay"],
    "benefit_amount":      ["benefit", "amount", "coverage", "vimo", "how much covered"],
    "elimination_period":  ["elimination", "waiting period", "period"],
    "inflation_protection":["inflation", "inflation protection"],
}

RESET_KEYWORDS = [
    "new form", "start over", "start fresh", "reset", "new intake",
    "start new", "clear my data", "begin again", "start again",
]

ANALYZE_KEYWORDS = [
    "analyze", "analyse", "analysis", "decision", "should i keep",
    "keep or sell", "keep or lapse", "what should i do", "recommend",
]

REPORT_KNOWLEDGE = """

   TELL US THE ODDS — LTC ACTUARIAL KNOWLEDGE BASE
   Source: Official Sample Report, Tell Us The Odds LLC © 2026

1. CLAIM PROBABILITY  (How likely is a claim?)

Overall: Only 41% of LTC policyholders ever file a claim.

Breakdown by duration:
  • No claim at all       → 59% of people
  • Claim up to 1 year    → 14%
  • Claim 1 to 2 years    → 9%
  • Claim 2 to 3 years    → 6%
  • Claim 3 to 4 years    → 4%
  • Claim 4 to 5 years    → 3%
  • Claim more than 5 yrs → 5%

Key insight: Most people (59%) never need to use their LTC policy.
Among those who do claim, the majority (14%) need care for less than 1 year.

2. CLAIM DURATION BY AGE  (How long does care last?)

If claim starts at age 71-74 (younger):
  • 75th percentile: ~7.5 years of care
  • 50th percentile: ~4.5 years of care
  • Median (50th):   ~2 years of care

If claim starts at age 85-90:
  • 75th percentile: ~5 years of care
  • 50th percentile: ~3.5 years of care
  • Median:          ~1.5 years of care

If claim starts at age 95-100:
  • 75th percentile: ~4 years of care
  • 50th percentile: ~2.5 years of care
  • Median:          ~1.2 years of care

Key insight: Starting a claim younger = longer care duration needed.

3. RISK COMPARISON  (Death vs. LTC need)

Annual probability by age:
  Age 71: Death ~0.5%,   LTC ~0.4%
  Age 75: Death ~1.2%,   LTC ~1.0%
  Age 79: Death ~2.5%,   LTC ~2.3%   (nearly equal)
  Age 83: Death ~4.5%,   LTC ~4.0%
  Age 87: Death ~7.0%,   LTC ~6.0%
  Age 91: Death ~10%,    LTC ~8%
  Age 95: Death ~14%,    LTC ~9%

Key insight: Between ages 79-83, risk of needing LTC is almost equal to risk of death.

4. MOST LIKELY CLAIM SCENARIOS

Highest probability (Top 10%) scenarios cluster at:
  • Age at claim start: 80 to 93 years old
  • Duration: 1 to 2 years of care

5. BENEFIT / COST RATIO  (Is the policy worth paying for?)

Formula: Value of expected benefits ÷ Total premiums paid = Ratio

  Option 1 — Keep as-is:               Ratio: 149% ✅ BEST VALUE
  Option 2 — Reduced daily benefit:     Ratio: 140%
  Option 3 — Reduced benefit period:    Ratio: 132%
  Option 4 — Longer elimination period: Ratio: 88%  ❌ ONLY BELOW 100%
  Option 5 — Reduced paid-up:           Ratio: N/A  (no ongoing cost)

Key insight: Option 1 (keep current) delivers the BEST ratio.
Increasing the elimination period drastically reduces value.

6. WHAT IS "ELIMINATION PERIOD"?

Number of days you pay for your own care BEFORE insurance starts paying.
  • 30-day → Fastest coverage
  • 60-day → Moderate wait
  • 90-day → Most common
  • 180-day → Very long wait, reduces value significantly

7. WHAT IS "INFLATION PROTECTION"?

  • None        → Benefit stays fixed; loses real value each year
  • 3% compound → Benefit doubles in ~24 years
  • 5% compound → Benefit doubles in ~14 years (strongest)
  • CPI-linked  → Grows with inflation index

Key insight: Without inflation protection, a $5,000/month benefit today
may only cover half the cost of care in 15-20 years.

8. POLICY TYPES EXPLAINED

  • Traditional         → Pure LTC. No cash value. Lowest premiums.
  • Hybrid              → LTC + life insurance. Has cash/death benefit.
  • Annuity             → Lump-sum funded, generates LTC income stream.
  • Chronic illness rider → Add-on to life policy. Cheaper but less flexible.

DISCLAIMER: Educational information only — not financial, legal, or insurance advice.
"""

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

        validation_rules = {
            "age": "Must be between 18 and 100.",
            "premium": "Monthly premium is typically $50–$2,000/mo. If above $2,000 or below $10, ask for clarification.",
            "benefit_amount": "Typically $1,000–$15,000/mo or $50–$500/day. If above $20,000, confirm daily vs monthly.",
            "elimination_period": "Must be one of: 30 days, 60 days, 90 days, 180 days.",
            "inflation_protection": "Must be one of: None, 3% compound, 5% compound, CPI-linked.",
            "policy_type": "Must be one of: Traditional, Hybrid, Annuity, Chronic illness rider.",
            "name": "Must be a real person's name (2+ characters, letters only).",
        }

        validation_hint = validation_rules.get(next_field, "")

        return f"""You are a professional Policy Intake Assistant for long-term care insurance at Tell Us The Odds℠.

{REPORT_KNOWLEDGE}

CURRENT INTAKE SESSION
Progress: {filled}/{len(REQUIRED_FIELDS)} fields completed.
Currently collecting: {next_label}

The user said: "{user_text}"

VALIDATION RULE for {next_label}: {validation_hint}

INSTRUCTIONS:
1. If the user asks ANY question about LTC insurance, claim probability, benefit/cost ratios,
   elimination period, inflation protection, or policy types — answer it FIRST using the
   KNOWLEDGE BASE above, then return to collecting {next_label}.
2. If the user is providing their policy data, validate it using the VALIDATION RULE above.
3. If the value seems wrong or unusual, do NOT save it — ask a clarifying question.
4. If the value is valid, confirm it briefly (1 line) and save using EXACTLY this format:
   SAVING: {{"{next_field}": "extracted_value"}}
5. After SAVING, ALWAYS ask for the next field on a new line.
6. Keep responses concise and professional.
7. Always be warm and helpful — you represent Tell Us The Odds℠.
8. NEVER mention any tabs, panels, or UI buttons. Everything happens through this chat."""

    else:
        summary = "\n".join([
            f"  • {FIELD_LABELS.get(k, k)}: {v}"
            for k, v in current_data.items() if v
        ])

        age = int(current_data.get("age", 0) or 0)
        inflation = current_data.get("inflation_protection", "None")
        elim = current_data.get("elimination_period", "90 days")

        personalized = []
        if age:
            elim_match = re.search(r'\d+', elim)
            elim_days = int(elim_match.group()) if elim_match else 90

            if age < 75:
                personalized.append(
                    f"At age {age}, their LTC risk is still relatively low (~{max(0.4, round((age-70)*0.25, 1))}%/year), "
                    f"but keeping coverage now locks in lower premiums for decades of protection ahead."
                )
            elif age <= 83:
                personalized.append(
                    f"At age {age}, death risk and LTC risk are nearly equal — "
                    f"this is a critical window where LTC coverage provides real protection."
                )
            else:
                personalized.append(
                    f"At age {age}, LTC risk is significant (~{min(9, round((age-70)*0.3, 1))}%/year). "
                    f"The most common claim scenario for this age group is 1-2 years of care."
                )

            if elim_days == 180:
                personalized.append(
                    "Their 180-day elimination period is the longest available — similar to Option 4 "
                    "in the benefit/cost analysis, where premiums can exceed expected benefits (88% ratio)."
                )
            elif elim_days <= 30:
                personalized.append(
                    "Their 30-day elimination period gives fast coverage — similar to Option 1's strong 149% ratio."
                )

            if inflation == "None":
                personalized.append(
                    "No inflation protection means their benefit amount stays fixed. "
                    "LTC costs typically rise 3-5% per year, eroding real coverage value significantly."
                )
            elif "5%" in inflation:
                personalized.append(
                    "Their 5% compound inflation protection is the strongest available — "
                    "benefit doubles every ~14 years, keeping pace with rising care costs."
                )

        personalized_text = "\n".join(f"  → {p}" for p in personalized) if personalized else ""

        return f"""You are a professional Policy Analyst at Tell Us The Odds℠.
The user's policy intake form is COMPLETE. Answer their questions using their personal
policy data AND the actuarial knowledge base below.

{REPORT_KNOWLEDGE}

USER'S POLICY DATA (collected):
{summary}

PERSONALIZED INSIGHTS FOR THIS USER:
{personalized_text}

The user said: "{user_text}"

INSTRUCTIONS:
1. Answer using the KNOWLEDGE BASE and their personal policy data. Always personalize —
   reference their specific age, premium, benefit amount, etc.
2. If they ask about claim probability, use their age to give a specific estimate.
3. If they ask about benefit/cost, relate it to their actual premium and benefit amount.
4. If they ask "should I keep my policy?" or request analysis, give the Keep/Lapse/Sell
   framework directly in your response — do NOT tell them to go to any tab or panel.
5. If they ask about risk, use the death vs LTC data from the knowledge base.
6. Keep responses clear, warm, and educational — not financial advice.
7. Always add: "This is educational guidance only — please consult a licensed advisor."
8. NEVER mention any tabs, panels, buttons, or UI elements. Everything is through this chat.
9. If they ask to start a new form or reset, tell them to type "start new form" to begin fresh."""


def _is_intake_in_progress(session_id: str, db: Session) -> bool:
    """
    Returns True if the session still has missing required fields.
    Used to guard fetch-keyword detection — we only run field-fetch
    logic during active intake, not once all fields are collected.
    """
    policy = crud.get_policy(db, session_id)
    if not policy:
        return True  # No policy at all — intake hasn't started
    current_data = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}
    missing = [f for f in REQUIRED_FIELDS if f not in current_data]
    return len(missing) > 0


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


def _answer_from_policy(policy, field_key: str) -> str:
    if field_key == "__all__":
        lines = [
            f"• **{FIELD_LABELS.get(k, k)}**: {getattr(policy, k)}"
            for k in REQUIRED_FIELDS if getattr(policy, k, None)
        ]
        if not lines:
            return "Your policy form is empty. Let's fill it in — what is your full name?"
        return "Here are all your saved policy details:\n\n" + "\n".join(lines)

    val = getattr(policy, field_key, None)
    label = FIELD_LABELS.get(field_key, field_key)
    if val:
        return f"Your **{label}** is: **{val}**"
    return f"I don't have your **{label}** yet. Could you share it?"


def _format_analysis_as_text(analysis: dict) -> str:
    """Convert the decision analysis dict into a readable chat message."""
    rec = analysis.get("recommended", "keep")
    final = analysis.get("final_answer", "")
    opts = analysis.get("options", {})
    disclaimer = analysis.get("disclaimer", "")

    lines = [f"**📊 Policy Decision Analysis**\n", f"**{final}**\n"]

    labels = {"keep": "✅ Stay Protected", "lapse": "⛔ Stop & Walk Away", "sell": "💰 Cash Out"}

    for key in ["keep", "lapse", "sell"]:
        opt = opts.get(key)
        if not opt:
            continue
        is_rec = key == rec
        star = " ⭐ RECOMMENDED" if is_rec else ""
        lines.append(f"**{labels[key]}{star}** — Score: {opt['score']}/100")
        lines.append(f"_{opt['summary']}_")
        for p in opt.get("pros", []):
            lines.append(f"  + {p}")
        for c in opt.get("cons", []):
            lines.append(f"  − {c}")
        lines.append("")

    lines.append(f"_{disclaimer}_")
    return "\n".join(lines)


def handle_reset_request(user_text: str, session_id: str, db: Session) -> str | None:
    text_lower = user_text.lower()
    if any(kw in text_lower for kw in RESET_KEYWORDS):
        new_version = crud.archive_and_new_version(db, session_id)
        return (
            f"✅ Your previous data has been saved to history (now archived).\n\n"
            f"A new blank form (version {new_version}) has been started!\n\n"
            "Let's begin — what is your **full name**?"
        )
    return None


def handle_analyze_request(user_text: str, session_id: str, db: Session) -> str | None:
    text_lower = user_text.lower()
    if not any(kw in text_lower for kw in ANALYZE_KEYWORDS):
        return None

    policy = crud.get_policy(db, session_id)
    if not policy:
        return "I don't have your policy details yet. Let's start your intake — what is your **full name**?"

    current_data = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}
    missing = [f for f in REQUIRED_FIELDS if f not in current_data]

    if missing:
        missing_labels = ", ".join(FIELD_LABELS[f] for f in missing)
        return (
            f"I need a few more details before I can analyze your policy.\n\n"
            f"Still needed: **{missing_labels}**\n\n"
            f"Could you share your **{FIELD_LABELS[missing[0]]}**?"
        )

    analysis = generate_decision_analysis(current_data)
    return _format_analysis_as_text(analysis)


def handle_fetch_request(user_text: str, session_id: str, db: Session) -> str | None:
    """
    Handle field-lookup requests. This is guarded so it only runs during active
    intake (while fields are still missing). Once the form is complete, keyword
    collisions (e.g. the user asking a general question containing "age" or
    "premium") are handed off to the AI instead of wrongly triggering a fetch.
    """
    text_lower = user_text.lower()

    # --- Handle pending name lookup (cross-session restore) ---
    if session_id in _pending_name_request:
        pending = _pending_name_request.pop(session_id)
        entered_name = user_text.strip()

        existing = crud.find_policy_by_name(db, entered_name)
        if existing:
            data = {k: getattr(existing, k) for k in REQUIRED_FIELDS if getattr(existing, k, None)}
            crud.upsert_policy(db, session_id, data)
            policy = crud.get_policy(db, session_id)
            answer = _answer_from_policy(policy, pending["field_key"])
            return f"Welcome back **{entered_name}**! I found your records.\n\n{answer}"
        else:
            return (
                f"I couldn't find any records for **{entered_name}**. "
                "Let's start fresh — what is your full name to begin your intake?"
            )

    # "Show all my details" is always valid regardless of intake state
    if any(w in text_lower for w in [
        "show all", "all details", "all data",
        "everything", "full details", "badhu batavo", "my details", "my information",
    ]):
        policy = crud.get_policy(db, session_id)
        if policy:
            return _answer_from_policy(policy, "__all__")
        return "Your policy form is empty. Let's fill it in — what is your **full name**?"

    # --- Guard: only run keyword-based fetch during active intake ---
    if not _is_intake_in_progress(session_id, db):
        # Form is complete — let the AI handle all conversation naturally
        return None

    field_key = _detect_fetch_field(text_lower)

    if field_key is None:
        name_match = re.search(r"(?:my name is|i am|iam|this is)\s+([a-zA-Z\s]+)", text_lower)
        if name_match:
            extracted_name = name_match.group(1).strip()
            existing = crud.find_policy_by_name(db, extracted_name)
            if existing and existing.session_id != session_id:
                data = {k: getattr(existing, k) for k in REQUIRED_FIELDS if getattr(existing, k, None)}
                crud.upsert_policy(db, session_id, data)
                return (
                    f"Welcome back **{extracted_name}**! "
                    "I found your previous records and restored your data."
                )
        return None

    policy = crud.get_policy(db, session_id)
    if policy:
        return _answer_from_policy(policy, field_key)

    _pending_name_request[session_id] = {"field_key": field_key, "original_query": user_text}
    return (
        "I don't have your details on file yet. "
        "Could you please tell me your **full name** so I can look up your records?"
    )


def get_ai_intake_response(user_text: str, session_id: str, db: Session) -> str:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    policy = crud.get_policy(db, session_id)
    current_data = {}
    if policy:
        current_data = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}

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
            max_tokens=700,
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
                crud.upsert_active_policy(db, session_id, data_to_save)
                print(f"[PolicyForm] Saved to MySQL: {list(data_to_save.keys())}")

        policy = crud.get_policy(db, session_id)
        current_data = {}
        if policy:
            current_data = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}
        missing_fields = [f for f in REQUIRED_FIELDS if f not in current_data]

        if not clean_msg:
            clean_msg = "Got it!"

        if missing_fields:
            next_label = FIELD_LABELS[missing_fields[0]]
            filled = len(REQUIRED_FIELDS) - len(missing_fields)
            clean_msg += f"\n\n({filled}/{len(REQUIRED_FIELDS)} complete) Could you please share your **{next_label}**?"
        else:
            clean_msg += (
                "\n\n✅ **All details collected!**\n\n"
                "You can now:\n"
                "• Type **\"analyze my policy\"** for a Keep / Lapse / Sell recommendation\n"
                "• Ask any question about your coverage\n"
                "• Type **\"show all my details\"** to review what's saved\n"
                "• Type **\"start new form\"** to begin a fresh intake"
            )

        return clean_msg

    except Exception as e:
        print(f"[PolicyForm] Parse error: {e}")
        return raw_response.split("SAVING:")[0].strip()


def save_and_get_bot_response(user_text: str, session_id: str, db: Session) -> ChatMessage:
    crud.save_message(db, session_id, "user", user_text)

    # Priority order: reset → analyze → fetch → AI
    bot_text = (
        handle_reset_request(user_text, session_id, db)
        or handle_analyze_request(user_text, session_id, db)
        or handle_fetch_request(user_text, session_id, db)
    )

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
    elif 65 <= age < 75:
        keep_score -= 5
        keep_cons.append("Review whether premiums remain affordable as you age")
    elif 75 <= age < 80:
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

    if premium < 50:
        lapse_score = max(0, lapse_score - 25)
        sell_score  = max(0, sell_score - 15)

    if age >= 85 and benefit < 2000:
        sell_score = max(0, sell_score - 20)

    scores      = {"keep": keep_score, "lapse": lapse_score, "sell": sell_score}
    recommended = max(scores, key=scores.get)

    option_labels = {
        "keep":  "Stay Protected",
        "lapse": "Stop & Walk Away",
        "sell":  "Cash Out",
    }

    final_answer = {
        "keep":  "Stay Protected is the best choice. Your coverage remains active and still offers value.",
        "lapse": "Stop & Walk Away is the best choice. Your premium is relatively high and the policy may no longer be cost-effective.",
        "sell":  "Cash Out is the best choice. Your policy is likely attractive to buyers and can free up a lump sum now.",
    }[recommended]

    return {
        "recommended":          recommended,
        "recommendation_label": option_labels[recommended],
        "final_answer":         final_answer,
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