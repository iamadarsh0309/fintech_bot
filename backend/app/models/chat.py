import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class SessionStatus(str, enum.Enum):
    PROFILE_CAPTURED = "PROFILE_CAPTURED"
    ACTIVE = "ACTIVE"
    AWAITING_DOCUMENT = "AWAITING_DOCUMENT"
    READY_FOR_SUMMARY = "READY_FOR_SUMMARY"
    COMPLETED = "COMPLETED"


class SessionIntent(str, enum.Enum):
    FIND_BEST_LOAN = "FIND_BEST_LOAN"
    COMPARE_LOANS = "COMPARE_LOANS"
    EMI_CALCULATION = "EMI_CALCULATION"
    EXPLAIN_LOAN_TERMS = "EXPLAIN_LOAN_TERMS"
    UPLOAD_DOCUMENT = "UPLOAD_DOCUMENT"


class SenderType(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
    SYSTEM = "SYSTEM"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    intent = Column(Enum(SessionIntent), nullable=False)
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.ACTIVE)
    loan_amount = Column(Numeric(12, 2), nullable=False)
    loan_purpose = Column(String, nullable=False)
    monthly_income = Column(Numeric(12, 2), nullable=False)
    employment_type = Column(String, nullable=False)
    existing_monthly_emi = Column(Numeric(12, 2), nullable=False, default=0)
    preferred_tenure_months = Column(Integer, nullable=False)
    risk_profile = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    state_snapshot = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    sender_type = Column(Enum(SenderType), nullable=False)
    message = Column(Text, nullable=False)
    meta = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
