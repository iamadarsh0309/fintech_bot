from pydantic import BaseModel, Field


class EMICalculationRequest(BaseModel):
    amount: float = Field(gt=0)
    interest_rate: float = Field(ge=0)
    months: int = Field(gt=0)


class EMICalculationResponse(BaseModel):
    emi: float
    total_interest: float
    total_repayment: float
