from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "AI Loan Advisor Chatbot"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/fintech_agent"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    llm_wrapper_url: str = "https://llm-wrapper-741152993481.asia-south1.run.app"
    llm_wrapper_token: str = ""
    backend_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    seed_sample_data: bool = True
    expose_debug_endpoints: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
