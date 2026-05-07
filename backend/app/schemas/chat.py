from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    id: int
    sender: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    type: str
    text: str
    timestamp: str
    session_id: Optional[str] = None

class HistoryResponse(BaseModel):
    type: str
    messages: List[dict]

class PolicyFieldResponse(BaseModel):
    session_id: str
    field: str
    found: bool
    value: Optional[str] = None

class PolicyDataResponse(BaseModel):
    session_id: str
    policy_data: dict
    complete: bool
    missing_fields: List[str]
    filled_count: int
    total_fields: int