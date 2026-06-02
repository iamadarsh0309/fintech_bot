import test from "node:test";
import assert from "node:assert/strict";

import { SessionIntent, SessionStatus } from "../src/constants.js";
import {
  advanceStateAfterDocument,
  advanceStateAfterMessage,
  advanceStateAfterSummary,
  initializeSessionState,
} from "../src/services/sessionStateService.js";

function buildSession(intent) {
  return {
    user_id: "user-1",
    title: "Loan session",
    intent,
    loan_amount: 500000,
    loan_purpose: "Personal loan",
    monthly_income: 90000,
    employment_type: "salaried",
    existing_monthly_emi: 10000,
    preferred_tenure_months: 24,
    risk_profile: "balanced",
    state_snapshot: {},
    status: undefined,
  };
}

test("initializeSessionState for a standard intent", () => {
  const session = buildSession(SessionIntent.FIND_BEST_LOAN);
  const snapshot = initializeSessionState(session);

  assert.equal(session.status, SessionStatus.PROFILE_CAPTURED);
  assert.equal(snapshot.stage, "PROFILE_CAPTURED");
  assert.equal(snapshot.profile_complete, true);
  assert.equal(snapshot.document_uploaded, false);
});

test("initializeSessionState for the upload-document intent", () => {
  const session = buildSession(SessionIntent.UPLOAD_DOCUMENT);
  const snapshot = initializeSessionState(session);

  assert.equal(session.status, SessionStatus.AWAITING_DOCUMENT);
  assert.equal(snapshot.stage, "AWAITING_DOCUMENT_UPLOAD");
});

test("advanceStateAfterMessage tracks latest messages and tools", () => {
  const session = buildSession(SessionIntent.FIND_BEST_LOAN);
  initializeSessionState(session);

  const snapshot = advanceStateAfterMessage({
    chatSession: session,
    userMessage: "What is my best option?",
    assistantMessage: "Personal Loan looks strongest.",
    toolOutputs: { eligibility_checker: {}, emi_calculator: {} },
  });

  assert.equal(session.status, SessionStatus.ACTIVE);
  assert.equal(snapshot.stage, "ADVISORY_IN_PROGRESS");
  assert.equal(snapshot.last_user_message, "What is my best option?");
  assert.equal(snapshot.last_assistant_message, "Personal Loan looks strongest.");
  assert.deepEqual(snapshot.last_tool_names, ["eligibility_checker", "emi_calculator"]);
});

test("advanceStateAfterDocument marks the document uploaded", () => {
  const session = buildSession(SessionIntent.UPLOAD_DOCUMENT);
  initializeSessionState(session);

  const snapshot = advanceStateAfterDocument({
    chatSession: session,
    filename: "salary-slip.pdf",
  });

  assert.equal(session.status, SessionStatus.ACTIVE);
  assert.equal(snapshot.stage, "DOCUMENT_PROCESSED");
  assert.equal(snapshot.document_uploaded, true);
  assert.equal(snapshot.document_name, "salary-slip.pdf");
});

test("advanceStateAfterSummary marks the summary ready", () => {
  const session = buildSession(SessionIntent.FIND_BEST_LOAN);
  initializeSessionState(session);

  const snapshot = advanceStateAfterSummary(session);

  assert.equal(session.status, SessionStatus.READY_FOR_SUMMARY);
  assert.equal(snapshot.stage, "SUMMARY_READY");
  assert.equal(snapshot.summary_ready, true);
});
