import json
import asyncio
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, get_db
from app.db import crud
from app.api.websocket_manager import manager
from app.service.chat_service import save_and_get_bot_response,generate_decision_analysis

router = APIRouter()

REQUIRED_FIELDS = [
    "name", "age", "policy_type", "premium",
    "benefit_amount", "elimination_period", "inflation_protection",
]

@router.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket, session_id: str = None):
    sid = session_id or f"session_{int(datetime.now().timestamp() * 1000)}"
    await manager.connect(websocket, sid)

    db: Session = SessionLocal()
    try:
        crud.create_or_update_session(db, sid, connected=True)

        try:
            history = crud.get_history(db, sid, limit=50)
            if history:
                await websocket.send_text(json.dumps({
                    "type": "history",
                    "messages": [
                        {
                            "sender":     m.sender,
                            "content":    m.content,
                            "created_at": m.created_at.isoformat(),
                        }
                        for m in history
                    ]
                }))
        except Exception as e:
            print(f"[WS] History load error: {e}")

        while True:
            try:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                user_text = msg.get("text", "").strip()
                if not user_text:
                    continue

                asyncio.create_task(manager.set_typing(websocket, True))

                loop = asyncio.get_event_loop()
                bot_msg = await loop.run_in_executor(
                    None, save_and_get_bot_response, user_text, sid, db
                )

                asyncio.create_task(manager.set_typing(websocket, False))

                await websocket.send_text(json.dumps({
                    "type":       "bot",
                    "text":       bot_msg.content,
                    "timestamp":  datetime.now().strftime("%I:%M %p"),
                    "session_id": sid,
                }))

            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"[WS] Error: {e}")
                break

    finally:
        manager.disconnect(websocket)
        try:
            crud.create_or_update_session(db, sid, connected=False)
        except Exception:
            pass
        db.close()

@router.get("/policy/{session_id}")
def get_policy(session_id: str, db: Session = Depends(get_db)):
    policy = crud.get_active_policy(db, session_id)
    if not policy:
        return JSONResponse(status_code=404, content={"error": "No policy data found"})

    data    = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}
    missing = [f for f in REQUIRED_FIELDS if not getattr(policy, f, None)]
    return {
        "session_id":     session_id,
        "policy_data":    data,
        "complete":       len(missing) == 0,
        "missing_fields": missing,
        "filled_count":   len(REQUIRED_FIELDS) - len(missing),
        "total_fields":   len(REQUIRED_FIELDS),
        "version":        policy.version,
    }

@router.get("/policy/{session_id}/versions/all")
def get_all_versions(session_id: str, db: Session = Depends(get_db)):
    """
    Returns all policy versions for this session, newest first.
    Active version is marked with is_active=True.
    """
    versions = crud.get_all_policy_versions(db, session_id)
    if not versions:
        return JSONResponse(status_code=404, content={"error": "No policies found"})

    result = []
    for p in versions:
        data = {k: getattr(p, k) for k in REQUIRED_FIELDS if getattr(p, k, None)}
        missing = [f for f in REQUIRED_FIELDS if not getattr(p, f, None)]
        result.append({
            "version":        p.version,
            "is_active":      p.is_active,
            "policy_data":    data,
            "complete":       len(missing) == 0,
            "missing_fields": missing,
            "filled_count":   len(REQUIRED_FIELDS) - len(missing),
            "created_at":     p.created_at.isoformat() if p.created_at else None,
        })

    return {"session_id": session_id, "versions": result}

@router.get("/policy/{session_id}/decision")
def get_decision(session_id: str, db: Session = Depends(get_db)):
    policy = crud.get_active_policy(db, session_id)
    if not policy:
        return JSONResponse(status_code=404, content={"error": "No policy found"})

    data = {k: getattr(policy, k) for k in REQUIRED_FIELDS if getattr(policy, k, None)}
    missing = [f for f in REQUIRED_FIELDS if not getattr(policy, f, None)]

    if missing:
        return JSONResponse(status_code=400, content={
            "error": "Policy incomplete",
            "missing_fields": missing
        })

    result = generate_decision_analysis(data)
    return result


@router.get("/policy/{session_id}/{field_key}")
def get_policy_field(session_id: str, field_key: str, db: Session = Depends(get_db)):
    policy = crud.get_active_policy(db, session_id)
    if not policy:
        return JSONResponse(status_code=404, content={"found": False, "value": None})
    val = getattr(policy, field_key, None)
    return {"session_id": session_id, "field": field_key, "found": val is not None, "value": val}


class FieldSaveRequest(BaseModel):
    field: str
    value: str

@router.post("/policy/{session_id}/field")
def save_policy_field(
    session_id: str,
    body: FieldSaveRequest,
    db: Session = Depends(get_db),
):
    if body.field not in REQUIRED_FIELDS:
        return JSONResponse(status_code=400, content={"error": f"Unknown field: {body.field}"})

    value = body.value.strip()
    if not value:
        return JSONResponse(status_code=400, content={"error": "Value cannot be empty"})

    crud.upsert_active_policy(db, session_id, {body.field: value})

    crud.save_message(
        db, session_id, "system",
        f"[User filled '{body.field}' directly from My Policy tab: {value}]"
    )

    return {"success": True, "session_id": session_id, "field": body.field, "value": value}

@router.post("/policy/{session_id}/reset")
def reset_policy(session_id: str, db: Session = Depends(get_db)):
    """
    Does NOT delete anything.
    Marks current policy version as archived and creates a new blank version.
    """
    new_version = crud.archive_and_new_version(db, session_id)
    return {
        "success":     True,
        "message":     "Previous policy archived. New form started.",
        "new_version": new_version,
    }

@router.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}
