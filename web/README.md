# RepoMedic Web

**The frontend for RepoMedic, an AI-powered GitHub issue triage and evidence-backed code repair platform.**

RepoMedic helps developers distinguish bugs from feature requests and usage mismatches. For supported Python bugs, it can reproduce a failure, propose a patch, and show the results of regression and existing-suite tests. For issues that do not justify an automated repair, it returns a reasoned suggestion instead.

> This repository contains the **Next.js frontend**. The complete application also requires [RepoMedic API](https://github.com/abdlim/repomedic-api) and [RepoMedic AI](https://github.com/abdlim/repomedic-ai).

**Live application:** `https://repomedic-web.vercel.app`
**Hackathon:** [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/) · Coding and Agentic Engineering

## What you can do

- Submit a public GitHub issue URL for analysis.
- Provide optional **test-only** environment variables required by the target repository.
- Follow the status of an asynchronous repair job through a progress timeline.
- Review the issue assessment, diagnosis, and implementation suggestions.
- Inspect baseline tests, post-patch regression tests, and existing-suite results when verification is performed.
- Review and copy a proposed unified diff; download the `.patch` when available.

RepoMedic **does not commit to, push to, or open pull requests against the target repository**. Patches are proposals for developer review.

## How the full application works

```text
Browser (Next.js, Vercel)
   |
   | /api/backend/repairs proxy
   v
Express API (Railway) ---- PostgreSQL
   |
   | background repair dispatch
   v
FastAPI AI service (Railway)
   |                 |
   |                 +--> Railway ephemeral sandbox (deployed)
   |                       or local Docker (development)
   v
Nebius Token Factory: NVIDIA Nemotron
```

The frontend never calls Nebius or the sandbox directly. The Express API manages jobs and persisted results; the FastAPI service handles model-driven investigation, suggestions, patch generation, and test execution.

### Supported outcomes

| Outcome | Meaning |
| --- | --- |
| Verified repair | A generated regression demonstrated a failure, and the proposed patch passed the executed regression and suite. |
| Unverified / failed | The service could not establish or verify the proposed repair. |
| Suggestion | The issue is better addressed as a feature enhancement or usage clarification; no repair test is required. |
| Needs clarification | The intended behavior cannot be established from the issue and repository context. |

A **verified** result describes the tests actually run. It is not a guarantee that a patch is safe or correct in every environment.

## Tech stack

- Next.js, React, TypeScript, Tailwind CSS
- Frontend API proxy to the Express backend
- Vercel for frontend deployment

## Local development

**Prerequisites:** Node.js and the package manager used in this repository's lockfile; a running RepoMedic API.

1. Install dependencies using the repository's package manager.
2. Create `.env.local`:

   ```dotenv
   BACKEND_API_URL=http://localhost:3001
   ```

3. Start the development server using the `dev` script in `package.json` (for example, `yarn dev` or `npm run dev`, depending on this repository's lockfile).
4. Open the localhost URL printed by Next.js.

`BACKEND_API_URL` is used by the server-side proxy. Do **not** prefix it with `NEXT_PUBLIC_` unless you intentionally want to expose the upstream URL to browsers.

## Frontend routes and API proxy

| Route | Purpose |
| --- | --- |
| `/repairs` | Repair dashboard and history |
| `/repairs/new` | New repair form |
| `/repairs/[id]` | Timeline, assessment, test evidence, and patch review |
| `GET /api/backend/repairs` | List jobs |
| `POST /api/backend/repairs` | Submit a job |
| `GET /api/backend/repairs/:id` | Fetch job details |
| `GET /api/backend/repairs/:id/events` | Fetch events |
| `GET /api/backend/repairs/:id/patch` | Download a patch when available |

Example submission:

```json
{
  "issue_url": "https://github.com/AbdLim/repomedic-bench/issues/1",
  "environment": {}
}
```

## Demonstrated scenarios

- **Verified bug:** [RepoMedic Bench issue #1](https://github.com/AbdLim/repomedic-bench/issues/1). The agent identified an unhandled duplicate-registration exception, proposed HTTP `409` instead of `500`, and reported a failing original regression followed by a passing regression and test suite.
- **Actionable suggestion:** [Splitz API issue #4](https://github.com/mubex-dot/splitz-api/issues/4). The agent identified an unsupported email/password usage against a phone-and-name login flow, then proposed a separate enhancement rather than changing the repository.

These are observed examples, not a measured success rate across arbitrary repositories.

## Security and limitations

- Only submit repositories you are authorized to analyze. The current MVP targets public Python repositories with supported test environments.
- Do not provide production secrets. **The code executed in the sandbox can read variables passed to it**, so use disposable test credentials only.
- The UI and API should not persist or display secret values in reports; review the deployed implementation before making a stronger confidentiality claim.
- Suggestions may lack executable test evidence. Patches always require developer review before applying.

## Related repositories

- [Backend API](https://github.com/abdlim/repomedic-api)
- [AI service](https://github.com/abdlim/repomedic-ai)
- [Benchmark repository](https://github.com/AbdLim/repomedic-bench)

## License

See [LICENSE](LICENSE).
