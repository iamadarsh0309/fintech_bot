import json

import httpx

from app.services.llm_service import LLMService


def _response(payload):
    request = httpx.Request("POST", "http://testserver/llm/query")
    return httpx.Response(200, json=payload, request=request)


def test_parse_response_plain_string_content_uses_top_level_disclaimer():
    service = LLMService()
    response = _response(
        {
            "response": "A plain text answer that is not JSON.",
            "disclaimer": "Informational only.",
            "model": "wrapper-v3",
        }
    )

    result = service._parse_response(response)

    assert result.answer == "A plain text answer that is not JSON."
    assert result.disclaimer == "Informational only."
    assert result.model == "wrapper-v3"


def test_parse_response_empty_nested_answer_falls_back_to_default_text():
    service = LLMService()
    response = _response({"response": {"answer": "   ", "disclaimer": "Verify first."}})

    result = service._parse_response(response)

    assert result.answer == "I don't have enough information."
    assert result.disclaimer == "Verify first."


def test_parse_response_reads_top_level_answer_field():
    service = LLMService()
    response = _response({"answer": "Direct answer field.", "model": "wrapper-v4"})

    result = service._parse_response(response)

    assert result.answer == "Direct answer field."
    assert result.model == "wrapper-v4"


def test_parse_response_defaults_model_label_when_absent():
    service = LLMService()
    response = _response({"response": {"answer": "Hello", "disclaimer": ""}})

    result = service._parse_response(response)

    assert result.model == "llm-wrapper"


def test_parse_response_passes_through_token_count():
    service = LLMService()
    response = _response({"response": {"answer": "Hi", "disclaimer": ""}, "tokens": 77})

    result = service._parse_response(response)

    assert result.tokens == 77


def test_parse_response_bare_json_string_body():
    service = LLMService()
    body = json.dumps({"answer": "From bare JSON string", "disclaimer": "Check terms."})
    response = _response(body)  # top-level JSON value is itself a string

    result = service._parse_response(response)

    assert result.answer == "From bare JSON string"
    assert result.disclaimer == "Check terms."
    assert result.model == "llm-wrapper"


def test_parse_response_bare_plain_string_body():
    service = LLMService()
    response = _response("Just a plain string body")

    result = service._parse_response(response)

    assert result.answer == "Just a plain string body"
    assert result.disclaimer == ""


def test_parse_response_unexpected_shape_returns_fallback():
    service = LLMService()
    response = _response([1, 2, 3])  # neither dict nor str at top level

    result = service._parse_response(response)

    assert result.model == "fallback-local"


def test_try_parse_json_returns_none_for_invalid_json():
    assert LLMService._try_parse_json("not json at all") is None


def test_try_parse_json_returns_none_for_non_object_json():
    assert LLMService._try_parse_json("[1, 2, 3]") is None


def test_try_parse_json_returns_dict_for_object_json():
    assert LLMService._try_parse_json('{"answer": "ok"}') == {"answer": "ok"}
