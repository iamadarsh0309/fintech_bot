import json

from app.services.prompt_builder import build_chat_prompt, build_summary_prompt


def test_build_chat_prompt_uses_component_structure():
    prompt = build_chat_prompt(
        intent="FIND_BEST_LOAN",
        borrower_profile={"loan_amount": 500000, "monthly_income": 90000},
        state_snapshot={"stage": "ADVISORY_IN_PROGRESS"},
        eligible_products=[{"name": "Personal Loan", "interest_rate": 11.0}],
        tool_outputs={"emi_calculator": {"emi": 23329.0}},
        conversation_history=["USER: help me choose"],
        user_question="What is my best option?",
    )

    assert "Persona (Identity):" in prompt
    assert "Instruction (Main task):" in prompt
    assert "Context (Additional information):" in prompt
    assert "Format (Output structure):" in prompt
    assert "Audience (For whom):" in prompt
    assert "Tone (Style of text):" in prompt
    assert "Data (Ground truth):" in prompt
    assert "Current session intent is FIND_BEST_LOAN." in prompt
    assert '"user_question": "What is my best option?"' in prompt


def test_build_summary_prompt_includes_state_and_source_text():
    prompt = build_summary_prompt(
        summary_kind="conversation",
        source_text="USER: Can I reduce my EMI?",
        state_snapshot={"stage": "DOCUMENT_PROCESSED"},
    )

    assert "conversation summary" in prompt
    assert "DOCUMENT_PROCESSED" in prompt
    assert "source_text" in prompt
    assert "USER: Can I reduce my EMI?" in prompt


def test_build_chat_prompt_limits_conversation_history_to_last_12_items():
    history = [f"USER: message {index}" for index in range(20)]
    prompt = build_chat_prompt(
        intent="COMPARE_LOANS",
        borrower_profile={"loan_amount": 400000},
        state_snapshot={"stage": "ADVISORY_IN_PROGRESS"},
        eligible_products=[],
        tool_outputs={},
        conversation_history=history,
        user_question="Compare options",
    )

    data_json = prompt.split("Data (Ground truth):\n", 1)[1]
    payload = json.loads(data_json)
    assert len(payload["conversation_history"]) == 12
    assert payload["conversation_history"][0] == "USER: message 8"
