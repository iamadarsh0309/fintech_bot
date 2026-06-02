from dataclasses import dataclass
from typing import Any

from app.models.chat import ChatSession, Message, SessionIntent
from app.models.loan_product import LoanProduct
from app.services.llm_service import get_llm_service
from app.services.prompt_builder import build_chat_prompt, build_summary_prompt
from app.services.recommendation_service import (
    calculate_emi,
    compare_tenure_outlook,
    find_eligible_products,
)


DEFAULT_DISCLAIMER = (
    "This guidance is informational only. Final approval depends on lender underwriting, "
    "document verification, and policy checks."
)


@dataclass
class AssistantReply:
    answer: str
    disclaimer: str
    eligible_products: list[dict[str, Any]]
    tool_outputs: dict[str, Any]
    metadata: dict[str, Any]
    prompt: str


def _serialize_session_profile(chat_session: ChatSession) -> dict[str, Any]:
    return {
        "loan_amount": float(chat_session.loan_amount),
        "loan_purpose": chat_session.loan_purpose,
        "monthly_income": float(chat_session.monthly_income),
        "employment_type": chat_session.employment_type,
        "existing_monthly_emi": float(chat_session.existing_monthly_emi),
        "preferred_tenure_months": chat_session.preferred_tenure_months,
        "risk_profile": chat_session.risk_profile,
        "intent": chat_session.intent.value,
    }


def _build_tool_outputs(
    *,
    chat_session: ChatSession,
    eligible_products: list[dict[str, Any]],
) -> dict[str, Any]:
    tool_outputs: dict[str, Any] = {}

    if chat_session.intent == SessionIntent.FIND_BEST_LOAN:
        tool_outputs["eligibility_checker"] = eligible_products
        tool_outputs["tenure_tradeoffs"] = compare_tenure_outlook(
            months=chat_session.preferred_tenure_months,
            risk_profile=chat_session.risk_profile,
        )
        if eligible_products:
            tool_outputs["emi_calculator"] = calculate_emi(
                amount=float(chat_session.loan_amount),
                annual_interest_rate=eligible_products[0]["interest_rate"],
                months=chat_session.preferred_tenure_months,
            )
    elif chat_session.intent == SessionIntent.COMPARE_LOANS:
        tool_outputs["eligibility_checker"] = eligible_products
        tool_outputs["loan_comparisons"] = [
            {
                "product_name": product["name"],
                "interest_rate": product["interest_rate"],
                "emi_scenario": calculate_emi(
                    amount=float(chat_session.loan_amount),
                    annual_interest_rate=product["interest_rate"],
                    months=chat_session.preferred_tenure_months,
                ),
            }
            for product in eligible_products[:3]
        ]
        tool_outputs["tenure_tradeoffs"] = compare_tenure_outlook(
            months=chat_session.preferred_tenure_months,
            risk_profile=chat_session.risk_profile,
        )
    elif chat_session.intent == SessionIntent.EMI_CALCULATION:
        if eligible_products:
            tool_outputs["emi_calculator"] = calculate_emi(
                amount=float(chat_session.loan_amount),
                annual_interest_rate=eligible_products[0]["interest_rate"],
                months=chat_session.preferred_tenure_months,
            )
        else:
            tool_outputs["emi_calculator_unavailable"] = {
                "reason": "No grounded product/rate is available for this borrower profile yet."
            }
        tool_outputs["tenure_tradeoffs"] = compare_tenure_outlook(
            months=chat_session.preferred_tenure_months,
            risk_profile=chat_session.risk_profile,
        )
    elif chat_session.intent == SessionIntent.EXPLAIN_LOAN_TERMS:
        tool_outputs["eligible_products_snapshot"] = eligible_products[:3]
        tool_outputs["term_explainer_context"] = {
            "loan_amount": float(chat_session.loan_amount),
            "preferred_tenure_months": chat_session.preferred_tenure_months,
            "existing_monthly_emi": float(chat_session.existing_monthly_emi),
        }
    elif chat_session.intent == SessionIntent.UPLOAD_DOCUMENT:
        tool_outputs["document_workflow"] = {
            "document_uploaded": bool(chat_session.state_snapshot.get("document_uploaded")),
            "next_step": (
                "Analyze the uploaded document against the borrower profile."
                if chat_session.state_snapshot.get("document_uploaded")
                else "Ask the user to upload a PDF document for extraction."
            ),
        }
        tool_outputs["eligibility_checker"] = eligible_products
    else:
        tool_outputs["eligibility_checker"] = eligible_products

    return tool_outputs


async def generate_assistant_reply(
    *,
    chat_session: ChatSession,
    user_message: str,
    products: list[LoanProduct],
    message_history: list[Message],
) -> AssistantReply:
    eligible_products = find_eligible_products(
        products=products,
        monthly_income=float(chat_session.monthly_income),
        existing_monthly_emi=float(chat_session.existing_monthly_emi),
        loan_amount=float(chat_session.loan_amount),
        employment_type=chat_session.employment_type,
        preferred_tenure_months=chat_session.preferred_tenure_months,
    )
    tool_outputs = _build_tool_outputs(
        chat_session=chat_session,
        eligible_products=eligible_products,
    )
    conversation_history = [
        f"{item.sender_type.value}: {item.message}" for item in message_history[-12:]
    ]
    prompt = build_chat_prompt(
        intent=chat_session.intent.value,
        borrower_profile=_serialize_session_profile(chat_session),
        state_snapshot=chat_session.state_snapshot or {},
        eligible_products=eligible_products,
        tool_outputs=tool_outputs,
        conversation_history=conversation_history,
        user_question=user_message,
    )
    llm_result = await get_llm_service().query(
        prompt=prompt,
        metadata={
            "intent": chat_session.intent.value,
            "sessionId": chat_session.id,
            "toolCount": len(tool_outputs),
        },
    )

    metadata = {
        "llm_model": llm_result.model,
        "tool_called": ",".join(tool_outputs.keys()),
        "tokens": llm_result.tokens,
        "eligible_products_count": len(eligible_products),
        "prompt_version": "component-structured-v1",
    }
    return AssistantReply(
        answer=llm_result.answer,
        disclaimer=llm_result.disclaimer or DEFAULT_DISCLAIMER,
        eligible_products=eligible_products,
        tool_outputs=tool_outputs,
        metadata=metadata,
        prompt=prompt,
    )


async def generate_consultation_summary(
    messages_text: str,
    *,
    state_snapshot: dict[str, Any],
    summary_kind: str,
) -> str:
    prompt = build_summary_prompt(
        summary_kind=summary_kind,
        source_text=messages_text,
        state_snapshot=state_snapshot,
    )
    llm_result = await get_llm_service().query(
        prompt=prompt,
        metadata={"purpose": "conversation-summary", "summaryKind": summary_kind},
    )
    return llm_result.answer
