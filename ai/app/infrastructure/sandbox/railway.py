import asyncio
import io
import json
import os
import shlex
import tarfile
from pathlib import Path

import structlog

from app.core.config import settings
from app.features.repairs.schemas import TestEvidence
from app.infrastructure.sandbox.builder import PreparedEnvironment
from app.infrastructure.sandbox.environment import (
    EnvironmentPreparationError,
    detect_environment,
)
from app.infrastructure.sandbox.runner import ENV_KEY_PATTERN, RESERVED_KEYS

logger = structlog.get_logger(__name__)


def _get_railway_env() -> tuple[dict[str, str], bool]:
    env = dict(os.environ)
    api_token = settings.RAILWAY_API_TOKEN or os.environ.get("RAILWAY_API_TOKEN")
    project_token = os.environ.get("RAILWAY_TOKEN")

    if api_token:
        env["RAILWAY_API_TOKEN"] = api_token.strip()
        env.pop("RAILWAY_TOKEN", None)
        return env, False

    if project_token:
        env["RAILWAY_TOKEN"] = project_token.strip()
        env.pop("RAILWAY_API_TOKEN", None)
        return env, True

    return env, False


def _build_tar_stream(workspace: Path) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(workspace, arcname=".")
    return buf.getvalue()


async def _run_command(
    *args: str,
    stdin_data: bytes | None = None,
    timeout: int = 120,
) -> tuple[int, str, bool]:
    env, _ = _get_railway_env()
    timed_out = False

    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE if stdin_data is not None else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )
    except FileNotFoundError as exc:
        raise EnvironmentPreparationError(
            "Railway CLI ('railway') is not installed or not found in PATH."
        ) from exc

    try:
        stdout, _ = await asyncio.wait_for(
            process.communicate(input=stdin_data),
            timeout=timeout,
        )
        output = stdout.decode("utf-8", errors="replace")
        exit_code = process.returncode or 0
    except TimeoutError:
        timed_out = True
        process.kill()
        await process.communicate()
        output = "Command timed out"
        exit_code = 124

    return exit_code, output, timed_out


class RailwaySandboxBuilder:
    async def prepare(self, workspace: Path) -> PreparedEnvironment:
        detect_environment(workspace)

        create_cmd = ["railway", "sandbox", "create", "--idle-timeout-minutes", "5", "--json"]

        _, is_project_token = _get_railway_env()
        # Project tokens are already bound to a specific project and environment.
        # Passing --environment or --project with a project token causes an authorization error.
        if not is_project_token:
            env_id = settings.RAILWAY_ENVIRONMENT_ID or os.environ.get("RAILWAY_ENVIRONMENT_ID")
            if env_id:
                create_cmd.extend(["--environment", env_id])

            project_id = settings.RAILWAY_PROJECT_ID or os.environ.get("RAILWAY_PROJECT_ID")
            if project_id:
                create_cmd.extend(["--project", project_id])

        logger.info("railway.sandbox.creating")
        code, output, timed_out = await _run_command(*create_cmd, timeout=90)
        if timed_out or code != 0:
            hint = ""
            if "unauthorized" in output.lower():
                hint = (
                    "\n\nAuthentication Hint: Ensure your Railway token is valid.\n"
                    "- For an Account API Token (Account Settings -> Tokens): set RAILWAY_API_TOKEN.\n"
                    "- For a Project Token (Project Settings -> Tokens): set RAILWAY_TOKEN.\n"
                    "Make sure the token has permissions for this project."
                )
            raise EnvironmentPreparationError(
                f"Failed to create Railway ephemeral sandbox (exit={code}):\n{output}{hint}"
            )

        try:
            start = output.find("{")
            end = output.rfind("}")
            if start != -1 and end != -1 and end > start:
                parsed = json.loads(output[start : end + 1])
            else:
                parsed = json.loads(output)
            sandbox_id = parsed.get("id")
            if not sandbox_id:
                raise ValueError("Sandbox ID missing from CLI output")
        except Exception as exc:
            raise EnvironmentPreparationError(
                f"Could not parse Railway sandbox creation output:\n{output}"
            ) from exc

        logger.info("railway.sandbox.created", sandbox_id=sandbox_id, status=parsed.get("status"))

        # If status is CREATING, wait for it to become RUNNING
        if parsed.get("status") == "CREATING":
            await self._wait_for_ready(sandbox_id)

        # Upload initial workspace tarball
        tar_bytes = _build_tar_stream(workspace)
        copy_cmd = [
            "railway",
            "sandbox",
            "exec",
            "--id",
            sandbox_id,
            "--",
            "sh",
            "-c",
            "mkdir -p /workspace && tar xzf - -C /workspace",
        ]
        copy_success = False
        last_copy_out = ""
        for attempt in range(1, 4):
            code, copy_out, timed_out = await _run_command(
                *copy_cmd,
                stdin_data=tar_bytes,
                timeout=60,
            )
            if not timed_out and code == 0:
                copy_success = True
                break
            last_copy_out = copy_out
            await asyncio.sleep(2 * attempt)

        if not copy_success:
            await self.remove(sandbox_id)
            raise EnvironmentPreparationError(
                f"Failed to copy repository files to Railway sandbox:\n{last_copy_out}"
            )

        # Setup python environment and pytest
        setup_script = (
            "set -e\n"
            "command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh\n"
            'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"\n'
            "uv python install 3.12\n"
            "cd /workspace\n"
            "uv sync --frozen --no-install-project\n"
            "uv pip install 'pytest>=8.3,<10'\n"
        )
        setup_cmd = [
            "railway",
            "sandbox",
            "exec",
            "--id",
            sandbox_id,
            "--timeout",
            "240",
            "--",
            "bash",
            "-lc",
            setup_script,
        ]
        logger.info("railway.sandbox.configuring", sandbox_id=sandbox_id)
        code, setup_out, timed_out = await _run_command(
            *setup_cmd,
            timeout=240,
        )
        if timed_out or code != 0:
            await self.remove(sandbox_id)
            raise EnvironmentPreparationError(
                f"Dependency setup failed in Railway sandbox:\n{setup_out}"
            )

        return PreparedEnvironment(image=f"railway:{sandbox_id}", log=setup_out)

    async def _wait_for_ready(self, sandbox_id: str, timeout: int = 45) -> None:
        start_time = asyncio.get_event_loop().time()
        logger.info("railway.sandbox.waiting_for_ready", sandbox_id=sandbox_id)
        while (asyncio.get_event_loop().time() - start_time) < timeout:
            code, out, timed_out = await _run_command("railway", "sandbox", "list", "--json", timeout=15)
            if code == 0 and not timed_out:
                try:
                    start = out.find("[")
                    end = out.rfind("]")
                    if start != -1 and end != -1 and end > start:
                        sandboxes = json.loads(out[start : end + 1])
                        for sb in sandboxes:
                            if sb.get("id") == sandbox_id:
                                status = (sb.get("status") or "").upper()
                                if status in {"RUNNING", "READY"}:
                                    logger.info("railway.sandbox.ready", sandbox_id=sandbox_id)
                                    return
                                if status in {"FAILED", "ERROR"}:
                                    raise EnvironmentPreparationError(
                                        f"Railway sandbox failed during creation: status={status}"
                                    )
                except Exception:
                    pass
            await asyncio.sleep(2)
        logger.info("railway.sandbox.wait_timeout_proceeding", sandbox_id=sandbox_id)

    async def remove(self, image: str) -> None:
        sandbox_id = image.removeprefix("railway:")
        destroy_cmd = ["railway", "sandbox", "destroy", "--id", sandbox_id, "-y"]
        logger.info("railway.sandbox.destroying", sandbox_id=sandbox_id)
        try:
            await _run_command(*destroy_cmd, timeout=30)
        except Exception as exc:
            logger.warning("railway.sandbox.destroy_failed", sandbox_id=sandbox_id, error=str(exc))


class RailwaySandboxRunner:
    async def run(
        self,
        workspace: Path,
        test_path: str,
        image: str,
        environment: dict[str, str] | None = None,
    ) -> TestEvidence:
        if test_path not in {
            "tests/test_repomedic_regression.py",
            "tests",
        }:
            raise ValueError("Unsupported pytest target")

        if not workspace.is_dir():
            raise ValueError("Missing sandbox workspace")

        sandbox_id = image.removeprefix("railway:")

        # Sync current workspace snapshot (including new regression test or patch)
        tar_bytes = _build_tar_stream(workspace)
        sync_cmd = [
            "railway",
            "sandbox",
            "exec",
            "--id",
            sandbox_id,
            "--",
            "sh",
            "-c",
            "tar xzf - -C /workspace",
        ]
        code, sync_out, timed_out = await _run_command(
            *sync_cmd,
            stdin_data=tar_bytes,
            timeout=60,
        )
        if timed_out or code != 0:
            return TestEvidence(
                exit_code=code or 1,
                output=f"Failed to sync workspace to sandbox:\n{sync_out}",
                timed_out=timed_out,
            )

        # Prepare environment exports
        env_exports: list[str] = []
        for key, value in (environment or {}).items():
            if not ENV_KEY_PATTERN.fullmatch(key) or key in RESERVED_KEYS:
                continue
            if not isinstance(value, str) or any(c in value for c in ("\n", "\r", "\x00")):
                continue
            env_exports.append(f"export {key}={shlex.quote(value)}")

        export_str = "\n".join(env_exports)
        timeout_seconds = settings.SANDBOX_TIMEOUT_SECONDS

        test_script = (
            'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"\n'
            "export PYTHONPATH=/workspace\n"
            "export PYTHONDONTWRITEBYTECODE=1\n"
            "export TMPDIR=/tmp\n"
            f"{export_str}\n"
            "cd /workspace\n"
            f"uv run pytest -q -p no:cacheprovider {test_path}\n"
        )

        test_cmd = [
            "railway",
            "sandbox",
            "exec",
            "--id",
            sandbox_id,
            "--timeout",
            str(timeout_seconds),
            "--",
            "bash",
            "-lc",
            test_script,
        ]

        logger.info("railway.sandbox.running_test", sandbox_id=sandbox_id, target=test_path)
        exit_code, output, timed_out = await _run_command(
            *test_cmd,
            timeout=timeout_seconds + 15,
        )

        return TestEvidence(
            exit_code=exit_code,
            output=output[-8000:],
            timed_out=timed_out,
        )
