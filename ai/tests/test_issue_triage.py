import pytest
from pydantic import ValidationError

from app.features.repairs.schemas import (
    ImplementationSuggestion,
    IssueAssessment,
    RepairStatus,
)


def test_usage_mismatch_assessment() -> None:
    assessment = IssueAssessment(
        issue_type="usage_mismatch",
        current_behavior="Login accepts phone number and password",
        requested_behavior="Login accepts email and password",
        reasoning="The reported input differs from the existing interface",
        evidence=["app/features/auth/router.py"],
    )
    assert assessment.issue_type == "usage_mismatch"


def test_suggestion_has_actionable_steps() -> None:
    suggestion = ImplementationSuggestion(
        title="Support email or phone login",
        summary="Allow a login identifier to be an email or phone number",
        rationale="Adds a new authentication option without removing phone login",
        proposed_changes=[
            "Update request validation to accept either identifier",
            "Resolve users by normalized email or phone",
            "Preserve password verification and generic invalid-credential errors",
        ],
        tests_to_add=[
            "Successful phone login still works",
            "Successful email login works for verified addresses",
            "Invalid credentials return a generic error",
        ],
    )
    assert suggestion.proposed_changes


def test_suggestion_status_exists() -> None:
    assert RepairStatus.SUGGESTION.value == "suggestion"


def test_invalid_issue_type_rejected() -> None:
    with pytest.raises(ValidationError):
        IssueAssessment(
            issue_type="random",  # type: ignore[arg-type]
            current_behavior="x",
            requested_behavior="y",
            reasoning="z",
        )
