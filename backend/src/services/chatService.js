import { SessionIntent } from "../constants.js";
import { getLlmService } from "./llmService.js";
import { buildChatPrompt, buildSummaryPrompt } from "./promptBuilder.js";
import {
  calculateEmi,
  compareTenureOutlook,
  findEligibleProducts,
} from "./recommendationService.js";

export const DEFAULT_DISCLAIMER =
  "This guidance is informational only. Final approval depends on lender underwriting, " +
  "document verification, and policy checks.";

// Responsible-AI guard (assignment §3/§4/§6/§7): the model must never promise
// or guarantee approval. These rewrites neutralize over-promising language into
// grounded, hedged phrasing. Ordered specific -> general; replacements are
// deliberately free of any phrase we treat as banned so we never reintroduce
// one. Case-insensitive, global.
const APPROVAL_GUARANTEE_PATTERNS = [
  [/\bapproval\s+is\s+guaranteed\b/gi, "approval depends on underwriting"],
  [
    /\b(?:100%\s*|fully\s*|completely\s*)?guaranteed\s+(?:loan\s+)?approval\b/gi,
    "possible eligibility, subject to underwriting",
  ],
  [
    /\bguaranteed\s+to\s+(?:be\s+approved|get\s+approved|qualify)\b/gi,
    "may qualify, subject to underwriting",
  ],
  [/\bpre[\s-]?approved\b/gi, "potentially eligible"],
  [
    /\b(?:assured|instant|immediate|sure[\s-]?shot)\s+approval\b/gi,
    "possible eligibility, subject to verification",
  ],
  [/\b100%\s+approval\b/gi, "eligibility subject to underwriting"],
  [
    /\byou(?:'re|\s+are|\s+will(?:\s+(?:surely|definitely|certainly))?\s+be)\s+approved\b/gi,
    "you may be eligible, subject to underwriting",
  ],
  [
    /\b(?:definitely|surely|certainly|absolutely)\s+(?:qualify|be\s+approved|get\s+approved)\b/gi,
    "may qualify, subject to underwriting",
  ],
  [/\brisk[\s-]?free\b/gi, "carries some risk"],
  [
    /\b(?:no\s+rejection|cannot\s+be\s+rejected|won'?t\s+be\s+rejected|will\s+not\s+be\s+rejected)\b/gi,
    "rejection remains possible",
  ],
];

// Guarantee a disclaimer that names both underwriting and verification (§4.6).
function ensureDisclaimer(disclaimer) {
  const text = (disclaimer || "").trim();
  const lower = text.toLowerCase();
  if (text && lower.includes("underwriting") && lower.includes("verif")) {
    return text;
  }
  return DEFAULT_DISCLAIMER;
}

function neutralizeGuarantees(text) {
  let cleaned = typeof text === "string" ? text : "";
  for (const [pattern, replacement] of APPROVAL_GUARANTEE_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

// Remove emojis / pictographs (and stray variation selectors) from the answer.
const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{20E3}]/gu;

function stripEmojis(text) {
  return text.replace(EMOJI_REGEX, "");
}

// Split a free-form answer into discrete points: prefer existing bullet/numbered
// lines, otherwise fall back to sentence segmentation.
function toBulletPoints(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let points = lines
    .filter((line) => /^([-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);

  if (points.length === 0) {
    points = text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim().replace(/[.\s]+$/, "").trim())
      .filter(Boolean);
  }
  return points;
}

const MAX_ANSWER_WORDS = 140; // keep the rendered answer comfortably under 150

function countWords(text) {
  return (text.match(/[A-Za-z0-9']+/g) || []).length;
}

function limitToWordBudget(points, maxWords) {
  const kept = [];
  let used = 0;
  for (const point of points) {
    const words = countWords(point);
    if (used + words > maxWords) {
      if (kept.length === 0) {
        kept.push(point.split(/\s+/).slice(0, maxWords).join(" "));
      }
      break;
    }
    kept.push(point);
    used += words;
  }
  return kept;
}

// The single output gate every LLM-generated assistant message passes through.
// Guarantees: neutralized approval language, no emojis, bullet-point format,
// under 150 words, and a compliant disclaimer. Raw model text is never returned
// directly to the client.
export function synthesizeAnswer(rawAnswer, disclaimer) {
  const cleaned = neutralizeGuarantees(stripEmojis(typeof rawAnswer === "string" ? rawAnswer : ""));
  let points = toBulletPoints(cleaned)
    .map((point) => point.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);
  if (points.length === 0) {
    points = ["I don't have enough information to advise on this yet."];
  }
  points = limitToWordBudget(points, MAX_ANSWER_WORDS);
  const answer = points.map((point) => `- ${point}`).join("\n");
  return { answer, disclaimer: ensureDisclaimer(disclaimer) };
}

// Lightweight intent guard (assignment §4 — keep the session on-topic). If the
// user's message clearly targets a different loan intent, or is off-topic for
// lending entirely, the advisor replies with a fixed redirect instead of
// answering. Tuned to avoid false positives: we only redirect when another
// intent dominates and the current intent has no signal in the message.
const OFF_TOPIC_TERMS = [
  "mutual fund",
  "mutual funds",
  "stock",
  "stocks",
  "equity",
  "shares",
  "crypto",
  "bitcoin",
  "insurance",
  "sip",
  "trading",
  "forex",
  "fixed deposit",
  "gold etf",
  "tax saving",
  "demat",
];

// Broad lending vocabulary. A substantive message that contains none of these
// is treated as off-topic (this also catches typos like "myutual funds" that a
// fixed off-topic list would miss).
const LENDING_VOCAB = [
  "loan",
  "emi",
  "installment",
  "instalment",
  "interest",
  "tenure",
  "repay",
  "repayment",
  "principal",
  "eligib",
  "qualify",
  "income",
  "salary",
  "borrow",
  "credit",
  "financ",
  "finance",
  "foir",
  "collateral",
  "secured",
  "unsecured",
  "bnpl",
  "advance",
  "top-up",
  "topup",
  "top up",
  "product",
  "rate",
  "amount",
  "afford",
  "debt",
  "fee",
  "document",
  "pdf",
  "statement",
  "upload",
  "lender",
  "underwriting",
  "approval",
  "compare",
  "option",
  "best",
  "suitable",
  "recommend",
  "personal",
  "sme",
];

const INTENT_KEYWORDS = {
  [SessionIntent.EMI_CALCULATION]: [
    "emi",
    "installment",
    "instalment",
    "monthly payment",
    "repayment",
    "interest",
    "total cost",
  ],
  [SessionIntent.COMPARE_LOANS]: [
    "compare",
    "comparison",
    "versus",
    " vs ",
    "difference between",
    "which is better",
  ],
  [SessionIntent.FIND_BEST_LOAN]: [
    "best",
    "suitable",
    "recommend",
    "which loan",
    "eligible",
    "qualify",
    "options",
  ],
  [SessionIntent.EXPLAIN_LOAN_TERMS]: [
    "what is",
    "explain",
    "meaning",
    "define",
    "definition",
    "term",
    "foir",
  ],
  [SessionIntent.UPLOAD_DOCUMENT]: [
    "upload",
    "document",
    "pdf",
    "salary slip",
    "statement",
    "attach",
  ],
};

export const INTENT_REDIRECT_MESSAGE = "Please change intent.";

export function detectRequestedIntent(message, sessionIntent) {
  const text = ` ${String(message || "").toLowerCase()} `;

  if (OFF_TOPIC_TERMS.some((term) => text.includes(term))) {
    return "OFF_TOPIC";
  }

  const scores = {};
  let totalIntentScore = 0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    scores[intent] = keywords.filter((kw) => text.includes(kw)).length;
    totalIntentScore += scores[intent];
  }

  // A substantive message with zero lending vocabulary (and no intent signal)
  // is off-topic — catches typos like "myutual funds" a fixed list would miss.
  const wordCount = (text.match(/[a-z0-9']+/g) || []).length;
  const mentionsLending =
    totalIntentScore > 0 || LENDING_VOCAB.some((term) => text.includes(term));
  if (wordCount >= 3 && !mentionsLending) {
    return "OFF_TOPIC";
  }

  const sessionScore = scores[sessionIntent] || 0;
  let topOther = null;
  let topOtherScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (intent !== sessionIntent && score > topOtherScore) {
      topOther = intent;
      topOtherScore = score;
    }
  }

  if (sessionScore === 0 && topOtherScore > 0) {
    return topOther;
  }
  return null;
}

function serializeSessionProfile(chatSession) {
  return {
    loan_amount: Number(chatSession.loan_amount),
    loan_purpose: chatSession.loan_purpose,
    monthly_income: Number(chatSession.monthly_income),
    employment_type: chatSession.employment_type,
    existing_monthly_emi: Number(chatSession.existing_monthly_emi),
    preferred_tenure_months: chatSession.preferred_tenure_months,
    risk_profile: chatSession.risk_profile,
    intent: chatSession.intent,
  };
}

function buildToolOutputs({ chatSession, eligibleProducts }) {
  const toolOutputs = {};
  const amount = Number(chatSession.loan_amount);
  const months = chatSession.preferred_tenure_months;
  const stateSnapshot = chatSession.state_snapshot || {};

  if (chatSession.intent === SessionIntent.FIND_BEST_LOAN) {
    toolOutputs.eligibility_checker = eligibleProducts;
    toolOutputs.tenure_tradeoffs = compareTenureOutlook(
      months,
      chatSession.risk_profile,
    );
    if (eligibleProducts.length > 0) {
      toolOutputs.emi_calculator = calculateEmi(
        amount,
        eligibleProducts[0].interest_rate,
        months,
      );
    }
  } else if (chatSession.intent === SessionIntent.COMPARE_LOANS) {
    toolOutputs.eligibility_checker = eligibleProducts;
    toolOutputs.loan_comparisons = eligibleProducts.slice(0, 3).map((product) => ({
      product_name: product.name,
      interest_rate: product.interest_rate,
      emi_scenario: calculateEmi(amount, product.interest_rate, months),
    }));
    toolOutputs.tenure_tradeoffs = compareTenureOutlook(
      months,
      chatSession.risk_profile,
    );
  } else if (chatSession.intent === SessionIntent.EMI_CALCULATION) {
    if (eligibleProducts.length > 0) {
      toolOutputs.emi_calculator = calculateEmi(
        amount,
        eligibleProducts[0].interest_rate,
        months,
      );
    } else {
      toolOutputs.emi_calculator_unavailable = {
        reason:
          "No grounded product/rate is available for this borrower profile yet.",
      };
    }
    toolOutputs.tenure_tradeoffs = compareTenureOutlook(
      months,
      chatSession.risk_profile,
    );
  } else if (chatSession.intent === SessionIntent.EXPLAIN_LOAN_TERMS) {
    toolOutputs.eligible_products_snapshot = eligibleProducts.slice(0, 3);
    toolOutputs.term_explainer_context = {
      loan_amount: amount,
      preferred_tenure_months: months,
      existing_monthly_emi: Number(chatSession.existing_monthly_emi),
    };
  } else if (chatSession.intent === SessionIntent.UPLOAD_DOCUMENT) {
    const documentUploaded = Boolean(stateSnapshot.document_uploaded);
    toolOutputs.document_workflow = {
      document_uploaded: documentUploaded,
      next_step: documentUploaded
        ? "Analyze the uploaded document against the borrower profile."
        : "Ask the user to upload a PDF document for extraction.",
    };
    toolOutputs.eligibility_checker = eligibleProducts;
  } else {
    toolOutputs.eligibility_checker = eligibleProducts;
  }

  return toolOutputs;
}

export async function generateAssistantReply({
  chatSession,
  userMessage,
  products,
  messageHistory,
}) {
  // Intent guard: redirect off-topic / different-intent requests without
  // invoking the LLM (assignment §4). Fixed control message — not synthesized.
  const requestedIntent = detectRequestedIntent(userMessage, chatSession.intent);
  if (requestedIntent) {
    return {
      answer: INTENT_REDIRECT_MESSAGE,
      disclaimer: DEFAULT_DISCLAIMER,
      eligible_products: [],
      tool_outputs: {},
      metadata: {
        llm_model: "intent-guard",
        tool_called: "",
        tokens: null,
        eligible_products_count: 0,
        prompt_version: "intent-guard-v1",
        requested_intent: requestedIntent,
      },
      prompt: "",
    };
  }

  const eligibleProducts = findEligibleProducts({
    products,
    monthlyIncome: Number(chatSession.monthly_income),
    existingMonthlyEmi: Number(chatSession.existing_monthly_emi),
    loanAmount: Number(chatSession.loan_amount),
    employmentType: chatSession.employment_type,
    preferredTenureMonths: chatSession.preferred_tenure_months,
  });
  const toolOutputs = buildToolOutputs({ chatSession, eligibleProducts });
  const conversationHistory = messageHistory
    .slice(-12)
    .map((item) => `${item.sender_type}: ${item.message}`);
  const prompt = buildChatPrompt({
    intent: chatSession.intent,
    borrowerProfile: serializeSessionProfile(chatSession),
    stateSnapshot: chatSession.state_snapshot || {},
    eligibleProducts,
    toolOutputs,
    conversationHistory,
    userQuestion: userMessage,
  });
  const llmResult = await getLlmService().query({
    prompt,
    metadata: {
      intent: chatSession.intent,
      sessionId: chatSession.id,
      toolCount: Object.keys(toolOutputs).length,
    },
  });

  const safe = synthesizeAnswer(llmResult.answer, llmResult.disclaimer);

  const metadata = {
    llm_model: llmResult.model,
    tool_called: Object.keys(toolOutputs).join(","),
    tokens: llmResult.tokens ?? null,
    eligible_products_count: eligibleProducts.length,
    prompt_version: "component-structured-v1",
  };

  return {
    answer: safe.answer,
    disclaimer: safe.disclaimer,
    eligible_products: eligibleProducts,
    tool_outputs: toolOutputs,
    metadata,
    prompt,
  };
}

export async function generateConsultationSummary(
  messagesText,
  { stateSnapshot, summaryKind },
) {
  const prompt = buildSummaryPrompt({
    summaryKind,
    sourceText: messagesText,
    stateSnapshot,
  });
  const llmResult = await getLlmService().query({
    prompt,
    metadata: { purpose: "conversation-summary", summaryKind },
  });
  return llmResult.answer;
}
