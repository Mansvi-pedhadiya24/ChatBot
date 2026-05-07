from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.db.base import Base


class Session(Base):
    __tablename__ = "sessions"

    session_id      = Column(String(100), primary_key=True, index=True)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
    last_active     = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_connected    = Column(Boolean, default=False)
    connected_at    = Column(DateTime, nullable=True)
    disconnected_at = Column(DateTime, nullable=True)
    typing          = Column(Boolean, default=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100),nullable=False, index=True)
    sender     = Column(String(50), nullable=False)   # user / bot / system
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    saved_at   = Column(DateTime, server_default=func.now(), nullable=False)


class PolicyData(Base):
    __tablename__ = "policy_data"

    id= Column(Integer, primary_key=True, autoincrement=True)

    session_id= Column(String(100), nullable=False, index=True)
    version      = Column(Integer, nullable=False, default=1)
    is_active    = Column(Boolean, nullable=False, default=True)

    name = Column(String(255), nullable=True)
    age= Column(String(10),  nullable=True)
    policy_type = Column(String(100), nullable=True)
    premium  = Column(String(50),  nullable=True)
    benefit_amount  = Column(String(100), nullable=True)
    elimination_period   = Column(String(100), nullable=True)
    inflation_protection = Column(String(100), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)