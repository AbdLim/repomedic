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

## Security and Limitations

RepoMedic currently focuses on supported public Python repositories. Repair results are proposals for developer review, and successful tests do not guarantee correctness in every scenario.

Execution environments have resource and isolation restrictions. Do not supply production credentials as test environment variables.

## License

See [LICENSE](LICENSE).
