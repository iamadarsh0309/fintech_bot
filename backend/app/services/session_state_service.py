from datetime import datetime
from typing import Any

from app.models.chat import ChatSession, SessionIntent, SessionStatus


def initialize_session_state(chat_session: ChatSession) -> dict[str, Any]:
    stage = "PROFILE_CAPTURED"
    status = SessionStatus.PROFILE_CAPTURED
    if chat_session.intent == SessionIntent.UPLOAD_DOCUMENT:
        stage = "AWAITING_DOCUMENT_UPLOAD"
        status = SessionStatus.AWAITING_DOCUMENT

    snapshot = {
        "stage": stage,
        "intent": chat_session.intent.value,
        "profile_complete": True,
        "document_uploaded": False,
        "last_user_message": None,
        "last_assistant_message": None,
        "last_tool_names": [],
        "updated_at": datetime.utcnow().isoformat(),
    }
    chat_session.status = status
    chat_session.state_snapshot = snapshot
    return snapshot


def advance_state_after_message(
    *,
    chat_session: ChatSession,
    user_message: str,
    assistant_message: str,
    tool_outputs: dict[str, Any],
) -> dict[str, Any]:
    snapshot = dict(chat_session.state_snapshot or {})
    snapshot.update(
        {
            "stage": "ADVISORY_IN_PROGRESS",
            "intent": chat_session.intent.value,
            "last_user_message": user_message,
            "last_assistant_message": assistant_message,
            "last_tool_names": sorted(tool_outputs.keys()),
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    if chat_session.intent == SessionIntent.UPLOAD_DOCUMENT and not snapshot.get("document_uploaded"):
        chat_session.status = SessionStatus.AWAITING_DOCUMENT
    else:
        chat_session.status = SessionStatus.ACTIVE

    chat_session.state_snapshot = snapshot
    return snapshot


def advance_state_after_document(
    *,
    chat_session: ChatSession,
    filename: str,
) -> dict[str, Any]:
    snapshot = dict(chat_session.state_snapshot or {})
    snapshot.update(
        {
            "stage": "DOCUMENT_PROCESSED",
            "document_uploaded": True,
            "document_name": filename,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )
    chat_session.status = SessionStatus.ACTIVE
    chat_session.state_snapshot = snapshot
    return snapshot


def advance_state_after_summary(chat_session: ChatSession) -> dict[str, Any]:
    snapshot = dict(chat_session.state_snapshot or {})
    snapshot.update(
        {
            "stage": "SUMMARY_READY",
            "summary_ready": True,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )
    chat_session.status = SessionStatus.READY_FOR_SUMMARY
    chat_session.state_snapshot = snapshot
    return snapshot
