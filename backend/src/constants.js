// Enum values mirror the original FastAPI/SQLAlchemy string enums so the API
// contract (and the frontend types) stay identical.

export const SessionStatus = {
  PROFILE_CAPTURED: "PROFILE_CAPTURED",
  ACTIVE: "ACTIVE",
  AWAITING_DOCUMENT: "AWAITING_DOCUMENT",
  READY_FOR_SUMMARY: "READY_FOR_SUMMARY",
  COMPLETED: "COMPLETED",
};

export const SessionIntent = {
  FIND_BEST_LOAN: "FIND_BEST_LOAN",
  COMPARE_LOANS: "COMPARE_LOANS",
  EMI_CALCULATION: "EMI_CALCULATION",
  EXPLAIN_LOAN_TERMS: "EXPLAIN_LOAN_TERMS",
  UPLOAD_DOCUMENT: "UPLOAD_DOCUMENT",
};

export const SenderType = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
  SYSTEM: "SYSTEM",
};

export const SESSION_STATUS_VALUES = Object.values(SessionStatus);
export const SESSION_INTENT_VALUES = Object.values(SessionIntent);
export const SENDER_TYPE_VALUES = Object.values(SenderType);
