import json
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.core.config import settings


@dataclass
class LLMResult:
    answer: str
    disclaimer: str
    model: str
    tokens: Optional[int] = None


class LLMService:
    async def query(
        self,
        *,
        prompt: str,
        metadata: Optional[dict[str, Any]] = None,
        pdf_base64: Optional[str] = None,
        image_base64: Optional[str] = None,
        image_media_type: Optional[str] = None,
    ) -> LLMResult:
        if not settings.llm_wrapper_url or not settings.llm_wrapper_token:
            return self._fallback_response()

        payload: dict[str, Any] = {"prompt": prompt}
        if metadata:
            payload["metadata"] = metadata
        if pdf_base64:
            payload["pdfBase64"] = pdf_base64
        if image_base64:
            payload["imageBase64"] = image_base64
            payload["imageMediaType"] = image_media_type or "image/png"

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                f"{settings.llm_wrapper_url.rstrip('/')}/llm/query",
                headers={
                    "Authorization": f"Bearer {settings.llm_wrapper_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            return self._parse_response(response)

    def _parse_response(self, response: httpx.Response) -> LLMResult:
        data = response.json()
        candidate = None
        if isinstance(data, dict):
            candidate = data.get("response") or data.get("answer") or data.get("content")
            if isinstance(candidate, dict):
                return LLMResult(
                    answer=candidate.get("answer", "").strip() or "I don't have enough information.",
                    disclaimer=candidate.get("disclaimer", "").strip(),
                    model=str(data.get("model") or data.get("llm_model") or "llm-wrapper"),
                    tokens=data.get("tokens"),
                )

            if isinstance(candidate, str):
                parsed = self._try_parse_json(candidate)
                if parsed:
                    return LLMResult(
                        answer=parsed.get("answer", "").strip() or "I don't have enough information.",
                        disclaimer=parsed.get("disclaimer", "").strip(),
                        model=str(data.get("model") or data.get("llm_model") or "llm-wrapper"),
                        tokens=data.get("tokens"),
                    )
                return LLMResult(
                    answer=candidate.strip(),
                    disclaimer=str(data.get("disclaimer") or "").strip(),
                    model=str(data.get("model") or data.get("llm_model") or "llm-wrapper"),
                    tokens=data.get("tokens"),
                )

        if isinstance(data, str):
            parsed = self._try_parse_json(data)
            if parsed:
                return LLMResult(
                    answer=parsed.get("answer", "").strip() or "I don't have enough information.",
                    disclaimer=parsed.get("disclaimer", "").strip(),
                    model="llm-wrapper",
                )
            return LLMResult(answer=data.strip(), disclaimer="", model="llm-wrapper")

        return self._fallback_response()

    @staticmethod
    def _try_parse_json(value: str) -> Optional[dict[str, Any]]:
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    @staticmethod
    def _fallback_response() -> LLMResult:
        return LLMResult(
            answer=(
                "I can explain the grounded loan recommendation once the LLM wrapper token is configured. "
                "The deterministic tools are ready and the recommendation data has already been computed."
            ),
            disclaimer=(
                "This guidance is informational only. Final approval depends on lender underwriting, "
                "document verification, and policy checks."
            ),
            model="fallback-local",
        )


_llm_service = LLMService()


def get_llm_service() -> LLMService:
    return _llm_service
