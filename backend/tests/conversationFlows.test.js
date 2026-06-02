import test from "node:test";
import assert from "node:assert/strict";

// Force the deterministic local fallback LLM (no network) for these flow tests.
// Must be set before chatService -> llmService -> config is evaluated, so the
// modules are imported dynamically after the assignment.
process.env.LLM_WRAPPER_TOKEN = "";

const { SessionIntent } = await import("../src/constants.js");
const { generateAssistantReply, INTENT_REDIRECT_MESSAGE } = await import(
  "../src/services/chatService.js"
);
const { LLMService } = await import("../src/services/llmService.js");
const { SEED_PRODUCTS } = await import("../src/services/seed.js");
const { initializeSessionState } = await import(
  "../src/services/sessionStateService.js"
);

const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{20E3}]/gu;
const countWords = (s) => (s.match(/[A-Za-z0-9']+/g) || []).length;
const RAW_FALLBACK = LLMService.fallbackResponse().answer;

function makeSession(intent) {
  const session = {
    id: `sess-${intent}`,
    intent,
    loan_amount: 500000,
    loan_purpose: "Personal loan",
    monthly_income: 90000,
    employment_type: "salaried",
    existing_monthly_emi: 15000,
    preferred_tenure_months: 24,
    risk_profile: "balanced",
    state_snapshot: {},
    status: undefined,
  };
  initializeSessionState(session);
  return session;
}

// 12 on-topic user messages for each intent (> 10 messages per conversation).
const CONVERSATIONS = {
  [SessionIntent.EMI_CALCULATION]: [
    "What is my EMI for this loan?",
    "How much interest will I pay over the tenure?",
    "What is the total repayment amount?",
    "Can you break down my monthly payment?",
    "How does the EMI change with a longer tenure?",
    "What is the total cost of this loan?",
    "Is the EMI affordable for my income?",
    "How much interest is in each installment?",
    "What EMI would a 36-month tenure give?",
    "Show the repayment schedule summary.",
    "Does the EMI include processing fees?",
    "What is the EMI difference for 12 versus 24 months?",
  ],
  [SessionIntent.COMPARE_LOANS]: [
    "Compare my best loan options.",
    "Show a comparison of interest rates.",
    "Personal loan versus top-up loan, please compare.",
    "Compare tenure options side by side.",
    "Give me a comparison table of products.",
    "Compare total repayment across products.",
    "Compare which option is better for low risk.",
    "Compare EMI across the eligible products.",
    "Comparison of secured versus unsecured loans?",
    "Compare the cheapest options for me.",
    "Compare short and long tenure outcomes.",
    "Compare processing costs across loans.",
  ],
  [SessionIntent.FIND_BEST_LOAN]: [
    "Which loan is best for me?",
    "Recommend a suitable product.",
    "Am I eligible for a personal loan?",
    "What are my best options?",
    "Do I qualify for a secured loan?",
    "Which loan suits my profile?",
    "Recommend the safest option for me.",
    "What is the most suitable loan?",
    "Which option best fits my income?",
    "Am I eligible given my existing EMI?",
    "Recommend a loan for home renovation.",
    "Which loan should I pick?",
  ],
  [SessionIntent.EXPLAIN_LOAN_TERMS]: [
    "What is FOIR?",
    "Explain how interest works.",
    "What is the meaning of tenure?",
    "Define secured loan.",
    "Explain the term collateral.",
    "What is a top-up loan?",
    "Explain FOIR in simple words.",
    "What is the definition of principal?",
    "Explain what processing fee means.",
    "What is loan tenure?",
    "Define the term EMI.",
    "Explain eligibility criteria.",
  ],
  [SessionIntent.UPLOAD_DOCUMENT]: [
    "How do I upload my document?",
    "Can I attach my salary slip?",
    "I want to upload a PDF.",
    "Where do I submit my bank statement?",
    "Upload my income document.",
    "Attach the latest salary slip.",
    "Can you read my uploaded statement?",
    "I will upload the PDF now.",
    "Process my document please.",
    "Here is my salary slip to attach.",
    "Upload bank statement for review.",
    "Submit the document for analysis.",
  ],
};

function assertSynthesized(reply, label) {
  // No raw model text leaks through.
  assert.notEqual(reply.answer, RAW_FALLBACK, `${label}: raw answer leaked`);
  assert.notEqual(reply.answer, "", `${label}: empty answer`);
  // Bullet-point format.
  const lines = reply.answer.split("\n");
  assert.ok(lines.length >= 1, `${label}: no lines`);
  lines.forEach((line) => assert.match(line, /^- \S/, `${label}: not a bullet`));
  // No emojis.
  assert.equal(EMOJI_REGEX.test(reply.answer), false, `${label}: emoji present`);
  // Under 150 words.
  assert.ok(countWords(reply.answer) < 150, `${label}: >= 150 words`);
  // Compliant disclaimer.
  const d = reply.disclaimer.toLowerCase();
  assert.ok(d.includes("underwriting") && d.includes("verif"), `${label}: weak disclaimer`);
  // On-topic turns are not redirected.
  assert.notEqual(reply.answer, INTENT_REDIRECT_MESSAGE, `${label}: unexpected redirect`);
}

for (const [intent, messages] of Object.entries(CONVERSATIONS)) {
  test(`${intent}: ${messages.length}-message conversation, every reply synthesized`, async () => {
    assert.ok(messages.length > 10, "conversation must exceed 10 messages");
    const session = makeSession(intent);
    const history = [];

    for (let turn = 0; turn < messages.length; turn += 1) {
      const userMessage = messages[turn];
      history.push({ sender_type: "USER", message: userMessage });

      const reply = await generateAssistantReply({
        chatSession: session,
        userMessage,
        products: SEED_PRODUCTS,
        messageHistory: history,
      });

      assertSynthesized(reply, `${intent} turn ${turn + 1}`);
      history.push({ sender_type: "ASSISTANT", message: reply.answer });
    }

    // Full multi-turn transcript retained (user + assistant for each turn).
    assert.equal(history.length, messages.length * 2);
  });
}

test("off-topic question in any session returns the fixed redirect", async () => {
  const session = makeSession(SessionIntent.EMI_CALCULATION);
  const reply = await generateAssistantReply({
    chatSession: session,
    userMessage: "Can you help me invest in mutual funds and stocks?",
    products: SEED_PRODUCTS,
    messageHistory: [],
  });
  assert.equal(reply.answer, "Please change intent.");
  assert.equal(reply.metadata.llm_model, "intent-guard");
});

test("different loan intent returns the fixed redirect", async () => {
  const session = makeSession(SessionIntent.FIND_BEST_LOAN);
  const reply = await generateAssistantReply({
    chatSession: session,
    userMessage: "Compare personal loan versus top-up loan.",
    products: SEED_PRODUCTS,
    messageHistory: [],
  });
  assert.equal(reply.answer, "Please change intent.");
});
