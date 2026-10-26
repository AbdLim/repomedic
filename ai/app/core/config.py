from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    APP_ENV: Literal["development", "production"] = "development"
    APP_NAME: str = "RepoMedic AI Service"

    # Nebius
    NEBIUS_API_KEY: str = ""
    NEBIUS_BASE_URL: str = "https://api.tokenfactory.nebius.com/v1/"
    NEBIUS_MODEL: str = "nvidia/nemotron-3-super-120b-a12b"

    #
    GITHUB_TOKEN: str = ""
    #
    INTERNAL_API_KEY: str = "john_snow_knows_nothing"

    #
    # Sandbox
    SANDBOX_PROVIDER: Literal["docker", "railway", "auto"] = "auto"
    SANDBOX_IMAGE: str = "repomedic-pytest:local"
    SANDBOX_TIMEOUT_SECONDS: int = 45
    MAX_ARCHIVE_BYTES: int = 12_000_000

    # Railway Ephemeral Sandbox
    RAILWAY_API_TOKEN: str = ""
    RAILWAY_ENVIRONMENT_ID: str = ""
    RAILWAY_PROJECT_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )


settings = Settings()
