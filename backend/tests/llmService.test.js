import test from "node:test";
import assert from "node:assert/strict";

import { LLMService } from "../src/services/llmService.js";

test("parseResponse reads nested object answer", () => {
  const service = new LLMService();
  const result = service.parseResponse({
    response: {
      answer: "Grounded answer",
      disclaimer: "Approval depends on underwriting.",
    },
    model: "wrapper-v1",
    tokens: 123,
  });

  assert.equal(result.answer, "Grounded answer");
  assert.equal(result.disclaimer, "Approval depends on underwriting.");
  assert.equal(result.model, "wrapper-v1");
  assert.equal(result.tokens, 123);
});

test("parseResponse reads JSON string content", () => {
  const service = new LLMService();
  const result = service.parseResponse({
    content: JSON.stringify({
      answer: "Use the personal loan data provided.",
      disclaimer: "Final approval depends on verification.",
    }),
    llm_model: "wrapper-v2",
  });

  assert.equal(result.answer, "Use the personal loan data provided.");
  assert.equal(result.disclaimer, "Final approval depends on verification.");
  assert.equal(result.model, "wrapper-v2");
});

test("fallbackResponse is safe and non-empty", () => {
  const result = LLMService.fallbackResponse();
  assert.ok(result.answer.includes("token is configured"));
  assert.ok(result.disclaimer.includes("Final approval depends on lender underwriting"));
  assert.equal(result.model, "fallback-local");
});
