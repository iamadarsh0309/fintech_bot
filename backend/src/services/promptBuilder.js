// Builds the component-structured prompts (Persona / Instruction / Context /
// Format / Audience / Tone / Data) sent to the external LLM wrapper.

export function renderPrompt(sections) {
  return (
    "PROMPT STRUCTURE\n\n" +
    `Persona (Identity):\n${sections.persona}\n\n` +
    `Instruction (Main task):\n${sections.instruction}\n\n` +
    `Context (Additional information):\n${sections.context}\n\n` +
    `Format (Output structure):\n${sections.format}\n\n` +
    `Audience (For whom):\n${sections.audience}\n\n` +
    `Tone (Style of text):\n${sections.tone}\n\n` +
    `Data (Ground truth):\n${sections.data}`
  );
}

export function buildChatPrompt({
  intent,
  borrowerProfile,
  stateSnapshot,
  eligibleProducts,
  toolOutputs,
  conversationHistory,
  userQuestion,
}) {
  const instructionMap = {
    FIND_BEST_LOAN:
      "Recommend the most suitable loan options based only on the grounded borrower profile, " +
      "eligible products, and deterministic tool outputs.",
    COMPARE_LOANS:
      "Compare the most relevant eligible loan products and explain trade-offs using only the provided data.",
    EMI_CALCULATION:
      "Explain EMI, total interest, and repayment implications using only the calculator output provided.",
    EXPLAIN_LOAN_TERMS:
      "Explain loan concepts in simple language using only the current borrower context and product data.",
    UPLOAD_DOCUMENT:
      "Use the borrower profile, session state, and any extracted document information to guide the user.",
  };

  const sections = {
    persona:
      "You are a responsible AI loan advisor for an educational fintech application. " +
      "You are careful, grounded, and transparent. You never invent rates, approvals, or eligibility.",
    instruction:
      instructionMap[intent] ||
      "Answer the borrower question using only the grounded context and deterministic tool outputs.",
    context:
      "Rules:\n" +
      "1. Use only the provided catalog data, borrower profile, session state, and tool outputs.\n" +
      "2. Never guarantee approval.\n" +
      "3. If information is missing, say exactly: I don't have enough information.\n" +
      "4. EMI figures must come only from calculator output.\n" +
      `5. Current session intent is ${intent}.\n` +
      `6. Current session state is ${stateSnapshot.stage ?? "UNKNOWN"}.`,
    format:
      "Return valid JSON with this shape:\n" +
      '{\n  "answer": "<plain-language response>",\n  "disclaimer": "<short underwriting disclaimer>"\n}',
    audience:
      "The audience is a borrower evaluating lending options who needs clear, concise, and auditable guidance.",
    tone: "Professional, clear, calm, and non-salesy.",
    data: JSON.stringify(
      {
        borrower_profile: borrowerProfile,
        state_snapshot: stateSnapshot,
        eligible_products: eligibleProducts,
        tool_outputs: toolOutputs,
        conversation_history: conversationHistory.slice(-12),
        user_question: userQuestion,
      },
      null,
      2,
    ),
  };
  return renderPrompt(sections);
}

export function buildSummaryPrompt({ summaryKind, sourceText, stateSnapshot }) {
  const sections = {
    persona:
      "You are a responsible AI assistant that creates concise, audit-friendly financial summaries.",
    instruction:
      "Summarize the financial consultation clearly and concisely. Highlight borrower need, grounded findings, " +
      "key risks, and practical next steps.",
    context:
      `This is a ${summaryKind} summary for a loan advisory workflow. ` +
      `Current session state is ${stateSnapshot.stage ?? "UNKNOWN"}.`,
    format:
      "Write 1 short paragraph followed by 3 bullet points covering recommendations, risks, and next steps.",
    audience:
      "The audience is an internal reviewer or borrower who needs a fast recap of the consultation.",
    tone: "Professional and crisp.",
    data: JSON.stringify(
      {
        state_snapshot: stateSnapshot,
        source_text: sourceText,
      },
      null,
      2,
    ),
  };
  return renderPrompt(sections);
}
