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

  const metadata = {
    llm_model: llmResult.model,
    tool_called: Object.keys(toolOutputs).join(","),
    tokens: llmResult.tokens ?? null,
    eligible_products_count: eligibleProducts.length,
    prompt_version: "component-structured-v1",
  };

  return {
    answer: llmResult.answer,
    disclaimer: llmResult.disclaimer || DEFAULT_DISCLAIMER,
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
