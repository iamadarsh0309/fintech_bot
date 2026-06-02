import { SessionIntent, SessionStatus } from "../constants.js";

export function initializeSessionState(chatSession) {
  let stage = "PROFILE_CAPTURED";
  let status = SessionStatus.PROFILE_CAPTURED;
  if (chatSession.intent === SessionIntent.UPLOAD_DOCUMENT) {
    stage = "AWAITING_DOCUMENT_UPLOAD";
    status = SessionStatus.AWAITING_DOCUMENT;
  }

  const snapshot = {
    stage,
    intent: chatSession.intent,
    profile_complete: true,
    document_uploaded: false,
    last_user_message: null,
    last_assistant_message: null,
    last_tool_names: [],
    updated_at: new Date().toISOString(),
  };
  chatSession.status = status;
  chatSession.state_snapshot = snapshot;
  return snapshot;
}

export function advanceStateAfterMessage({
  chatSession,
  userMessage,
  assistantMessage,
  toolOutputs,
}) {
  const snapshot = {
    ...(chatSession.state_snapshot || {}),
    stage: "ADVISORY_IN_PROGRESS",
    intent: chatSession.intent,
    last_user_message: userMessage,
    last_assistant_message: assistantMessage,
    last_tool_names: Object.keys(toolOutputs).sort(),
    updated_at: new Date().toISOString(),
  };

  if (
    chatSession.intent === SessionIntent.UPLOAD_DOCUMENT &&
    !snapshot.document_uploaded
  ) {
    chatSession.status = SessionStatus.AWAITING_DOCUMENT;
  } else {
    chatSession.status = SessionStatus.ACTIVE;
  }

  chatSession.state_snapshot = snapshot;
  return snapshot;
}

export function advanceStateAfterDocument({ chatSession, filename }) {
  const snapshot = {
    ...(chatSession.state_snapshot || {}),
    stage: "DOCUMENT_PROCESSED",
    document_uploaded: true,
    document_name: filename,
    updated_at: new Date().toISOString(),
  };
  chatSession.status = SessionStatus.ACTIVE;
  chatSession.state_snapshot = snapshot;
  return snapshot;
}

export function advanceStateAfterSummary(chatSession) {
  const snapshot = {
    ...(chatSession.state_snapshot || {}),
    stage: "SUMMARY_READY",
    summary_ready: true,
    updated_at: new Date().toISOString(),
  };
  chatSession.status = SessionStatus.READY_FOR_SUMMARY;
  chatSession.state_snapshot = snapshot;
  return snapshot;
}
