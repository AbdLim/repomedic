import os
from typing import Literal

from app.core.config import settings
from app.infrastructure.sandbox.builder import EnvironmentBuilder
from app.infrastructure.sandbox.protocols import SandboxBuilder, SandboxRunner
from app.infrastructure.sandbox.railway import (
    RailwaySandboxBuilder,
    RailwaySandboxRunner,
)
from app.infrastructure.sandbox.runner import DockerRunner


def resolve_sandbox_provider() -> Literal["docker", "railway"]:
    provider = settings.SANDBOX_PROVIDER
    if provider in {"docker", "railway"}:
        return provider

    # "auto" detection: If running inside Railway or Railway credentials provided, choose Railway.
    if (
        os.environ.get("RAILWAY_ENVIRONMENT_ID")
        or os.environ.get("RAILWAY_PROJECT_ID")
        or settings.RAILWAY_API_TOKEN
        or os.environ.get("RAILWAY_API_TOKEN")
        or os.environ.get("RAILWAY_TOKEN")
    ):
        return "railway"

    return "docker"


def get_sandbox_builder() -> SandboxBuilder:
    if resolve_sandbox_provider() == "railway":
        return RailwaySandboxBuilder()
    return EnvironmentBuilder()


def get_sandbox_runner() -> SandboxRunner:
    if resolve_sandbox_provider() == "railway":
        return RailwaySandboxRunner()
    return DockerRunner()
