# from sqlalchemy.orm import Session
# from app.models.chat import Session as SessionModel, ChatMessage, PolicyData  # ← use PolicyData
# from datetime import datetime
# from typing import Optional


# def create_or_update_session(db: Session, session_id: str, connected: bool):
#     session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
#     now = datetime.now()
#     if session:
#         session.is_connected = connected
#         session.last_active = now
#         if connected:
#             session.connected_at = now
#         else:
#             session.disconnected_at = now
#     else:
#         session = SessionModel(
#             session_id=session_id,
#             is_connected=connected,
#             connected_at=now if connected else None,
#         )
#         db.add(session)
#     db.commit()

# def save_message(db: Session, session_id: str, sender: str, content: str):
#     msg = ChatMessage(
#         session_id=session_id,
#         sender=sender,
#         content=content,
#         created_at=datetime.now(),
#         saved_at=datetime.now(),
#     )
#     db.add(msg)
#     db.commit()
#     db.refresh(msg)
#     return msg

# def get_history(db: Session, session_id: str, limit: int = 50):
#     return (
#         db.query(ChatMessage)
#         .filter(ChatMessage.session_id == session_id)
#         .order_by(ChatMessage.created_at.asc())
#         .limit(limit)
#         .all()
#     )

# def get_policy(db: Session, session_id: str) -> Optional[PolicyData]:
#     return (
#         db.query(PolicyData)
#         .filter(PolicyData.session_id == session_id, PolicyData.is_active == True)
#         .order_by(PolicyData.version.desc())
#         .first()
#     )


# def upsert_policy(db: Session, session_id: str, fields: dict):
#     policy = db.query(PolicyData).filter(PolicyData.session_id == session_id).first()
#     if policy:
#         for k, v in fields.items():
#             if hasattr(policy, k):
#                 setattr(policy, k, v)
#         policy.updated_at = datetime.now()
#     else:
#         policy = PolicyData(session_id=session_id, **fields)
#         db.add(policy)
#     db.commit()
#     return policy


# def delete_policy(db: Session, session_id: str):
#     db.query(PolicyData).filter(PolicyData.session_id == session_id).delete()
#     db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
#     db.commit()


# def find_policy_by_name(db: Session, name: str) -> Optional[PolicyData]:
#     return (
#         db.query(PolicyData)
#         .filter(PolicyData.name.ilike(name.strip()))
#         .first()
#     )


# def get_active_policy(db: Session, session_id: str) -> Optional[PolicyData]:
#     """Return the currently active (non-archived) policy for this session."""
#     return (
#         db.query(PolicyData)                                          # ✅ was: Policy
#         .filter(PolicyData.session_id == session_id, PolicyData.is_active == True)
#         .order_by(PolicyData.version.desc())
#         .first()
#     )


# def get_all_policy_versions(db: Session, session_id: str):
#     """Return ALL policy versions for this session, newest first."""
#     return (
#         db.query(PolicyData)                                       
#         .filter(PolicyData.session_id == session_id)
#         .order_by(PolicyData.version.desc())
#         .all()
#     )


# def upsert_active_policy(db: Session, session_id: str, data: dict) -> PolicyData:
#     """
#     Update fields on the active policy version.
#     If no active policy exists, create version 1.
#     """
#     policy = get_active_policy(db, session_id)
#     if not policy:
#         policy = PolicyData(                                     
#             session_id=session_id,
#             version=1,
#             is_active=True,
#             created_at=datetime.utcnow(),
#         )
#         db.add(policy)

#     for k, v in data.items():
#         setattr(policy, k, v)

#     db.commit()
#     db.refresh(policy)
#     return policy


# def archive_and_new_version(db: Session, session_id: str) -> int:
#     """
#     Soft-reset:
#     1. Mark the current active policy as archived (is_active=False).
#     2. Create a new blank policy with version = old_version + 1, is_active=True.
#     Returns the new version number.
#     """
#     current = get_active_policy(db, session_id)

#     if current:
#         current.is_active = False
#         db.commit()
#         new_version = current.version + 1
#     else:
#         new_version = 1

#     new_policy = PolicyData(                                          # ✅ was: Policy
#         session_id=session_id,
#         version=new_version,
#         is_active=True,
#         created_at=datetime.utcnow(),
#     )
#     db.add(new_policy)
#     db.commit()
#     db.refresh(new_policy)
#     return new_version

from sqlalchemy.orm import Session
from app.models.chat import Session as SessionModel, ChatMessage, PolicyData
from datetime import datetime, timezone
from typing import Optional


def _now() -> datetime:
    """Return current UTC time. Single source of truth for all timestamps."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_or_update_session(db: Session, session_id: str, connected: bool):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    now = _now()
    if session:
        session.is_connected = connected
        session.last_active = now
        if connected:
            session.connected_at = now
        else:
            session.disconnected_at = now
    else:
        session = SessionModel(
            session_id=session_id,
            is_connected=connected,
            connected_at=now if connected else None,
        )
        db.add(session)
    db.commit()


def save_message(db: Session, session_id: str, sender: str, content: str):
    now = _now()
    msg = ChatMessage(
        session_id=session_id,
        sender=sender,
        content=content,
        created_at=now,
        saved_at=now,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_history(db: Session, session_id: str, limit: int = 50):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )


def get_policy(db: Session, session_id: str) -> Optional[PolicyData]:
    return (
        db.query(PolicyData)
        .filter(PolicyData.session_id == session_id, PolicyData.is_active == True)
        .order_by(PolicyData.version.desc())
        .first()
    )


def upsert_policy(db: Session, session_id: str, fields: dict):
    policy = db.query(PolicyData).filter(PolicyData.session_id == session_id).first()
    if policy:
        for k, v in fields.items():
            if hasattr(policy, k):
                setattr(policy, k, v)
        policy.updated_at = _now()
    else:
        policy = PolicyData(session_id=session_id, created_at=_now(), **fields)
        db.add(policy)
    db.commit()
    return policy


def delete_policy(db: Session, session_id: str):
    db.query(PolicyData).filter(PolicyData.session_id == session_id).delete()
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.commit()


def find_policy_by_name(db: Session, name: str) -> Optional[PolicyData]:
    return (
        db.query(PolicyData)
        .filter(PolicyData.name.ilike(name.strip()))
        .first()
    )


def get_active_policy(db: Session, session_id: str) -> Optional[PolicyData]:
    """Return the currently active (non-archived) policy for this session."""
    return (
        db.query(PolicyData)
        .filter(PolicyData.session_id == session_id, PolicyData.is_active == True)
        .order_by(PolicyData.version.desc())
        .first()
    )


def get_all_policy_versions(db: Session, session_id: str):
    """Return ALL policy versions for this session, newest first."""
    return (
        db.query(PolicyData)
        .filter(PolicyData.session_id == session_id)
        .order_by(PolicyData.version.desc())
        .all()
    )


def upsert_active_policy(db: Session, session_id: str, data: dict) -> PolicyData:
    """
    Update fields on the active policy version.
    If no active policy exists, create version 1.
    """
    policy = get_active_policy(db, session_id)
    if not policy:
        policy = PolicyData(
            session_id=session_id,
            version=1,
            is_active=True,
            created_at=_now(),
        )
        db.add(policy)

    for k, v in data.items():
        setattr(policy, k, v)

    db.commit()
    db.refresh(policy)
    return policy


def archive_and_new_version(db: Session, session_id: str) -> int:
    """
    Soft-reset:
    1. Mark the current active policy as archived (is_active=False).
    2. Create a new blank policy with version = old_version + 1, is_active=True.
    Returns the new version number.
    """
    current = get_active_policy(db, session_id)

    if current:
        current.is_active = False
        db.commit()
        new_version = current.version + 1
    else:
        new_version = 1

    new_policy = PolicyData(
        session_id=session_id,
        version=new_version,
        is_active=True,
        created_at=_now(),
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_version