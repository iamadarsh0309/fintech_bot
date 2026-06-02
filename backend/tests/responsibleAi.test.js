import test from "node:test";
import assert from "node:assert/strict";

import { SessionIntent } from "../src/constants.js";
import {
  detectRequestedIntent,
  synthesizeAnswer,
  INTENT_REDIRECT_MESSAGE,
} from "../src/services/chatService.js";

const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{20E3}]/gu;
const countWords = (s) => (s.match(/[A-Za-z0-9']+/g) || []).length;

// --- synthesizeAnswer -------------------------------------------------------

test("synthesize renders bullet points", () => {
  const { answer } = synthesizeAnswer(
    "A personal loan suits you. The EMI is affordable. Tenure is flexible.",
    "",
  );
  const lines = answer.split("\n");
  assert.ok(lines.length >= 2);
  lines.forEach((line) => assert.match(line, /^- \S/));
});

test("synthesize strips emojis", () => {
  const { answer } = synthesizeAnswer("Great choice 🎉👍 for you 🚀", "");
  assert.equal(EMOJI_REGEX.test(answer), false);
});

test("synthesize keeps the answer under 150 words", () => {
  const longText = Array.from({ length: 60 }, (_, i) => `Point number ${i} explains a detail.`).join(" ");
  const { answer } = synthesizeAnswer(longText, "");
  assert.ok(countWords(answer) < 150, `word count was ${countWords(answer)}`);
});

test("synthesize neutralizes approval guarantees", () => {
  const { answer } = synthesizeAnswer(
    "You are pre-approved and approval is guaranteed with 100% approval.",
    "",
  );
  const lower = answer.toLowerCase();
  ["guaranteed approval", "pre-approved", "100% approval"].forEach((phrase) =>
    assert.equal(lower.includes(phrase), false, `leaked: ${phrase}`),
  );
});

test("synthesize forces a compliant disclaimer when missing", () => {
  const { disclaimer } = synthesizeAnswer("Some advice.", "");
  const lower = disclaimer.toLowerCase();
  assert.ok(lower.includes("underwriting"));
  assert.ok(lower.includes("verif"));
});

test("synthesize keeps an already-compliant disclaimer", () => {
  const provided = "Subject to underwriting and document verification.";
  const { disclaimer } = synthesizeAnswer("Some advice.", provided);
  assert.equal(disclaimer, provided);
});

test("synthesize never returns an empty answer", () => {
  const { answer } = synthesizeAnswer("", "");
  assert.match(answer, /^- \S/);
});

// --- detectRequestedIntent (intent guard) -----------------------------------

test("off-topic message is flagged as a different intent", () => {
  assert.equal(
    detectRequestedIntent("help me understand mutual funds", SessionIntent.EMI_CALCULATION),
    "OFF_TOPIC",
  );
});

test("a clearly different loan intent is flagged", () => {
  // "compare ... versus" in a FIND_BEST_LOAN session -> COMPARE_LOANS
  assert.equal(
    detectRequestedIntent("compare loan A versus loan B", SessionIntent.FIND_BEST_LOAN),
    SessionIntent.COMPARE_LOANS,
  );
});

test("on-topic message for the session intent is not redirected", () => {
  assert.equal(
    detectRequestedIntent("what would my emi and interest be?", SessionIntent.EMI_CALCULATION),
    null,
  );
});

test("ambiguous/generic message is not redirected", () => {
  assert.equal(
    detectRequestedIntent("can you help me with my loan?", SessionIntent.FIND_BEST_LOAN),
    null,
  );
});

test("redirect message constant is the exact required string", () => {
  assert.equal(INTENT_REDIRECT_MESSAGE, "Please change intent.");
});
