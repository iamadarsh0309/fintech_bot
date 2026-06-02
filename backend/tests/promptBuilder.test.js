import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChatPrompt,
  buildSummaryPrompt,
} from "../src/services/promptBuilder.js";

test("buildChatPrompt uses the component structure", () => {
  const prompt = buildChatPrompt({
    intent: "FIND_BEST_LOAN",
    borrowerProfile: { loan_amount: 500000, monthly_income: 90000 },
    stateSnapshot: { stage: "ADVISORY_IN_PROGRESS" },
    eligibleProducts: [{ name: "Personal Loan", interest_rate: 11.0 }],
    toolOutputs: { emi_calculator: { emi: 23329.0 } },
    conversationHistory: ["USER: help me choose"],
    userQuestion: "What is my best option?",
  });

  assert.ok(prompt.includes("Persona (Identity):"));
  assert.ok(prompt.includes("Instruction (Main task):"));
  assert.ok(prompt.includes("Context (Additional information):"));
  assert.ok(prompt.includes("Format (Output structure):"));
  assert.ok(prompt.includes("Audience (For whom):"));
  assert.ok(prompt.includes("Tone (Style of text):"));
  assert.ok(prompt.includes("Data (Ground truth):"));
  assert.ok(prompt.includes("Current session intent is FIND_BEST_LOAN."));
  assert.ok(prompt.includes('"user_question": "What is my best option?"'));
});

test("buildSummaryPrompt includes state and source text", () => {
  const prompt = buildSummaryPrompt({
    summaryKind: "conversation",
    sourceText: "USER: Can I reduce my EMI?",
    stateSnapshot: { stage: "DOCUMENT_PROCESSED" },
  });

  assert.ok(prompt.includes("conversation summary"));
  assert.ok(prompt.includes("DOCUMENT_PROCESSED"));
  assert.ok(prompt.includes("source_text"));
  assert.ok(prompt.includes("USER: Can I reduce my EMI?"));
});

test("buildChatPrompt limits conversation history to the last 12 items", () => {
  const history = Array.from({ length: 20 }, (_, index) => `USER: message ${index}`);
  const prompt = buildChatPrompt({
    intent: "COMPARE_LOANS",
    borrowerProfile: { loan_amount: 400000 },
    stateSnapshot: { stage: "ADVISORY_IN_PROGRESS" },
    eligibleProducts: [],
    toolOutputs: {},
    conversationHistory: history,
    userQuestion: "Compare options",
  });

  const dataJson = prompt.split("Data (Ground truth):\n")[1];
  const payload = JSON.parse(dataJson);
  assert.equal(payload.conversation_history.length, 12);
  assert.equal(payload.conversation_history[0], "USER: message 8");
});
