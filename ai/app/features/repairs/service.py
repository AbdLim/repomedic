import ast
import shutil
import tempfile
from pathlib import Path

from app.features.repairs.agent import RepairAgent
from app.features.repairs.schemas import (
    RepairResult,
    RepairStatus,
    TestEvidence,
)
from app.infrastructure.github.client import (
    GitHubClient,
    GitHubIssue,
)
from app.infrastructure.llm.nebius import ModelOutputError
from app.infrastructure.sandbox.environment import (
    EnvironmentPreparationError,
)
from app.infrastructure.sandbox.factory import (
    get_sandbox_builder,
    get_sandbox_runner,
)
from app.infrastructure.sandbox.protocols import (
    SandboxBuilder,
    SandboxRunner,
)

MAX_REGRESSION_ATTEMPTS = 3
MAX_PATCH_ATTEMPTS = 2

REGRESSION_TEST_PATH = "tests/test_repomedic_regression.py"


def classify_baseline(result: TestEvidence) -> str:
    """
    Classify the result of executing a generated regression test.

    This is a conservative temporary classifier.
    A future version should consume structured pytest results.
    """
    output = result.output.lower()

    if result.timed_out or result.exit_code in {124, 125, 126, 127, 137}:
        return "environment_failed"

    if (
        "error importing plugin" in output
        or "no module named 'pytest_" in output
        or "error while loading conftest" in output
    ):
        return "environment_failed"

    if (
        "error collecting" in output
        or "errors during collection" in output
        or "importerror while importing test module" in output
        or "syntaxerror:" in output
    ):
        return "test_generation_failed"

    if result.exit_code == 0:
        return "not_reproduced"

    if result.exit_code == 1 and "failed" in output and "assert" in output:
        return "potentially_reproduced"

    return "unverified"


def safe_source_path(
    workspace: Path,
    relative_path: str,
) -> Path:
    """
    Resolve a repository-relative Python source path.

    Prevent the model from selecting paths outside the workspace.
    """
    relative = Path(relative_path)

    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Unsafe source file path")

    if relative.suffix != ".py":
        raise ValueError("Repair target must be a Python file")

    target = (workspace / relative).resolve()

    if not target.is_relative_to(workspace.resolve()):
        raise ValueError("Repair target escapes workspace")

    if not target.is_file():
        raise ValueError("Repair target does not exist")

    return target


class RepairService:
    def __init__(
        self,
        builder: SandboxBuilder | None = None,
        runner: SandboxRunner | None = None,
    ) -> None:
        self.agent = RepairAgent()
        self.runner = runner or get_sandbox_runner()
        self.builder = builder or get_sandbox_builder()

    @staticmethod
    def _permissions(workspace: Path) -> None:
        workspace.chmod(0o755)

        for item in workspace.rglob("*"):
            if item.is_symlink():
                continue

            if item.is_dir():
                item.chmod(0o755)
            elif item.is_file():
                item.chmod(0o644)

    @staticmethod
    def _issue_text(issue: GitHubIssue) -> str:
        return f"{issue.title}\n\n{issue.body}"

    async def run(
        self,
        issue_url: str,
        environment: dict[str, str] | None = None,
    ) -> RepairResult:
        environment = environment or {}

        timeline: list[str] = ["Fetching public GitHub issue and pinned snapshot"]

        with tempfile.TemporaryDirectory(prefix="repomedic-") as temp:
            root = Path(temp)
            original_workspace = root / "original"
            original_workspace.mkdir()

            client = GitHubClient()

            try:
                issue = await client.get_issue(issue_url)
                await client.download_snapshot(
                    issue,
                    original_workspace,
                )
            finally:
                await client.close()

            repository = f"{issue.owner}/{issue.repo}"
            image: str | None = None

            try:
                # 0. Asses before costly environment preparation
                files = self.agent.source_files(original_workspace)
                issue_text = self._issue_text(issue)
                timeline.append("Assessing issue and expected behavior")
                assessment = await self.agent.assess(issue_text, files)

                if assessment.issue_type == "unclear":
                    timeline.append("Issue requires clarification")
                    return RepairResult(
                        status=RepairStatus.NEEDS_CLARIFICATION,
                        issue_url=issue_url,
                        repository=repository,
                        commit_sha=issue.commit_sha,
                        issue_type=assessment.issue_type,
                        assessment=assessment,
                        explanation=(
                            assessment.clarification_question
                            or "Expected behavior is not sufficiently defined"
                        ),
                        timeline=timeline,
                    )

                if assessment.issue_type in {"feature_request", "usage_mismatch"}:
                    timeline.append("Generating implementation suggestion")
                    suggestion = await self.agent.suggest(
                        issue_text,
                        assessment,
                        files,
                    )
                    timeline.append("Suggestion prepared; no patch executed")
                    return RepairResult(
                        status=RepairStatus.SUGGESTION,
                        issue_url=issue_url,
                        repository=repository,
                        commit_sha=issue.commit_sha,
                        issue_type=assessment.issue_type,
                        assessment=assessment,
                        suggestion=suggestion,
                        root_cause="",
                        explanation=assessment.reasoning,
                        changed_file=None,
                        patch=None,
                        baseline=None,
                        regression_after=None,
                        suite_after=None,
                        timeline=timeline,
                    )

                # Only assessed bugs continue to environment preparation.
                timeline.append("Issue classified as bug; starting verification")

                # 1. Prepare execution environment
                timeline.append("Preparing locked Python dependencies")
                prepared = await self.builder.prepare(original_workspace)
                image = prepared.image
                timeline.append("Dependency environment ready")

                # 2. Investigate repository
                timeline.append("Investigating root cause")
                hypothesis = await self.agent.investigate(
                    issue_text,
                    files,
                )
                target = hypothesis.target_file

                source_file = safe_source_path(
                    original_workspace,
                    target,
                )
                original_content = source_file.read_text(encoding="utf-8")

                # 3. Generate and validate regression
                regression_path = original_workspace / REGRESSION_TEST_PATH

                if regression_path.exists():
                    raise ValueError("Repository contains reserved regression path")

                regression_path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                baseline: TestEvidence | None = None
                regression_feedback = ""
                classification = "test_generation_failed"

                for attempt in range(
                    1,
                    MAX_REGRESSION_ATTEMPTS + 1,
                ):
                    timeline.append(
                        f"Generating regression test ({attempt}/{MAX_REGRESSION_ATTEMPTS})"
                    )
                    # Catch invalid model-generated Python.
                    try:
                        regression = await self.agent.regression(
                            issue_text,
                            hypothesis,
                            files,
                            feedback=regression_feedback,
                        )
                    except ModelOutputError as exc:
                        regression_feedback = (
                            "Previous regression generation failed. "
                            "Return valid structured output containing "
                            "a syntactically valid Python test.\n"
                            f"Validation error: {exc}"
                        )

                        timeline.append("Generated regression rejected before sandbox execution")
                        continue

                    try:
                        ast.parse(regression.code)
                    except SyntaxError as exc:
                        regression_feedback = (
                            f"The generated Python test has a syntax error:\n{exc}"
                        )
                        continue

                    regression_path.write_text(
                        regression.code,
                        encoding="utf-8",
                    )

                    self._permissions(root)

                    timeline.append(
                        f"Running regression baseline ({attempt}/{MAX_REGRESSION_ATTEMPTS})"
                    )

                    baseline = await self.runner.run(
                        original_workspace,
                        REGRESSION_TEST_PATH,
                        image=image,
                        environment=environment,
                    )

                    classification = classify_baseline(baseline)

                    timeline.append(f"Baseline classification: {classification}")

                    if classification == "potentially_reproduced":
                        break

                    # Repair invalid generated tests.
                    if classification == "test_generation_failed":
                        regression_feedback = (
                            "The previous regression test could "
                            "not execute.\n\n"
                            "Fix imports, fixtures, and test setup "
                            "using the provided repository source.\n"
                            "Preserve the intended assertion.\n\n"
                            f"Pytest output:\n{baseline.output[-4000:]}"
                        )

                        timeline.append("Retrying invalid regression test")
                        continue

                    # Do not retry environment errors or tests
                    # that already pass against original code.
                    break

                # 4. Stop if bug not reproduced
                if classification != "potentially_reproduced":
                    if classification == "environment_failed":
                        status = RepairStatus.ENVIRONMENT_FAILED

                    elif classification == "test_generation_failed":
                        status = RepairStatus.TEST_GENERATION_FAILED

                    else:
                        status = RepairStatus.UNVERIFIED

                    timeline.append("Regression baseline not established")

                    return RepairResult(
                        status=status,
                        issue_url=issue_url,
                        repository=repository,
                        commit_sha=issue.commit_sha,
                        root_cause=hypothesis.root_cause,
                        explanation=(
                            "Regression baseline did not "
                            f"demonstrate the reported bug: "
                            f"{classification}"
                        ),
                        baseline=baseline,
                        timeline=timeline,
                        issue_type=assessment.issue_type,
                        assessment=assessment,
                    )

                # 5. Generate and verify patches

                last_regression: TestEvidence | None = None
                last_suite: TestEvidence | None = None
                last_patch: str | None = None
                last_explanation = ""
                feedback = ""

                for attempt in range(
                    1,
                    MAX_PATCH_ATTEMPTS + 1,
                ):
                    timeline.append(f"Generating patch ({attempt}/{MAX_PATCH_ATTEMPTS})")

                    proposal = await self.agent.patch(
                        issue_text,
                        hypothesis,
                        original_content,
                        feedback,
                    )

                    patch = self.agent.unified_diff(
                        target,
                        original_content,
                        proposal.replacement_content,
                    )

                    if not patch.strip():
                        feedback = (
                            "Previous patch made no changes. Produce a minimal actual repair."
                        )
                        continue

                    patched_workspace = root / f"patched-{attempt}"

                    shutil.copytree(
                        original_workspace,
                        patched_workspace,
                    )

                    patched_target = safe_source_path(
                        patched_workspace,
                        target,
                    )

                    patched_target.write_text(
                        proposal.replacement_content,
                        encoding="utf-8",
                    )

                    self._permissions(root)

                    # Regression after patch
                    timeline.append(f"Running regression after patch {attempt}")

                    regression_after = await self.runner.run(
                        patched_workspace,
                        REGRESSION_TEST_PATH,
                        image=image,
                        environment=environment,
                    )

                    # Existing test suite
                    timeline.append(f"Running existing suite after patch {attempt}")

                    suite_after = await self.runner.run(
                        patched_workspace,
                        "tests",
                        image=image,
                        environment=environment,
                    )

                    last_regression = regression_after
                    last_suite = suite_after
                    last_patch = patch
                    last_explanation = proposal.explanation

                    regression_passed = (
                        regression_after.exit_code == 0 and not regression_after.timed_out
                    )

                    suite_passed = suite_after.exit_code == 0 and not suite_after.timed_out

                    if regression_passed and suite_passed:
                        timeline.append("Regression and test suite passed")

                        return RepairResult(
                            status=RepairStatus.VERIFIED,
                            issue_url=issue_url,
                            repository=repository,
                            commit_sha=issue.commit_sha,
                            root_cause=hypothesis.root_cause,
                            explanation=proposal.explanation,
                            changed_file=target,
                            patch=patch,
                            baseline=baseline,
                            regression_after=regression_after,
                            suite_after=suite_after,
                            timeline=timeline,
                            issue_type=assessment.issue_type,
                            assessment=assessment,
                        )

                    # Never send environment variables to the model.
                    # Test output must also be redacted before use.
                    feedback = (
                        "Previous patch failed verification.\n\n"
                        f"Regression:\n{regression_after.output[-2000:]}\n\n"
                        f"Suite:\n{suite_after.output[-2000:]}"
                    )

                timeline.append("Repair not verified after maximum attempts")

                return RepairResult(
                    status=RepairStatus.UNVERIFIED,
                    issue_url=issue_url,
                    repository=repository,
                    commit_sha=issue.commit_sha,
                    root_cause=hypothesis.root_cause,
                    explanation=last_explanation,
                    changed_file=(target if last_patch else None),
                    patch=last_patch,
                    baseline=baseline,
                    regression_after=last_regression,
                    suite_after=last_suite,
                    timeline=timeline,
                    issue_type=assessment.issue_type,
                    assessment=assessment,
                )

            except EnvironmentPreparationError as exc:
                timeline.append("Environment preparation failed")

                return RepairResult(
                    status=RepairStatus.ENVIRONMENT_FAILED,
                    issue_url=issue_url,
                    repository=repository,
                    commit_sha=issue.commit_sha,
                    explanation=str(exc),
                    error="environment_setup",
                    timeline=timeline,
                    issue_type=assessment.issue_type,
                    assessment=assessment,
                )

            finally:
                if image is not None:
                    await self.builder.remove(image)
