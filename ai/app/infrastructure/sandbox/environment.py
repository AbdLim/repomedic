import tomllib
from dataclasses import dataclass
from pathlib import Path


class EnvironmentPreparationError(Exception):
    """A repository cannot be prepared for isolated test execution."""


@dataclass(frozen=True)
class PythonEnvironment:
    manager: str
    python_version: str


def detect_environment(workspace: Path) -> PythonEnvironment:
    pyproject_path = workspace / "pyproject.toml"
    lock_path = workspace / "uv.lock"

    if not pyproject_path.is_file() or not lock_path.is_file():
        raise EnvironmentPreparationError(
            "Unsupported dependency format: this MVP requires pyproject.toml and uv.lock"
        )

    try:
        project = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, tomllib.TOMLDecodeError) as exc:
        raise EnvironmentPreparationError("Invalid pyproject.toml") from exc

    requires_python = str(project.get("project", {}).get("requires-python", ""))
    # Deliberately support only Python 3.12 projects for now... for safety sake.
    # dont wanna spend more time
    if not requires_python or ">=3.13" in requires_python or ">3.12" in requires_python:
        raise EnvironmentPreparationError(
            f"Python compatibility needs manual review: {requires_python or 'unspecified'}"
        )

    return PythonEnvironment(manager="uv", python_version="3.12")
