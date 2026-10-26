import asyncio
import os
import re
import tempfile
import uuid
from pathlib import Path

from app.core.config import settings
from app.features.repairs.schemas import TestEvidence

ENV_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

RESERVED_KEYS = {
    "PATH",
    "HOME",
    "PYTHONPATH",
    "PYTHONHOME",
    "PYTHONDONTWRITEBYTECODE",
    "PYTEST_DISABLE_PLUGIN_AUTOLOAD",
    "TMPDIR",
}


def write_environment_file(
    path: Path,
    environment: dict[str, str],
) -> None:
    if len(environment) > 100:
        raise ValueError("Too many environment variables")

    lines: list[str] = []

    for key, value in environment.items():
        if not ENV_KEY_PATTERN.fullmatch(key):
            raise ValueError(f"Invalid environment variable name: {key}")

        if key in RESERVED_KEYS:
            raise ValueError(f"Reserved environment variable: {key}")

        if (
            not isinstance(value, str)
            or len(value) > 4096
            or "\n" in value
            or "\r" in value
            or "\x00" in value
        ):
            raise ValueError(f"Invalid environment value for: {key}")

        lines.append(f"{key}={value}")

    # mkstemp creates the file with restrictive permissions.
    with path.open("w", encoding="utf-8") as file:
        file.write("\n".join(lines))

    os.chmod(path, 0o600)


class DockerRunner:
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

        if not image.startswith("repomedic-env:"):
            raise ValueError("Runner requires a prepared RepoMedic image")

        container_name = f"repomedic-test-{uuid.uuid4().hex}"

        with tempfile.TemporaryDirectory(prefix="repomedic-env-") as temp_dir:
            env_file = Path(temp_dir) / "test.env"

            write_environment_file(
                env_file,
                environment or {},
            )

            args = [
                "docker",
                "run",
                "--name",
                container_name,
                "--init",
                # Network isolation
                "--network",
                "none",
                # Resource limits
                "--memory",
                "512m",
                "--cpus",
                "1",
                "--pids-limit",
                "128",
                # Security
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges",
                "--read-only",
                "--user",
                "65534:65534",
                # Writable temporary storage
                "--tmpfs",
                "/tmp:rw,nosuid,size=64m",
                # Read-only repository
                "--mount",
                (f"type=bind,src={workspace.resolve()},dst=/workspace,readonly"),
                "--workdir",
                "/workspace",
                # User-provided test configuration
                "--env-file",
                str(env_file),
                # Controlled environment
                "--env",
                "PYTHONPATH=/workspace",
                "--env",
                "PYTHONDONTWRITEBYTECODE=1",
                "--env",
                "TMPDIR=/tmp",
                # Prepared image
                image,
                "/opt/venv/bin/python",
                "-m",
                "pytest",
                "-q",
                "-p",
                "no:cacheprovider",
                test_path,
            ]

            process = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env={"PATH": os.environ.get("PATH", "")},
            )

            timed_out = False

            try:
                stdout, _ = await asyncio.wait_for(
                    process.communicate(),
                    timeout=settings.SANDBOX_TIMEOUT_SECONDS,
                )

                output = stdout.decode(
                    "utf-8",
                    errors="replace",
                )[-8000:]

                exit_code = process.returncode or 0

            except TimeoutError:
                timed_out = True
                process.kill()
                await process.communicate()

                exit_code = 124
                output = "Sandbox execution timed out"

            finally:
                cleanup = await asyncio.create_subprocess_exec(
                    "docker",
                    "rm",
                    "-f",
                    container_name,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await cleanup.wait()

        return TestEvidence(
            exit_code=exit_code,
            output=output,
            timed_out=timed_out,
        )
