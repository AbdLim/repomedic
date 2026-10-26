from pathlib import Path

import pytest

from app.features.repairs.schemas import TestEvidence
from app.features.repairs.service import classify_baseline
from app.infrastructure.sandbox.environment import (
    EnvironmentPreparationError,
    detect_environment,
)


def test_detect_uv_project(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "demo"\nversion = "0.1.0"\nrequires-python = ">=3.12"\n'
    )
    (tmp_path / "uv.lock").write_text("version = 1\n")
    assert detect_environment(tmp_path).manager == "uv"


def test_reject_unknown_project(tmp_path: Path) -> None:
    with pytest.raises(EnvironmentPreparationError, match="Unsupported"):
        detect_environment(tmp_path)


def test_import_failure_is_environment_error() -> None:
    result = TestEvidence(
        exit_code=4,
        output="ImportError while loading conftest: ModuleNotFoundError: sqlalchemy",
    )
    assert classify_baseline(result) == "environment_failed"


def test_failing_test_is_candidate_regression() -> None:
    result = TestEvidence(exit_code=1, output="1 failed in 0.20s")
    assert classify_baseline(result) == "regression_failed"
