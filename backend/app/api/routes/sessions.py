from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_user_session_or_404
from app.models.chat import ChatSession, Message, SenderType
from app.models.loan_product import LoanProduct
from app.models.user import User
from app.schemas.message import (
    ChatReplyResponse,
    MessageCreate,
    MessageResponse,
    SummaryResponse,
    UploadResponse,
)
from app.schemas.session import SessionCreate, SessionResponse
from app.services.chat_service import generate_assistant_reply, generate_consultation_summary
from app.services.pdf_service import extract_text_from_pdf
from app.services.session_state_service import (
    advance_state_after_document,
    advance_state_after_message,
    advance_state_after_summary,
    initialize_session_state,
)

router = APIRouter(tags=["sessions"])


def serialize_message(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        session_id=message.session_id,
        sender_type=message.sender_type,
        message=message.message,
        metadata=message.meta or {},
        created_at=message.created_at,
    )


def serialize_session(chat_session: ChatSession) -> SessionResponse:
    return SessionResponse.model_validate(chat_session)


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    chat_session = ChatSession(
        user_id=current_user.id,
        title=payload.title or f"{payload.loan_purpose} advice",
        intent=payload.intent,
        loan_amount=payload.loan_amount,
        loan_purpose=payload.loan_purpose,
        monthly_income=payload.monthly_income,
        employment_type=payload.employment_type,
        existing_monthly_emi=payload.existing_monthly_emi,
        preferred_tenure_months=payload.preferred_tenure_months,
        risk_profile=payload.risk_profile,
        state_snapshot={},
    )
    initialize_session_state(chat_session)
    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)
    return serialize_session(chat_session)


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionResponse]:
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [serialize_session(item) for item in sessions]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    chat_session = get_user_session_or_404(session_id, db, current_user.id)
    return serialize_session(chat_session)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    get_user_session_or_404(session_id, db, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [serialize_message(message) for message in messages]


@router.post("/sessions/{session_id}/messages", response_model=ChatReplyResponse)
async def create_message(
    session_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatReplyResponse:
    chat_session = get_user_session_or_404(session_id, db, current_user.id)

    user_message = Message(
        session_id=session_id,
        sender_type=SenderType.USER,
        message=payload.message,
        meta={"source": "chat-ui"},
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    products = db.query(LoanProduct).order_by(LoanProduct.interest_rate.asc()).all()
    history = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    assistant_reply = await generate_assistant_reply(
        chat_session=chat_session,
        user_message=payload.message,
        products=products,
        message_history=history,
    )

    assistant_message = Message(
        session_id=session_id,
        sender_type=SenderType.ASSISTANT,
        message=assistant_reply.answer,
        meta={**assistant_reply.metadata, "disclaimer": assistant_reply.disclaimer},
    )
    db.add(assistant_message)
    advance_state_after_message(
        chat_session=chat_session,
        user_message=payload.message,
        assistant_message=assistant_reply.answer,
        tool_outputs=assistant_reply.tool_outputs,
    )
    chat_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_message)
    db.refresh(chat_session)

    return ChatReplyResponse(
        session=serialize_session(chat_session),
        user_message=serialize_message(user_message),
        assistant_message=serialize_message(assistant_message),
        eligible_products=assistant_reply.eligible_products,
        tool_outputs=assistant_reply.tool_outputs,
        disclaimer=assistant_reply.disclaimer,
    )


@router.post("/sessions/{session_id}/upload", response_model=UploadResponse)
async def upload_pdf(
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF uploads are supported",
        )

    chat_session = get_user_session_or_404(session_id, db, current_user.id)
    extracted_text = extract_text_from_pdf(await file.read())
    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract text from the uploaded PDF",
        )

    summary = await generate_consultation_summary(
        messages_text=(
            "Create a concise document summary for this borrower submission.\n\n"
            f"Document text:\n{extracted_text[:12000]}"
        ),
        state_snapshot=chat_session.state_snapshot or {},
        summary_kind="document",
    )

    document_message = Message(
        session_id=session_id,
        sender_type=SenderType.SYSTEM,
        message=summary,
        meta={
            "tool_called": "pdf_extractor",
            "filename": file.filename,
            "extracted_characters": len(extracted_text),
        },
    )
    db.add(document_message)
    advance_state_after_document(
        chat_session=chat_session,
        filename=file.filename or "uploaded.pdf",
    )
    chat_session.updated_at = datetime.utcnow()
    if not chat_session.summary:
        chat_session.summary = summary
    db.commit()
    db.refresh(document_message)

    return UploadResponse(
        session_id=session_id,
        filename=file.filename or "uploaded.pdf",
        extracted_text_preview=extracted_text[:500],
        summary=summary,
        message=serialize_message(document_message),
    )


@router.post("/sessions/{session_id}/summary", response_model=SummaryResponse)
async def summarize_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SummaryResponse:
    chat_session = get_user_session_or_404(session_id, db, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot summarize an empty conversation",
        )

    conversation_text = "\n".join(
        f"{message.sender_type.value}: {message.message}" for message in messages
    )
    summary = await generate_consultation_summary(
        conversation_text,
        state_snapshot=chat_session.state_snapshot or {},
        summary_kind="conversation",
    )
    advance_state_after_summary(chat_session)
    chat_session.summary = summary
    chat_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(chat_session)

    return SummaryResponse(session_id=session_id, summary=summary)
