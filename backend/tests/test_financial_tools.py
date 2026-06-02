from app.models.loan_product import LoanProduct
from app.services.recommendation_service import (
    calculate_emi,
    calculate_foir,
    compare_tenure_outlook,
    find_eligible_products,
)


def test_calculate_emi_returns_positive_values():
    result = calculate_emi(amount=500000, annual_interest_rate=11, months=24)
    assert result["emi"] > 0
    assert result["total_interest"] > 0
    assert result["total_repayment"] > 500000


def test_calculate_foir():
    assert calculate_foir(100000, 20000) == 20.0


def test_compare_tenure_outlook_changes_with_tenure_and_risk():
    result = compare_tenure_outlook(months=48, risk_profile="conservative")
    assert "Long tenure" in result["tenure_note"]
    assert "Conservative borrowers" in result["risk_note"]


def test_find_eligible_products_filters_by_income_employment_and_foir():
    products = [
        LoanProduct(
            name="Personal Loan",
            description="General purpose",
            interest_rate=11.0,
            minimum_income=50000,
            maximum_amount=1000000,
            minimum_tenure=12,
            maximum_tenure=60,
            eligibility_rules={"max_foir": 45, "employment_types": ["salaried"]},
        ),
        LoanProduct(
            name="SME Loan",
            description="Business lending",
            interest_rate=14.0,
            minimum_income=80000,
            maximum_amount=5000000,
            minimum_tenure=12,
            maximum_tenure=84,
            eligibility_rules={"max_foir": 50, "employment_types": ["business-owner"]},
        ),
    ]

    eligible = find_eligible_products(
        products=products,
        monthly_income=90000,
        existing_monthly_emi=15000,
        loan_amount=500000,
        employment_type="salaried",
        preferred_tenure_months=24,
    )

    assert [product["name"] for product in eligible] == ["Personal Loan"]
    assert eligible[0]["foir"] == 16.67


def test_find_eligible_products_returns_empty_when_foir_is_too_high():
    products = [
        LoanProduct(
            name="Salary Advance",
            description="Short term",
            interest_rate=8.0,
            minimum_income=30000,
            maximum_amount=300000,
            minimum_tenure=3,
            maximum_tenure=18,
            eligibility_rules={"max_foir": 35, "employment_types": ["salaried"]},
        )
    ]

    eligible = find_eligible_products(
        products=products,
        monthly_income=50000,
        existing_monthly_emi=25000,
        loan_amount=100000,
        employment_type="salaried",
        preferred_tenure_months=12,
    )

    assert eligible == []
