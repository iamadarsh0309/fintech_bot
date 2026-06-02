from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.chat import SenderType
from app.schemas.session import SessionResponse


class MessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: str
    session_id: str
    sender_type: SenderType
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ChatReplyResponse(BaseModel):
    session: SessionResponse
    user_message: MessageResponse
    assistant_message: MessageResponse
    eligible_products: list[dict[str, Any]]
    tool_outputs: dict[str, Any]
    disclaimer: str


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    extracted_text_preview: str
    summary: str
    message: MessageResponse


class SummaryResponse(BaseModel):
    session_id: str
    summary: str
