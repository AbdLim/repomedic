from pathlib import Path
from typing import Protocol

from app.features.repairs.schemas import TestEvidence
from app.infrastructure.sandbox.builder import PreparedEnvironment


class SandboxBuilder(Protocol):
    async def prepare(self, workspace: Path) -> PreparedEnvironment: ...

    async def remove(self, image: str) -> None: ...


class SandboxRunner(Protocol):
    async def run(
        self,
        workspace: Path,
        test_path: str,
        image: str,
        environment: dict[str, str] | None = None,
    ) -> TestEvidence: ...
