import pytest

from app.features.repairs.schemas import TestEvidence
from app.features.repairs.service import classify_baseline


@pytest.mark.parametrize(
    ("exit_code", "output", "expected"),
    [
        (
            2,
            "ERROR collecting tests/test_repomedic_regression.py\n"
            "ImportError: cannot import name 'User'",
            "test_generation_failed",
        ),
        (
            1,
            "ERROR at setup of test_login\nfixture 'client' not found",
            "test_generation_failed",
        ),
        (
            1,
            "FAILED tests/test_repomedic_regression.py::test_login\n"
            "AssertionError: assert 422 == 200\n"
            "short test summary info\n1 failed",
            "potentially_reproduced",
        ),
        (
            0,
            "1 passed in 0.15s",
            "not_reproduced",
        ),
        (
            125,
            "docker: Error response from daemon",
            "environment_failed",
        ),
        (
            4,
            "ERROR: file or directory not found",
            "environment_failed",
        ),
    ],
)
def test_classify_baseline(
    exit_code: int,
    output: str,
    expected: str,
) -> None:
    result = TestEvidence(
        exit_code=exit_code,
        output=output,
        timed_out=False,
    )

    assert classify_baseline(result) == expected


def test_timeout_is_environment_failure() -> None:
    result = TestEvidence(
        exit_code=124,
        output="Sandbox execution timed out",
        timed_out=True,
    )

    assert classify_baseline(result) == "environment_failed"
