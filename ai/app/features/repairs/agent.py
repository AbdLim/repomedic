import ast
import difflib
from pathlib import Path

from pydantic import BaseModel

from app.features.repairs.prompts import (
    ISSUE_ASSESSMENT_SYSTEM_PROMPT,
    REGRESSION_SYSTEM_PROMPT,
    SUGGESTION_SYSTEM_PROMPT,
    regression_user_prompt,
)
from app.features.repairs.schemas import ImplementationSuggestion, IssueAssessment
from app.infrastructure.llm.nebius import (
    ModelOutputError,
    NebiusProvider,
)


class InvestigationResult(BaseModel):
    root_cause: str
    target_file: str
    reasoning: str


class RegressionResult(BaseModel):
    code: str
    explanation: str


class PatchResult(BaseModel):
    replacement_content: str
    explanation: str


INVESTIGATION_PROMPT = """
You are RepoMedic's code investigation agent.

Investigate the reported GitHub issue using the provided
repository source.

Identify:
- The suspected root cause
- The single most relevant source file
- Evidence supporting the hypothesis

Do not invent repository symbols or claim a bug is proven
without test evidence.

Return:
- root_cause
- target_file
- reasoning

The target_file must be an existing repository-relative path.
"""

PATCH_PROMPT = """
You are RepoMedic's code repair agent.

Given an issue, root cause, original source file, and
verification feedback, produce a minimal repair.

Rules:
- Preserve existing public interfaces unless necessary.
- Do not remove security checks.
- Do not modify tests.
- Do not invent unrelated features.
- Return the complete replacement file contents.
- Preserve unrelated code.

Return:
- replacement_content
- explanation
"""


class RepairAgent:
    def __init__(self) -> None:
        self.provider = NebiusProvider()

    def source_files(
        self,
        workspace: Path,
    ) -> dict[str, str]:
        """
        Collect bounded repository context.

        Include Python application code and existing tests
        so the model can see real imports and fixtures.
        """
        selected: dict[str, str] = {}

        allowed_roots = (
            workspace / "app",
            workspace / "tests",
        )

        max_files = 80
        max_file_bytes = 20_000
        max_total_chars = 180_000
        total_chars = 0

        for root in allowed_roots:
            if not root.is_dir():
                continue

            for path in sorted(root.rglob("*.py")):
                if len(selected) >= max_files:
                    break

                if path.is_symlink():
                    continue

                if path.stat().st_size > max_file_bytes:
                    continue

                relative = path.relative_to(workspace).as_posix()

                content = path.read_text(
                    encoding="utf-8",
                    errors="replace",
                )

                if total_chars + len(content) > max_total_chars:
                    break

                selected[relative] = content
                total_chars += len(content)

        # Include pytest and project configuration where available.
        for name in (
            "pyproject.toml",
            "pytest.ini",
            "conftest.py",
            "tests/conftest.py",
        ):
            path = workspace / name

            if not path.is_file() or path.is_symlink():
                continue

            content = path.read_text(
                encoding="utf-8",
                errors="replace",
            )[:12_000]

            if total_chars + len(content) <= max_total_chars:
                selected[name] = content
                total_chars += len(content)

        return selected

    @staticmethod
    def _source_context(
        files: dict[str, str],
    ) -> str:
        sections: list[str] = []

        for path, content in files.items():
            sections.append(f"### FILE: {path}\n```python\n{content}\n```")

        return "\n\n".join(sections)

    async def investigate(
        self,
        issue_text: str,
        files: dict[str, str],
    ) -> InvestigationResult:
        result = await self.provider.generate_json(
            system_prompt=INVESTIGATION_PROMPT,
            user_prompt=(
                f"GitHub issue:\n{issue_text}\n\nRepository:\n{self._source_context(files)}"
            ),
            schema=InvestigationResult,
        )

        if result.target_file not in files:
            raise ModelOutputError("Investigation selected an unavailable source file")

        return result

    async def regression(
        self,
        issue_text: str,
        hypothesis: InvestigationResult,
        files: dict[str, str],
        feedback: str = "",
    ) -> RegressionResult:
        result = await self.provider.generate_json(
            system_prompt=REGRESSION_SYSTEM_PROMPT,
            user_prompt=regression_user_prompt(
                issue_text=issue_text,
                root_cause=hypothesis.root_cause,
                source_context=self._source_context(files),
                feedback=feedback,
            ),
            schema=RegressionResult,
        )

        # Validate generated Python before handing it to Docker.
        try:
            ast.parse(result.code)
        except SyntaxError as exc:
            raise ModelOutputError(
                f"Generated regression test has invalid Python syntax: {exc}"
            ) from exc

        return result

    async def patch(
        self,
        issue_text: str,
        hypothesis: InvestigationResult,
        original_content: str,
        feedback: str = "",
    ) -> PatchResult:
        user_prompt = (
            f"Issue:\n{issue_text}\n\n"
            f"Root cause:\n{hypothesis.root_cause}\n\n"
            f"Target file:\n{hypothesis.target_file}\n\n"
            f"Original source:\n{original_content}\n\n"
            f"Previous verification feedback:\n{feedback}"
        )

        result = await self.provider.generate_json(
            system_prompt=PATCH_PROMPT,
            user_prompt=user_prompt,
            schema=PatchResult,
        )

        try:
            ast.parse(result.replacement_content)
        except SyntaxError as exc:
            raise ModelOutputError(f"Generated patch contains invalid Python: {exc}") from exc

        return result

    @staticmethod
    def unified_diff(
        target_file: str,
        original_content: str,
        replacement_content: str,
    ) -> str:
        return "".join(
            difflib.unified_diff(
                original_content.splitlines(keepends=True),
                replacement_content.splitlines(keepends=True),
                fromfile=f"a/{target_file}",
                tofile=f"b/{target_file}",
            )
        )

    async def assess(
        self,
        issue_text: str,
        files: dict[str, str],
    ) -> IssueAssessment:
        result = await self.provider.generate_json(
            system_prompt=ISSUE_ASSESSMENT_SYSTEM_PROMPT,
            user_prompt=(
                f"<issue_description>\n{issue_text}\n</issue_description>\n\n"
                f"<repository_source>\n{self._source_context(files)}\n"
                "</repository_source>"
            ),
            schema=IssueAssessment,
        )

        if result.issue_type == "unclear" and not result.clarification_question:
            result.clarification_question = "What behavior is expected, and where is it specified?"

        return result

    async def suggest(
        self,
        issue_text: str,
        assessment: IssueAssessment,
        files: dict[str, str],
    ) -> ImplementationSuggestion:
        result = await self.provider.generate_json(
            system_prompt=SUGGESTION_SYSTEM_PROMPT,
            user_prompt=(
                f"<issue_description>\n{issue_text}\n</issue_description>\n\n"
                f"<assessment>\n{assessment.model_dump_json()}\n</assessment>\n\n"
                f"<repository_source>\n{self._source_context(files)}\n"
                "</repository_source>"
            ),
            schema=ImplementationSuggestion,
        )

        # Do not claim that nonexistent files are verified change targets.
        result.affected_files = [path for path in result.affected_files if path in files]
        return result
