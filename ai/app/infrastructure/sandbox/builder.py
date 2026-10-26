import asyncio
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.infrastructure.sandbox.environment import (
    EnvironmentPreparationError,
    detect_environment,
)


@dataclass(frozen=True)
class PreparedEnvironment:
    image: str
    log: str


async def _command(*args: str, timeout: int) -> tuple[int, str]:
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env={"PATH": os.environ.get("PATH", "")},
    )
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError as exc:
        process.kill()
        await process.communicate()
        raise EnvironmentPreparationError("Dependency image build timed out") from exc
    return process.returncode or 0, stdout.decode("utf-8", errors="replace")[-6000:]


class EnvironmentBuilder:
    async def prepare(self, workspace: Path) -> PreparedEnvironment:
        detect_environment(workspace)
        dockerfile = Path("sandbox/Dockerfile.uv").resolve()
        if not dockerfile.is_file():
            raise EnvironmentPreparationError("Missing sandbox/Dockerfile.uv")

        image = f"repomedic-env:{uuid.uuid4().hex}"
        code, log = await _command(
            "docker",
            "build",
            "--pull=false",
            "--no-cache",
            "-f",
            str(dockerfile),
            "-t",
            image,
            str(workspace.resolve()),
            timeout=240,
        )
        if code != 0:
            # Docker may have tagged an image before the error; remove it.
            await self.remove(image)
            raise EnvironmentPreparationError(f"Dependency setup failed:\n{log}")
        return PreparedEnvironment(image=image, log=log)

    async def remove(self, image: str) -> None:
        if not image.startswith("repomedic-env:"):
            raise ValueError("Refusing to remove an unexpected image")
        await _command("docker", "image", "rm", "-f", image, timeout=30)
