from math import pow
from typing import Any

from app.models.loan_product import LoanProduct


def calculate_emi(amount: float, annual_interest_rate: float, months: int) -> dict[str, float]:
    monthly_rate = annual_interest_rate / 12 / 100
    if monthly_rate == 0:
        emi = amount / months
    else:
        emi = amount * monthly_rate * pow(1 + monthly_rate, months) / (pow(1 + monthly_rate, months) - 1)
    total_repayment = emi * months
    total_interest = total_repayment - amount
    return {
        "emi": round(emi, 2),
        "total_interest": round(total_interest, 2),
        "total_repayment": round(total_repayment, 2),
    }


def calculate_foir(monthly_income: float, existing_monthly_emi: float) -> float:
    if monthly_income <= 0:
        return 100.0
    return round((existing_monthly_emi / monthly_income) * 100, 2)


def find_eligible_products(
    *,
    products: list[LoanProduct],
    monthly_income: float,
    existing_monthly_emi: float,
    loan_amount: float,
    employment_type: str,
    preferred_tenure_months: int,
) -> list[dict[str, Any]]:
    foir = calculate_foir(monthly_income, existing_monthly_emi)
    eligible_products: list[dict[str, Any]] = []

    for product in products:
        rules = product.eligibility_rules or {}
        max_foir = float(rules.get("max_foir", 45))
        allowed_employment_types = rules.get("employment_types", [])

        if monthly_income < float(product.minimum_income):
            continue
        if loan_amount > float(product.maximum_amount):
            continue
        if preferred_tenure_months < int(product.minimum_tenure) or preferred_tenure_months > int(product.maximum_tenure):
            continue
        if foir > max_foir:
            continue
        if allowed_employment_types and employment_type.lower() not in {
            item.lower() for item in allowed_employment_types
        }:
            continue

        eligible_products.append(
            {
                "name": product.name,
                "description": product.description,
                "interest_rate": float(product.interest_rate),
                "minimum_income": float(product.minimum_income),
                "maximum_amount": float(product.maximum_amount),
                "minimum_tenure": int(product.minimum_tenure),
                "maximum_tenure": int(product.maximum_tenure),
                "foir": foir,
                "max_foir": max_foir,
                "employment_types": allowed_employment_types,
            }
        )

    return eligible_products


def compare_tenure_outlook(months: int, risk_profile: str) -> dict[str, str]:
    if months <= 12:
        outlook = "Short tenure reduces total interest but keeps EMI higher."
    elif months <= 36:
        outlook = "Mid-range tenure balances EMI affordability with total interest."
    else:
        outlook = "Long tenure lowers EMI but increases total repayment over time."

    risk_note = (
        "Conservative borrowers may prefer lower EMI stress and stronger repayment buffers."
        if risk_profile.lower() in {"conservative", "low"}
        else "Growth-oriented borrowers may accept higher EMI to reduce total interest faster."
    )
    return {"tenure_note": outlook, "risk_note": risk_note}
