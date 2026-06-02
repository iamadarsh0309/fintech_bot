# AI Loan Advisor Chatbot

Full-stack educational fintech prototype with:

- `FastAPI` backend for auth, sessions, messages, internal EMI tools, PDF extraction, and LLM orchestration
- `PostgreSQL + SQLAlchemy` persistence
- `Next.js` frontend for signup/login, borrower intake, chat, summaries, and PDF upload
- External `llm-wrapper` integration for grounded explanations

## System Architecture

The system is split into two apps:

- `backend/`
  - Auth via JWT
  - User-scoped chat sessions and messages
  - Deterministic financial tools for EMI and eligibility
  - PDF text extraction via PyMuPDF
  - Prompt building and calls to the external LLM wrapper
- `frontend/`
  - Simple single-screen operator UI
  - Signup/login
  - New loan advice session form
  - Multi-turn chat
  - Conversation summary trigger
  - PDF upload for document summarization

Request flow for `/sessions/{id}/messages`:

1. User sends a chat message.
2. Backend stores the message under that authenticated user’s session.
3. Backend loads borrower profile, session history, and seeded loan products.
4. Backend runs deterministic tools first:
   - eligibility checker
   - internal EMI calculator
   - tenure trade-off helper
5. Backend builds a grounded prompt using only known catalog data and tool outputs.
6. Backend calls the external LLM wrapper.
7. Backend validates and stores the assistant reply.
8. Frontend renders the reply plus tool outputs and disclaimer.

## Database Schema

### `users`

- `id` UUID-like string primary key
- `username` unique
- `password_hash`
- `created_at`

### `chat_sessions`

- `id`
- `user_id`
- `title`
- `intent`
- `status`
- `loan_amount`
- `loan_purpose`
- `monthly_income`
- `employment_type`
- `existing_monthly_emi`
- `preferred_tenure_months`
- `risk_profile`
- `summary`
- `created_at`
- `updated_at`

### `messages`

- `id`
- `session_id`
- `sender_type`
- `message`
- `metadata`
- `created_at`

### `loan_products`

- `id`
- `name`
- `description`
- `interest_rate`
- `minimum_income`
- `maximum_amount`
- `minimum_tenure`
- `maximum_tenure`
- `eligibility_rules`

## Why The LLM Wrapper Is Used

The assignment already provides a hosted LLM wrapper, so this app does not train or host any model. The backend uses the wrapper for:

- conversational explanations
- grounded recommendation phrasing
- document summaries
- consultation summaries

The backend keeps the wrapper token private and never exposes it to the frontend.

## Prompt Engineering Strategy

Prompt construction now lives in:

- `backend/app/services/prompt_builder.py`

Each LLM request follows the explicit component structure:

- persona
- instruction
- context
- format
- audience
- tone
- data

The system prompt explicitly tells the model:

- use only provided product data
- never invent rates
- never guarantee approval
- rely on calculator output for EMI
- admit when information is missing
- return structured output with `answer` and `disclaimer`

The `data` section includes only grounded inputs:

- borrower profile
- session state snapshot
- eligible products
- deterministic tool outputs
- recent conversation history
- the user’s current question

This makes prompt tuning easy because the orchestration layer is now split into:

- `prompt_builder.py` for prompt shape
- `chat_service.py` for intent-based tool orchestration
- `session_state_service.py` for session state transitions

## Intent And State Handling

Intent is selected at session creation and stored on the session as one of:

- `FIND_BEST_LOAN`
- `COMPARE_LOANS`
- `EMI_CALCULATION`
- `EXPLAIN_LOAN_TERMS`
- `UPLOAD_DOCUMENT`

State is tracked in two places:

- `chat_sessions.status`
- `chat_sessions.state_snapshot`

Current status transitions:

- session create
  - `PROFILE_CAPTURED` by default
  - `AWAITING_DOCUMENT` if the session intent is `UPLOAD_DOCUMENT`
- message exchange
  - moves to `ACTIVE`
  - updates `state_snapshot` with last user message, last assistant message, and tool names used
- document upload
  - marks document as uploaded and moves state to active processing
- summary generation
  - moves to `READY_FOR_SUMMARY`

Intent affects which deterministic tools are executed before the LLM call:

- `FIND_BEST_LOAN`
  - eligibility + EMI + tenure trade-offs
- `COMPARE_LOANS`
  - eligibility + up to 3 EMI comparisons + tenure trade-offs
- `EMI_CALCULATION`
  - EMI only when a grounded eligible rate exists
- `EXPLAIN_LOAN_TERMS`
  - explanatory context with product snapshot, without forcing EMI
- `UPLOAD_DOCUMENT`
  - document workflow guidance + eligibility context

## Hallucination Prevention

This prototype reduces hallucination risk through:

1. Grounding
   - Only seeded catalog data, borrower profile data, and deterministic tool outputs are sent.
2. Deterministic tools
   - EMI and FOIR-based eligibility are computed in code, not by the model.
3. Controlled scope
   - The model is instructed not to invent interest rates, approval status, or missing facts.
4. Structured validation
   - The LLM service accepts either JSON-like output or plain text and normalizes it before returning it to the client.

## Why Calculations Stay Outside The LLM

Financial calculations must be auditable and repeatable. EMI, total interest, total repayment, and FOIR checks are implemented in backend code so they are:

- deterministic
- testable
- explainable
- safe to reuse across conversations

## Why PyMuPDF Is Used

PyMuPDF is a strong fit for this assignment because most salary slips, loan letters, and statements in the prototype scope are text-based PDFs. It extracts embedded text directly without forcing OCR and keeps the implementation lightweight.

## Security Design

- Passwords are hashed with bcrypt through `passlib`.
- Login returns a signed JWT.
- All chat APIs require `Authorization: Bearer <jwt>`.
- Every session and message query is filtered by the authenticated `user_id`.
- User A cannot fetch or post into User B’s sessions.
- The LLM wrapper token lives only in backend environment variables.

## Seeded Loan Products

The backend seeds:

- Personal Loan
- Salary Advance
- BNPL
- SME Loan
- Secured Loan
- Top Up Loan

Sample business rules include minimum income, maximum amount, tenure bounds, FOIR cap, and allowed employment types.

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The default backend expects PostgreSQL at:

```bash
postgresql+psycopg2://postgres:postgres@localhost:5432/fintech_agent
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend default:

- `http://localhost:3000`

Backend default:

- `http://localhost:8000`

Swagger docs:

- `http://localhost:8000/docs`

## LLM Wrapper Configuration

Backend environment:

```bash
LLM_WRAPPER_URL=https://llm-wrapper-741152993481.asia-south1.run.app
LLM_WRAPPER_TOKEN=replace-with-api-token
```

Wrapper endpoint used by the backend:

```bash
POST /llm/query
Authorization: Bearer <api_token>
```

Example payload:

```json
{
  "prompt": "Hello",
  "metadata": {
    "client": "backend",
    "traceId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## API Examples

### Signup

```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"demo_pass_123"}'
```

### Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"demo_pass_123"}'
```

### Create Session

```bash
curl -X POST http://localhost:8000/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "title":"Personal loan planning",
    "intent":"FIND_BEST_LOAN",
    "loan_amount":500000,
    "loan_purpose":"Personal loan",
    "monthly_income":90000,
    "employment_type":"salaried",
    "existing_monthly_emi":15000,
    "preferred_tenure_months":24,
    "risk_profile":"balanced"
  }'
```

### Chat Message

```bash
curl -X POST http://localhost:8000/sessions/SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"message":"Can I reduce my EMI without stretching the tenure too much?"}'
```

### Debug EMI Tool

This endpoint is disabled by default and only mounted when `EXPOSE_DEBUG_ENDPOINTS=true`.

```bash
curl -X POST http://localhost:8000/debug/calculate-emi \
  -H "Content-Type: application/json" \
  -d '{"amount":500000,"interest_rate":11,"months":24}'
```

## Test Cases To Demo

- Salaried borrower with healthy income should qualify for personal loan options.
- Borrower with high existing EMI should see fewer eligible products due to FOIR.
- SME loan should only appear for self-employed or business-owner profiles.
- PDF upload should extract text, summarize it, and append a system message.
- Conversation summary should persist into the session record.

## Future Improvements

- vector-database RAG over product policies and FAQs
- OCR fallback for scanned PDFs
- downloadable recommendation reports
- multilingual and voice interfaces
- refresh-token based auth
- richer output validation with stricter JSON schema enforcement
