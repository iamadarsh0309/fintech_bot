from datetime import datetime
from decimal import Decimal
from typing import Optional
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat import SessionIntent, SessionStatus


class SessionCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    intent: SessionIntent
    loan_amount: Decimal = Field(gt=0)
    loan_purpose: str = Field(min_length=2, max_length=120)
    monthly_income: Decimal = Field(gt=0)
    employment_type: str = Field(min_length=2, max_length=60)
    existing_monthly_emi: Decimal = Field(ge=0)
    preferred_tenure_months: int = Field(gt=0, le=360)
    risk_profile: str = Field(min_length=2, max_length=60)


class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    intent: SessionIntent
    status: SessionStatus
    loan_amount: Decimal
    loan_purpose: str
    monthly_income: Decimal
    employment_type: str
    existing_monthly_emi: Decimal
    preferred_tenure_months: int
    risk_profile: str
    summary: Optional[str]
    state_snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
