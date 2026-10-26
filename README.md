# RepoMedic

**AI-powered GitHub issue triage and evidence-backed code repair.**

RepoMedic investigates GitHub issues, identifies potential bugs, generates regression tests, proposes code fixes, and verifies them in isolated execution environments.

Not every GitHub issue is a bug. RepoMedic can also recognize feature requests, usage mismatches, and unclear reports, then produce actionable suggestions without unnecessarily modifying code.

Built for the **Nebius x NVIDIA Global AI Hackathon 2026**.

## How it works

1. Submit a public GitHub issue URL.
2. RepoMedic inspects the repository and assesses the issue.
3. For reproducible bugs, the AI generates a regression test and verifies the failure.
4. The agent proposes a minimal patch and runs the regression and existing test suite.
5. Developers receive a report containing the diagnosis, execution evidence, and reviewable code changes.

For feature requests and usage mismatches, RepoMedic produces implementation suggestions instead of forcing a repair.

## Architecture

| Service | Technology | Responsibility |
|---|---|---|
| [Web](./web) | Next.js, TypeScript, Tailwind CSS | Issue submission, progress tracking and repair reports |
| [API](./api) | Express, TypeScript, PostgreSQL, Drizzle | Repair jobs, persistence and background processing |
| [AI Service](./ai) | FastAPI, NVIDIA Nemotron, Railway Sandboxes | Issue assessment, investigation, patch generation and verification |

The frontend is deployed on Vercel. The backend and AI service run on Railway, with ephemeral sandboxes for code execution.

## AI Technology

RepoMedic uses NVIDIA Nemotron through Nebius Token Factory to perform issue classification, code investigation, test generation and patch synthesis.

Generated changes are tested in disposable execution environments. RepoMedic does not automatically commit or push changes to the original repository.

## Demonstrated Results

**Verified bug repair: RepoMedic Bench #1**

- Correctly identified the cause of an HTTP 500 error for duplicate registration.
- Generated a regression test that failed against the original code.
- Proposed a patch returning HTTP 409 Conflict.
- Passed the regression test and existing test suite after the patch.

**Issue triage: Splitz API #4**

- Recognized that the reported email/password login behavior was not implemented.
- Classified the issue as a usage mismatch.
- Suggested adding an email/password authentication endpoint without disrupting the existing phone-and-name login flow.

## Running Locally

Each component has independent setup instructions:

- [Web setup](./web/README.md)
- [Backend API setup](./api/README.md)
- [AI Service setup](./ai/README.md)

The AI service requires Nebius credentials and a supported sandbox execution environment.

## Current MVP Scope & Limitations

RepoMedic is currently an MVP focused on **Python-based GitHub repositories**, particularly FastAPI applications using pytest.

### Supported

- **Public GitHub repositories** with accessible issues and source code.
- **Python 3.12 projects** using `pyproject.toml` and `uv.lock` for dependency management.
- **pytest-based test suites** for reproducing bugs and validating proposed fixes.
- **User-provided environment variables** for configuring test execution.
- **Issue classification**, including bugs, feature requests, usage mismatches, and unclear reports.
- **AI-generated repair suggestions and patches**, with sandbox verification for supported reproducible bugs.

### Current Limitations

- **Language support:** JavaScript, TypeScript, Go, Rust, Java, and other languages are not yet supported for automated repair verification.
- **Dependency management:** Projects using only `requirements.txt`, Poetry, or Pipenv are not currently supported by the environment builder.
- **External services:** Repositories requiring running databases, Redis, message queues, or third-party APIs may need additional setup or mocks. Supplying environment variables does not automatically provision these services.
- **Complex repositories:** Monorepos, multi-service architectures, and projects requiring custom build steps may not execute successfully.
- **Private repositories:** GitHub authentication and private repository access are not supported in the current MVP.
- **Patch scope:** The current repair engine primarily supports targeted changes to a single Python source file.
- **Verification:** A passing regression test and existing test suite provide evidence of correctness, but do not guarantee that a patch resolves every edge case.
- **GitHub integration:** RepoMedic does not automatically commit changes, push branches, or create pull requests. All proposed changes are presented for developer review.

### Execution & Security

RepoMedic runs supported tests in disposable sandbox environments with execution timeouts and resource restrictions. Local development uses Docker, while the deployed AI service uses Railway Sandboxes.

User-provided environment variables are passed into the test environment. **Only disposable test credentials should be provided**, as executed repository code can access them.

RepoMedic is an experimental developer tool. Generated changes should be reviewed before being applied to production repositories.

### Future Improvements

Planned areas of improvement include support for additional languages and package managers, more complex repository environments, multi-file repairs, private GitHub repositories, and optional pull-request creation.

## License

See [LICENSE](LICENSE).
