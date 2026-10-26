from typing import TypeVar

import structlog
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class ModelOutputError(Exception):
    pass


class NebiusProvider:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.NEBIUS_API_KEY,
            base_url=settings.NEBIUS_BASE_URL,
            timeout=120.0,
            max_retries=1,
        )

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
    ) -> T:
        last_error: Exception | None = None

        for attempt in range(1, 3):
            response = await self.client.chat.completions.create(
                model=settings.NEBIUS_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema.__name__,
                        "strict": True,
                        "schema": schema.model_json_schema(),
                    },
                },
            )

            choice = response.choices[0]
            content = choice.message.content or ""

            if choice.finish_reason == "length":
                last_error = ModelOutputError("Model response exceeded output token limit")
                continue

            if not content.strip():
                last_error = ModelOutputError("Model returned empty structured output")
                continue

            try:
                return schema.model_validate_json(content)

            except (ValidationError, ValueError) as exc:
                last_error = exc

                logger.warning(
                    "nebius.structured_output.invalid",
                    attempt=attempt,
                    model=settings.NEBIUS_MODEL,
                    error_type=type(exc).__name__,
                    content_length=len(content),
                )

        raise ModelOutputError(
            "Failed to generate valid structured output after 2 attempts"
        ) from last_error
