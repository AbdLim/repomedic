from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class RepairRequest(BaseModel):
    issue_url: str = Field(min_length=20, max_length=500)
    environment: dict[str, str] = Field(default_factory=dict)


class Hypothesis(BaseModel):
    root_cause: str
    target_file: str
    reasoning: str


class RegressionTest(BaseModel):
    code: str
    explanation: str


class ProposedFix(BaseModel):
    target_file: str
    replacement_content: str
    explanation: str


class TestEvidence(BaseModel):
    exit_code: int
    output: str
    timed_out: bool = False


class RepairStatus(StrEnum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    FAILED = "failed"
    ENVIRONMENT_FAILED = "environment_failed"
    TEST_GENERATION_FAILED = "test_generation_failed"
    NEEDS_CLARIFICATION = "needs_clarification"
    SUGGESTION = "suggestion"


class IssueAssessment(BaseModel):
    issue_type: Literal["bug", "feature_request", "usage_mismatch", "unclear"]
    current_behavior: str = Field(min_length=1)
    requested_behavior: str = Field(min_length=1)
    reasoning: str = Field(min_length=1)
    evidence: list[str] = Field(default_factory=list)
    clarification_question: str | None = None


class ImplementationSuggestion(BaseModel):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    proposed_changes: list[str] = Field(min_length=1)
    affected_files: list[str] = Field(default_factory=list)
    tests_to_add: list[str] = Field(default_factory=list)
    tradeoffs: list[str] = Field(default_factory=list)


class RepairResult(BaseModel):
    status: RepairStatus
    issue_url: str
    repository: str
    commit_sha: str
    root_cause: str = ""
    explanation: str = ""
    changed_file: str | None = None
    patch: str | None = None
    baseline: TestEvidence | None = None
    regression_after: TestEvidence | None = None
    suite_after: TestEvidence | None = None
    error: str | None = None
    timeline: list[str] = Field(default_factory=list)
    issue_type: Literal["bug", "feature_request", "usage_mismatch", "unclear"] | None = None
    assessment: IssueAssessment | None = None
    suggestion: ImplementationSuggestion | None = None
