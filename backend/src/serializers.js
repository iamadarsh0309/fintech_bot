function toIso(value) {
  if (!value) return value;
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeMessage(message) {
  return {
    id: message.id,
    session_id: message.session_id,
    sender_type: message.sender_type,
    message: message.message,
    metadata: message.metadata || {},
    created_at: toIso(message.created_at),
  };
}

export function serializeSession(chatSession) {
  return {
    id: chatSession.id,
    user_id: chatSession.user_id,
    title: chatSession.title,
    intent: chatSession.intent,
    status: chatSession.status,
    loan_amount: Number(chatSession.loan_amount),
    loan_purpose: chatSession.loan_purpose,
    monthly_income: Number(chatSession.monthly_income),
    employment_type: chatSession.employment_type,
    existing_monthly_emi: Number(chatSession.existing_monthly_emi),
    preferred_tenure_months: chatSession.preferred_tenure_months,
    risk_profile: chatSession.risk_profile,
    summary: chatSession.summary ?? null,
    state_snapshot: chatSession.state_snapshot || {},
    created_at: toIso(chatSession.created_at),
    updated_at: toIso(chatSession.updated_at),
  };
}
