import test from "node:test";
import assert from "node:assert/strict";

import { LLMService } from "../src/services/llmService.js";

const service = new LLMService();

test("plain string content uses top-level disclaimer", () => {
  const result = service.parseResponse({
    response: "A plain text answer that is not JSON.",
    disclaimer: "Informational only.",
    model: "wrapper-v3",
  });
  assert.equal(result.answer, "A plain text answer that is not JSON.");
  assert.equal(result.disclaimer, "Informational only.");
  assert.equal(result.model, "wrapper-v3");
});

test("empty nested answer falls back to default text", () => {
  const result = service.parseResponse({
    response: { answer: "   ", disclaimer: "Verify first." },
  });
  assert.equal(result.answer, "I don't have enough information.");
  assert.equal(result.disclaimer, "Verify first.");
});

test("reads top-level answer field", () => {
  const result = service.parseResponse({
    answer: "Direct answer field.",
    model: "wrapper-v4",
  });
  assert.equal(result.answer, "Direct answer field.");
  assert.equal(result.model, "wrapper-v4");
});

test("defaults model label when absent", () => {
  const result = service.parseResponse({
    response: { answer: "Hello", disclaimer: "" },
  });
  assert.equal(result.model, "llm-wrapper");
});

test("passes through token count", () => {
  const result = service.parseResponse({
    response: { answer: "Hi", disclaimer: "" },
    tokens: 77,
  });
  assert.equal(result.tokens, 77);
});

test("bare JSON string body", () => {
  const body = JSON.stringify({
    answer: "From bare JSON string",
    disclaimer: "Check terms.",
  });
  const result = service.parseResponse(body);
  assert.equal(result.answer, "From bare JSON string");
  assert.equal(result.disclaimer, "Check terms.");
  assert.equal(result.model, "llm-wrapper");
});

test("bare plain string body", () => {
  const result = service.parseResponse("Just a plain string body");
  assert.equal(result.answer, "Just a plain string body");
  assert.equal(result.disclaimer, "");
});

test("unexpected shape returns fallback", () => {
  const result = service.parseResponse([1, 2, 3]);
  assert.equal(result.model, "fallback-local");
});

test("tryParseJson returns null for invalid JSON", () => {
  assert.equal(LLMService.tryParseJson("not json at all"), null);
});

test("tryParseJson returns null for non-object JSON", () => {
  assert.equal(LLMService.tryParseJson("[1, 2, 3]"), null);
});

test("tryParseJson returns object for object JSON", () => {
  assert.deepEqual(LLMService.tryParseJson('{"answer": "ok"}'), { answer: "ok" });
});

test("tryParseJson unwraps a ```json fenced block", () => {
  const fenced = '```json\n{"answer": "hi", "disclaimer": "d"}\n```';
  assert.deepEqual(LLMService.tryParseJson(fenced), { answer: "hi", disclaimer: "d" });
});

test("tryParseJson extracts a JSON object embedded in prose", () => {
  const messy = 'Here you go:\n{"answer": "hi"}\nHope that helps!';
  assert.deepEqual(LLMService.tryParseJson(messy), { answer: "hi" });
});

test("parseResponse unwraps a fenced JSON answer from response field", () => {
  const service = new LLMService();
  const result = service.parseResponse({
    response: '```json\n{"answer": "Grounded reply.", "disclaimer": "Subject to underwriting."}\n```',
    model: "wrapper-v5",
  });
  assert.equal(result.answer, "Grounded reply.");
  assert.equal(result.disclaimer, "Subject to underwriting.");
  assert.equal(result.model, "wrapper-v5");
});
