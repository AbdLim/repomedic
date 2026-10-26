import io
import re
import tarfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx
import structlog

logger = structlog.get_logger(__name__)

GITHUB_API_URL = "https://api.github.com"

MAX_ARCHIVE_BYTES = 30 * 1024 * 1024
MAX_EXTRACTED_BYTES = 100 * 1024 * 1024
MAX_FILES = 3000

ISSUE_PATTERN = re.compile(r"^/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/issues/([0-9]+)/?$")

SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")


@dataclass(frozen=True)
class GitHubIssue:
    owner: str
    repo: str
    number: int
    title: str
    body: str
    commit_sha: str


class GitHubClient:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=GITHUB_API_URL,
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "RepoMedic/0.1",
            },
            follow_redirects=False,
        )

    @staticmethod
    def parse_issue_url(
        issue_url: str,
    ) -> tuple[str, str, int]:
        parsed = urlparse(issue_url)

        if (
            parsed.scheme != "https"
            or parsed.hostname != "github.com"
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("Invalid GitHub issue URL")

        match = ISSUE_PATTERN.fullmatch(parsed.path)

        if match is None:
            raise ValueError("Expected URL format: https://github.com/owner/repo/issues/123")

        owner, repo, number = match.groups()

        return owner, repo, int(number)

    async def _get(
        self,
        path: str,
    ) -> dict:
        response = await self.client.get(path)
        response.raise_for_status()
        return response.json()

    async def get_issue(
        self,
        issue_url: str,
    ) -> GitHubIssue:
        owner, repo, number = self.parse_issue_url(issue_url)

        logger.info(
            "github.issue.fetch",
            repository=f"{owner}/{repo}",
            issue_number=number,
        )

        issue_data = await self._get(f"/repos/{owner}/{repo}/issues/{number}")

        if "pull_request" in issue_data:
            raise ValueError("Pull requests are not supported as repair issues")

        # Retrieve the repository's default branch.
        repository_data = await self._get(f"/repos/{owner}/{repo}")

        default_branch = repository_data["default_branch"]

        # Resolve the exact commit SHA.
        branch_data = await self._get(f"/repos/{owner}/{repo}/branches/{default_branch}")

        commit_sha = branch_data["commit"]["sha"]

        if not SHA_PATTERN.fullmatch(commit_sha):
            raise ValueError("Invalid commit SHA returned by GitHub")

        logger.info(
            "github.issue.loaded",
            repository=f"{owner}/{repo}",
            issue_number=number,
            commit_sha=commit_sha,
        )

        return GitHubIssue(
            owner=owner,
            repo=repo,
            number=number,
            title=issue_data["title"],
            body=issue_data.get("body") or "",
            commit_sha=commit_sha,
        )

    async def download_snapshot(
        self,
        issue: GitHubIssue,
        workspace: Path,
    ) -> None:
        """
        Download and safely extract the complete GitHub
        repository snapshot at a pinned commit.

        GitHub tarballs contain a wrapping root directory.
        We strip that directory during extraction.
        """
        if not SHA_PATTERN.fullmatch(issue.commit_sha):
            raise ValueError("Invalid pinned commit SHA")

        workspace.mkdir(parents=True, exist_ok=True)

        if any(workspace.iterdir()):
            raise ValueError("Snapshot workspace must be empty")

        logger.info(
            "github.snapshot.download.start",
            repository=f"{issue.owner}/{issue.repo}",
            commit_sha=issue.commit_sha,
        )

        endpoint = f"/repos/{issue.owner}/{issue.repo}/tarball/{issue.commit_sha}"

        # GitHub redirects archive downloads to its
        # archive infrastructure.
        response = await self.client.get(endpoint)

        if response.status_code not in (302, 307, 308):
            response.raise_for_status()
            raise ValueError("Expected GitHub archive redirect")

        redirect_url = response.headers.get("location")

        if not redirect_url:
            raise ValueError("GitHub archive redirect missing location")

        redirect = urlparse(redirect_url)

        # Prevent credential leakage and SSRF.
        if (
            redirect.scheme != "https"
            or redirect.hostname != "codeload.github.com"
            or redirect.port is not None
            or redirect.username is not None
            or redirect.password is not None
        ):
            raise ValueError("Unexpected GitHub archive redirect")

        archive = bytearray()

        # Separate client: don't forward API credentials.
        async with (
            httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0),
                follow_redirects=False,
            ) as archive_client,
            archive_client.stream(
                "GET",
                redirect_url,
            ) as archive_response,
        ):
            archive_response.raise_for_status()

            if archive_response.is_redirect:
                raise ValueError("Unexpected secondary archive redirect")

            async for chunk in archive_response.aiter_bytes():
                if len(archive) + len(chunk) > MAX_ARCHIVE_BYTES:
                    raise ValueError("Repository archive exceeds size limit")

                archive.extend(chunk)

        logger.info(
            "github.snapshot.download.complete",
            archive_bytes=len(archive),
        )

        self._extract_archive(
            bytes(archive),
            workspace,
        )

        logger.info(
            "github.snapshot.ready",
            workspace=str(workspace),
            has_pyproject=(workspace / "pyproject.toml").is_file(),
            has_uv_lock=(workspace / "uv.lock").is_file(),
        )

    @staticmethod
    def _extract_archive(
        archive: bytes,
        workspace: Path,
    ) -> None:
        """
        Extract GitHub tarball without using extractall().

        Reject:
        - Path traversal
        - Symlinks and hardlinks
        - Special files
        - Multiple archive roots
        - Oversized archives
        """
        file_count = 0
        total_bytes = 0
        archive_root: str | None = None

        with tarfile.open(
            fileobj=io.BytesIO(archive),
            mode="r:gz",
        ) as tar:
            for member in tar:
                parts = Path(member.name).parts

                if not parts:
                    continue

                if archive_root is None:
                    archive_root = parts[0]

                if parts[0] != archive_root:
                    raise ValueError("Unexpected multiple archive roots")

                # GitHub archive wrapper directory.
                if len(parts) == 1:
                    if not member.isdir():
                        raise ValueError("Invalid archive root entry")
                    continue

                relative_path = Path(*parts[1:])

                if relative_path.is_absolute() or ".." in relative_path.parts:
                    raise ValueError("Unsafe archive path detected")

                # Reject links and special files.
                if not (member.isfile() or member.isdir()):
                    raise ValueError("Unsupported archive entry type")

                destination = workspace / relative_path

                # Prevent extraction outside workspace.
                if not destination.resolve().is_relative_to(workspace.resolve()):
                    raise ValueError("Archive path escapes workspace")

                if member.isdir():
                    destination.mkdir(
                        parents=True,
                        exist_ok=True,
                    )
                    continue

                file_count += 1
                total_bytes += member.size

                if file_count > MAX_FILES:
                    raise ValueError("Repository exceeds file count limit")

                if total_bytes > MAX_EXTRACTED_BYTES:
                    raise ValueError("Repository exceeds extracted size limit")

                destination.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                source = tar.extractfile(member)

                if source is None:
                    raise ValueError("Failed to read archive member")

                # Enforce actual bytes written, not only
                # declared tar member sizes.
                remaining = member.size

                with source, destination.open("xb") as output:
                    while remaining > 0:
                        chunk = source.read(min(1024 * 1024, remaining))

                        if not chunk:
                            raise ValueError("Truncated archive member")

                        output.write(chunk)
                        remaining -= len(chunk)

        logger.info(
            "github.snapshot.extracted",
            file_count=file_count,
            extracted_bytes=total_bytes,
        )

    async def close(self) -> None:
        await self.client.aclose()
