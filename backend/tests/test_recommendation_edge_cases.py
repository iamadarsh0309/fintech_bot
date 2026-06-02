import pytest

from app.models.loan_product import LoanProduct
from app.services.recommendation_service import (
    calculate_emi,
    calculate_foir,
    compare_tenure_outlook,
    find_eligible_products,
)


def _product(**overrides) -> LoanProduct:
    defaults = dict(
        name="Personal Loan",
        description="General purpose",
        interest_rate=11.0,
        minimum_income=50000,
        maximum_amount=1000000,
        minimum_tenure=12,
        maximum_tenure=60,
        eligibility_rules={"max_foir": 45, "employment_types": ["salaried"]},
    )
    defaults.update(overrides)
    return LoanProduct(**defaults)


def test_calculate_emi_with_zero_interest_is_straight_division():
    result = calculate_emi(amount=120000, annual_interest_rate=0, months=12)

    assert result["emi"] == 10000.0
    assert result["total_interest"] == 0.0
    assert result["total_repayment"] == 120000.0


def test_calculate_emi_total_repayment_is_principal_plus_interest():
    result = calculate_emi(amount=500000, annual_interest_rate=11, months=24)

    # total_repayment is derived from the unrounded EMI, so allow rounding slack.
    assert result["total_repayment"] == pytest.approx(500000 + result["total_interest"], abs=0.01)
    assert result["total_repayment"] == pytest.approx(result["emi"] * 24, abs=0.5)


def test_calculate_foir_handles_zero_income():
    assert calculate_foir(0, 10000) == 100.0


def test_calculate_foir_handles_negative_income():
    assert calculate_foir(-5000, 10000) == 100.0


def test_calculate_foir_zero_existing_emi_is_zero():
    assert calculate_foir(80000, 0) == 0.0


def test_compare_tenure_outlook_short_tenure():
    result = compare_tenure_outlook(months=12, risk_profile="growth")

    assert "Short tenure" in result["tenure_note"]
    assert "Growth-oriented" in result["risk_note"]


def test_compare_tenure_outlook_mid_tenure():
    result = compare_tenure_outlook(months=30, risk_profile="balanced")

    assert "Mid-range tenure" in result["tenure_note"]


def test_compare_tenure_outlook_low_risk_alias_is_conservative_note():
    result = compare_tenure_outlook(months=24, risk_profile="low")

    assert "Conservative borrowers" in result["risk_note"]


def test_find_eligible_products_excludes_loan_above_maximum_amount():
    eligible = find_eligible_products(
        products=[_product(maximum_amount=300000)],
        monthly_income=90000,
        existing_monthly_emi=5000,
        loan_amount=500000,
        employment_type="salaried",
        preferred_tenure_months=24,
    )

    assert eligible == []


def test_find_eligible_products_excludes_tenure_out_of_range():
    eligible = find_eligible_products(
        products=[_product(minimum_tenure=12, maximum_tenure=36)],
        monthly_income=90000,
        existing_monthly_emi=5000,
        loan_amount=400000,
        employment_type="salaried",
        preferred_tenure_months=48,
    )

    assert eligible == []


def test_find_eligible_products_excludes_income_below_minimum():
    eligible = find_eligible_products(
        products=[_product(minimum_income=80000)],
        monthly_income=60000,
        existing_monthly_emi=2000,
        loan_amount=400000,
        employment_type="salaried",
        preferred_tenure_months=24,
    )

    assert eligible == []


def test_find_eligible_products_allows_any_employment_when_rule_empty():
    eligible = find_eligible_products(
        products=[_product(eligibility_rules={"max_foir": 45, "employment_types": []})],
        monthly_income=90000,
        existing_monthly_emi=5000,
        loan_amount=400000,
        employment_type="freelancer",
        preferred_tenure_months=24,
    )

    assert [item["name"] for item in eligible] == ["Personal Loan"]


def test_find_eligible_products_matches_employment_case_insensitively():
    eligible = find_eligible_products(
        products=[_product(eligibility_rules={"max_foir": 45, "employment_types": ["Salaried"]})],
        monthly_income=90000,
        existing_monthly_emi=5000,
        loan_amount=400000,
        employment_type="SALARIED",
        preferred_tenure_months=24,
    )

    assert len(eligible) == 1


def test_find_eligible_products_defaults_max_foir_to_45_when_missing():
    # existing EMI 40000 / income 80000 -> FOIR 50, above the default 45 cap
    eligible = find_eligible_products(
        products=[_product(eligibility_rules={"employment_types": ["salaried"]})],
        monthly_income=80000,
        existing_monthly_emi=40000,
        loan_amount=400000,
        employment_type="salaried",
        preferred_tenure_months=24,
    )

    assert eligible == []
