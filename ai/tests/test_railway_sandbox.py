import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.infrastructure.sandbox.environment import EnvironmentPreparationError
from app.infrastructure.sandbox.factory import (
    get_sandbox_builder,
    get_sandbox_runner,
    resolve_sandbox_provider,
)
from app.infrastructure.sandbox.railway import (
    RailwaySandboxBuilder,
    RailwaySandboxRunner,
)
from app.infrastructure.sandbox.runner import DockerRunner


def test_resolve_sandbox_provider_explicit() -> None:
    with patch.object(settings, "SANDBOX_PROVIDER", "docker"):
        assert resolve_sandbox_provider() == "docker"
    with patch.object(settings, "SANDBOX_PROVIDER", "railway"):
        assert resolve_sandbox_provider() == "railway"


def test_resolve_sandbox_provider_auto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_ID", raising=False)
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("RAILWAY_API_TOKEN", raising=False)
    monkeypatch.delenv("RAILWAY_TOKEN", raising=False)

    with (
        patch.object(settings, "SANDBOX_PROVIDER", "auto"),
        patch.object(settings, "RAILWAY_API_TOKEN", ""),
    ):
        assert resolve_sandbox_provider() == "docker"

    monkeypatch.setenv("RAILWAY_ENVIRONMENT_ID", "env-123")
    with patch.object(settings, "SANDBOX_PROVIDER", "auto"):
        assert resolve_sandbox_provider() == "railway"


def test_get_sandbox_builder_and_runner(monkeypatch: pytest.MonkeyPatch) -> None:
    with patch.object(settings, "SANDBOX_PROVIDER", "docker"):
        builder = get_sandbox_builder()
        runner = get_sandbox_runner()
        assert isinstance(runner, DockerRunner)

    monkeypatch.setenv("RAILWAY_ENVIRONMENT_ID", "env-123")
    with patch.object(settings, "SANDBOX_PROVIDER", "auto"):
        builder = get_sandbox_builder()
        runner = get_sandbox_runner()
        assert isinstance(builder, RailwaySandboxBuilder)
        assert isinstance(runner, RailwaySandboxRunner)


@pytest.mark.asyncio
async def test_railway_builder_prepare_success(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "demo"\nversion = "0.1.0"\nrequires-python = ">=3.12"\n'
    )
    (tmp_path / "uv.lock").write_text("version = 1\n")

    builder = RailwaySandboxBuilder()

    create_json = (
        "Warning: Railway sandboxes are experimental and APIs may change or break during testing.\n"
        + json.dumps({"id": "sbx-test-123", "status": "RUNNING"})
    )

    mock_run = AsyncMock()
    # 1. create command, 2. copy command, 3. setup command
    mock_run.side_effect = [
        (0, create_json, False),
        (0, "Extracted files", False),
        (0, "Environment ready", False),
    ]

    with patch("app.infrastructure.sandbox.railway._run_command", mock_run):
        prepared = await builder.prepare(tmp_path)
        assert prepared.image == "railway:sbx-test-123"
        assert prepared.log == "Environment ready"
        assert mock_run.call_count == 3


@pytest.mark.asyncio
async def test_railway_builder_prepare_failure_destroys_sandbox(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "demo"\nversion = "0.1.0"\nrequires-python = ">=3.12"\n'
    )
    (tmp_path / "uv.lock").write_text("version = 1\n")

    builder = RailwaySandboxBuilder()
    create_json = json.dumps({"id": "sbx-fail-123", "status": "RUNNING"})

    mock_run = AsyncMock()
    # 1. create succeeds, 2-4. copy retries fail, 5. destroy called in cleanup
    mock_run.side_effect = [
        (0, create_json, False),
        (1, "Permission denied", False),
        (1, "Permission denied", False),
        (1, "Permission denied", False),
        (0, "Destroyed", False),
    ]

    with (
        patch("app.infrastructure.sandbox.railway._run_command", mock_run),
        patch("asyncio.sleep", AsyncMock()),
    ):
        with pytest.raises(EnvironmentPreparationError, match="Failed to copy"):
            await builder.prepare(tmp_path)

        assert mock_run.call_count == 5
        # Check destroy was called with the sandbox id
        destroy_call_args = mock_run.call_args_list[4][0]
        assert "destroy" in destroy_call_args
        assert "sbx-fail-123" in destroy_call_args


@pytest.mark.asyncio
async def test_railway_runner_success(tmp_path: Path) -> None:
    runner = RailwaySandboxRunner()

    mock_run = AsyncMock()
    # 1. sync workspace, 2. run pytest
    mock_run.side_effect = [
        (0, "Synced", False),
        (0, "1 passed in 0.10s", False),
    ]

    with patch("app.infrastructure.sandbox.railway._run_command", mock_run):
        result = await runner.run(
            workspace=tmp_path,
            test_path="tests/test_repomedic_regression.py",
            image="railway:sbx-test-123",
            environment={"CUSTOM_VAR": "value"},
        )

        assert result.exit_code == 0
        assert "1 passed in 0.10s" in result.output
        assert not result.timed_out
        assert mock_run.call_count == 2


@pytest.mark.asyncio
async def test_railway_runner_timeout(tmp_path: Path) -> None:
    runner = RailwaySandboxRunner()

    mock_run = AsyncMock()
    # 1. sync workspace, 2. run pytest timed out
    mock_run.side_effect = [
        (0, "Synced", False),
        (124, "Sandbox execution timed out", True),
    ]

    with patch("app.infrastructure.sandbox.railway._run_command", mock_run):
        result = await runner.run(
            workspace=tmp_path,
            test_path="tests",
            image="railway:sbx-test-123",
        )

        assert result.exit_code == 124
        assert result.timed_out
