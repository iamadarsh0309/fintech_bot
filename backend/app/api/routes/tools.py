from fastapi import APIRouter

from app.schemas.tool import EMICalculationRequest, EMICalculationResponse
from app.services.recommendation_service import calculate_emi

router = APIRouter(tags=["tools"])


@router.post("/debug/calculate-emi", response_model=EMICalculationResponse)
def calculate_emi_route(payload: EMICalculationRequest) -> EMICalculationResponse:
    result = calculate_emi(
        amount=payload.amount,
        annual_interest_rate=payload.interest_rate,
        months=payload.months,
    )
    return EMICalculationResponse(**result)
