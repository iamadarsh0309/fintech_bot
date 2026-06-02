from app.models.chat import ChatSession, SessionIntent, SessionStatus
from app.services.session_state_service import (
    advance_state_after_document,
    advance_state_after_message,
    advance_state_after_summary,
    initialize_session_state,
)


def build_session(intent: SessionIntent) -> ChatSession:
    return ChatSession(
        user_id="user-1",
        title="Loan session",
        intent=intent,
        loan_amount=500000,
        loan_purpose="Personal loan",
        monthly_income=90000,
        employment_type="salaried",
        existing_monthly_emi=10000,
        preferred_tenure_months=24,
        risk_profile="balanced",
        state_snapshot={},
    )


def test_initialize_session_state_for_standard_intent():
    session = build_session(SessionIntent.FIND_BEST_LOAN)

    snapshot = initialize_session_state(session)

    assert session.status == SessionStatus.PROFILE_CAPTURED
    assert snapshot["stage"] == "PROFILE_CAPTURED"
    assert snapshot["profile_complete"] is True
    assert snapshot["document_uploaded"] is False


def test_initialize_session_state_for_upload_document_intent():
    session = build_session(SessionIntent.UPLOAD_DOCUMENT)

    snapshot = initialize_session_state(session)

    assert session.status == SessionStatus.AWAITING_DOCUMENT
    assert snapshot["stage"] == "AWAITING_DOCUMENT_UPLOAD"


def test_advance_state_after_message_tracks_latest_messages_and_tools():
    session = build_session(SessionIntent.FIND_BEST_LOAN)
    initialize_session_state(session)

    snapshot = advance_state_after_message(
        chat_session=session,
        user_message="What is my best option?",
        assistant_message="Personal Loan looks strongest.",
        tool_outputs={"eligibility_checker": {}, "emi_calculator": {}},
    )

    assert session.status == SessionStatus.ACTIVE
    assert snapshot["stage"] == "ADVISORY_IN_PROGRESS"
    assert snapshot["last_user_message"] == "What is my best option?"
    assert snapshot["last_assistant_message"] == "Personal Loan looks strongest."
    assert snapshot["last_tool_names"] == ["eligibility_checker", "emi_calculator"]


def test_advance_state_after_document_marks_document_uploaded():
    session = build_session(SessionIntent.UPLOAD_DOCUMENT)
    initialize_session_state(session)

    snapshot = advance_state_after_document(chat_session=session, filename="salary-slip.pdf")

    assert session.status == SessionStatus.ACTIVE
    assert snapshot["stage"] == "DOCUMENT_PROCESSED"
    assert snapshot["document_uploaded"] is True
    assert snapshot["document_name"] == "salary-slip.pdf"


def test_advance_state_after_summary_marks_summary_ready():
    session = build_session(SessionIntent.FIND_BEST_LOAN)
    initialize_session_state(session)

    snapshot = advance_state_after_summary(session)

    assert session.status == SessionStatus.READY_FOR_SUMMARY
    assert snapshot["stage"] == "SUMMARY_READY"
    assert snapshot["summary_ready"] is True
