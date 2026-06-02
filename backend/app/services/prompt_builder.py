import json
from dataclasses import dataclass
from typing import Any


@dataclass
class PromptSections:
    persona: str
    instruction: str
    context: str
    format: str
    audience: str
    tone: str
    data: str


def render_prompt(sections: PromptSections) -> str:
    return (
        "PROMPT STRUCTURE\n\n"
        f"Persona (Identity):\n{sections.persona}\n\n"
        f"Instruction (Main task):\n{sections.instruction}\n\n"
        f"Context (Additional information):\n{sections.context}\n\n"
        f"Format (Output structure):\n{sections.format}\n\n"
        f"Audience (For whom):\n{sections.audience}\n\n"
        f"Tone (Style of text):\n{sections.tone}\n\n"
        f"Data (Ground truth):\n{sections.data}"
    )


def build_chat_prompt(
    *,
    intent: str,
    borrower_profile: dict[str, Any],
    state_snapshot: dict[str, Any],
    eligible_products: list[dict[str, Any]],
    tool_outputs: dict[str, Any],
    conversation_history: list[str],
    user_question: str,
) -> str:
    instruction_map = {
        "FIND_BEST_LOAN": (
            "Recommend the most suitable loan options based only on the grounded borrower profile, "
            "eligible products, and deterministic tool outputs."
        ),
        "COMPARE_LOANS": (
            "Compare the most relevant eligible loan products and explain trade-offs using only the provided data."
        ),
        "EMI_CALCULATION": (
            "Explain EMI, total interest, and repayment implications using only the calculator output provided."
        ),
        "EXPLAIN_LOAN_TERMS": (
            "Explain loan concepts in simple language using only the current borrower context and product data."
        ),
        "UPLOAD_DOCUMENT": (
            "Use the borrower profile, session state, and any extracted document information to guide the user."
        ),
    }

    sections = PromptSections(
        persona=(
            "You are a responsible AI loan advisor for an educational fintech application. "
            "You are careful, grounded, and transparent. You never invent rates, approvals, or eligibility."
        ),
        instruction=instruction_map.get(
            intent,
            "Answer the borrower question using only the grounded context and deterministic tool outputs.",
        ),
        context=(
            "Rules:\n"
            "1. Use only the provided catalog data, borrower profile, session state, and tool outputs.\n"
            "2. Never guarantee approval.\n"
            "3. If information is missing, say exactly: I don't have enough information.\n"
            "4. EMI figures must come only from calculator output.\n"
            f"5. Current session intent is {intent}.\n"
            f"6. Current session state is {state_snapshot.get('stage', 'UNKNOWN')}."
        ),
        format=(
            "Return valid JSON with this shape:\n"
            '{\n  "answer": "<plain-language response>",\n  "disclaimer": "<short underwriting disclaimer>"\n}'
        ),
        audience=(
            "The audience is a borrower evaluating lending options who needs clear, concise, and auditable guidance."
        ),
        tone="Professional, clear, calm, and non-salesy.",
        data=json.dumps(
            {
                "borrower_profile": borrower_profile,
                "state_snapshot": state_snapshot,
                "eligible_products": eligible_products,
                "tool_outputs": tool_outputs,
                "conversation_history": conversation_history[-12:],
                "user_question": user_question,
            },
            indent=2,
            default=str,
        ),
    )
    return render_prompt(sections)


def build_summary_prompt(
    *,
    summary_kind: str,
    source_text: str,
    state_snapshot: dict[str, Any],
) -> str:
    sections = PromptSections(
        persona=(
            "You are a responsible AI assistant that creates concise, audit-friendly financial summaries."
        ),
        instruction=(
            "Summarize the financial consultation clearly and concisely. Highlight borrower need, grounded findings, "
            "key risks, and practical next steps."
        ),
        context=(
            f"This is a {summary_kind} summary for a loan advisory workflow. "
            f"Current session state is {state_snapshot.get('stage', 'UNKNOWN')}."
        ),
        format=(
            "Write 1 short paragraph followed by 3 bullet points covering recommendations, risks, and next steps."
        ),
        audience="The audience is an internal reviewer or borrower who needs a fast recap of the consultation.",
        tone="Professional and crisp.",
        data=json.dumps(
            {
                "state_snapshot": state_snapshot,
                "source_text": source_text,
            },
            indent=2,
            default=str,
        ),
    )
    return render_prompt(sections)
