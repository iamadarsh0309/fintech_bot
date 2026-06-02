import { settings } from "../config.js";

const DEFAULT_ANSWER = "I don't have enough information.";

export class LLMService {
  async query({
    prompt,
    metadata = null,
    pdfBase64 = null,
    imageBase64 = null,
    imageMediaType = null,
  }) {
    if (!settings.llmWrapperUrl || !settings.llmWrapperToken) {
      return LLMService.fallbackResponse();
    }

    const payload = { prompt };
    if (metadata) payload.metadata = metadata;
    if (pdfBase64) payload.pdfBase64 = pdfBase64;
    if (imageBase64) {
      payload.imageBase64 = imageBase64;
      payload.imageMediaType = imageMediaType || "image/png";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(
        `${settings.llmWrapperUrl.replace(/\/+$/, "")}/llm/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.llmWrapperToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`LLM wrapper returned ${response.status}`);
      }
      const data = await response.json();
      return this.parseResponse(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  parseResponse(data) {
    const isPlainObject =
      data !== null && typeof data === "object" && !Array.isArray(data);

    if (isPlainObject) {
      // Mirror Python's `or` precedence (falsy values fall through).
      const candidate = data.response || data.answer || data.content;
      const model = String(data.model || data.llm_model || "llm-wrapper");

      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        return {
          answer: (candidate.answer || "").trim() || DEFAULT_ANSWER,
          disclaimer: (candidate.disclaimer || "").trim(),
          model,
          tokens: data.tokens,
        };
      }

      if (typeof candidate === "string") {
        const parsed = LLMService.tryParseJson(candidate);
        if (parsed) {
          return {
            answer: (parsed.answer || "").trim() || DEFAULT_ANSWER,
            disclaimer: (parsed.disclaimer || "").trim(),
            model,
            tokens: data.tokens,
          };
        }
        return {
          answer: candidate.trim(),
          disclaimer: String(data.disclaimer || "").trim(),
          model,
          tokens: data.tokens,
        };
      }
    }

    if (typeof data === "string") {
      const parsed = LLMService.tryParseJson(data);
      if (parsed) {
        return {
          answer: (parsed.answer || "").trim() || DEFAULT_ANSWER,
          disclaimer: (parsed.disclaimer || "").trim(),
          model: "llm-wrapper",
        };
      }
      return { answer: data.trim(), disclaimer: "", model: "llm-wrapper" };
    }

    return LLMService.fallbackResponse();
  }

  static tryParseJson(value) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    const candidates = [trimmed];

    // Models often wrap JSON in a ```json ... ``` markdown fence; unwrap it.
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      candidates.push(fenced[1].trim());
    }

    // Fall back to the first {...} object embedded in surrounding prose.
    const firstObject = trimmed.match(/\{[\s\S]*\}/);
    if (firstObject) {
      candidates.push(firstObject[0]);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // try the next candidate
      }
    }
    return null;
  }

  static fallbackResponse() {
    return {
      answer:
        "I can explain the grounded loan recommendation once the LLM wrapper token is configured. " +
        "The deterministic tools are ready and the recommendation data has already been computed.",
      disclaimer:
        "This guidance is informational only. Final approval depends on lender underwriting, " +
        "document verification, and policy checks.",
      model: "fallback-local",
    };
  }
}

const llmService = new LLMService();

export function getLlmService() {
  return llmService;
}
