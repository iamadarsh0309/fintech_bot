import json

import httpx

from app.services.llm_service import LLMService


def make_response(payload):
    request = httpx.Request("POST", "http://testserver/llm/query")
    return httpx.Response(200, json=payload, request=request)


def test_parse_response_reads_nested_json_answer():
    service = LLMService()
    response = make_response(
        {
            "response": {
                "answer": "Grounded answer",
                "disclaimer": "Approval depends on underwriting.",
            },
            "model": "wrapper-v1",
            "tokens": 123,
        }
    )

    result = service._parse_response(response)

    assert result.answer == "Grounded answer"
    assert result.disclaimer == "Approval depends on underwriting."
    assert result.model == "wrapper-v1"
    assert result.tokens == 123


def test_parse_response_reads_json_string_content():
    service = LLMService()
    response = make_response(
        {
            "content": json.dumps(
                {
                    "answer": "Use the personal loan data provided.",
                    "disclaimer": "Final approval depends on verification.",
                }
            ),
            "llm_model": "wrapper-v2",
        }
    )

    result = service._parse_response(response)

    assert result.answer == "Use the personal loan data provided."
    assert result.disclaimer == "Final approval depends on verification."
    assert result.model == "wrapper-v2"


def test_fallback_response_is_safe_and_non_empty():
    result = LLMService._fallback_response()

    assert "token is configured" in result.answer
    assert "Final approval depends on lender underwriting" in result.disclaimer
    assert result.model == "fallback-local"
