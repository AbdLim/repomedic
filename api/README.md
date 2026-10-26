# RepoMedic API

**The Express + TypeScript backend for RepoMedic.** It accepts GitHub issue submissions, maintains durable repair jobs in PostgreSQL, dispatches work to the AI service, and exposes progress, reports, and downloadable patches to the frontend.

> This is one component of RepoMedic. See [RepoMedic Web](https://github.com/abdlim/repomedic-web) and [RepoMedic AI](https://github.com/abdlim/repomedic-ai) for the complete system.

**Live frontend:** `https://repomedic-web.vercel.app`
**Deployment:** Railway · **Hackathon track:** Coding and Agentic Engineering

## Responsibilities

- Validate public GitHub issue URLs and fetch issue metadata.
- Create and persist asynchronous repair jobs.
- Claim queued work using PostgreSQL locking (`FOR UPDATE SKIP LOCKED`).
- Call the private FastAPI repair endpoint from a background worker.
- Persist lifecycle status, events, issue assessments, test results, suggested changes, and unified patches.
- Provide a stable REST API to the Next.js frontend.

The backend **does not run repository tests or call the LLM itself**. That belongs to the AI service.

## Architecture

```text
Next.js (Vercel)
      |
      v
Express API (Railway) ---> PostgreSQL (jobs and reports)
      |
      +--> background worker --> FastAPI AI service (Railway)
                                      |
                                      +--> Nebius Token Factory
                                      +--> isolated sandbox execution
```

### Job lifecycle

1. **Submit:** Validate issue URL and create a `queued` repair; respond `202 Accepted`.
2. **Claim:** The embedded worker claims available jobs using database locks.
3. **Execute:** The worker calls the internal FastAPI repair API with the issue and optional test environment.
4. **Persist:** Save the AI result, issue classification, verification evidence, and timeline.
5. **Read:** Clients poll the repair endpoint to show updated status and final results.

A completed job may contain a **verified repair, an unverified result, or a suggestion**. Completion of job processing alone does not imply a verified patch.

## API endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/repairs` | Queue a new repair |
| `GET` | `/api/v1/repairs` | List recent jobs |
| `GET` | `/api/v1/repairs/:id` | Retrieve status and report |
| `GET` | `/api/v1/repairs/:id/events` | Retrieve event timeline |
| `GET` | `/api/v1/repairs/:id/patch` | Download the proposed `.patch`, when available |

Example:

```http
POST /api/v1/repairs
Content-Type: application/json

{
  "issue_url": "https://github.com/AbdLim/repomedic-bench/issues/1",
  "environment": {}
}
```

The returned repair identifier can be passed to `GET /api/v1/repairs/:id` to follow execution. Internal AI requests require the matching shared service credential.

## Tech stack

- Node.js, Express, TypeScript
- PostgreSQL and Drizzle ORM
- Embedded background worker, HTTP integration with FastAPI
- Railway for deployment

## Local setup

**Prerequisites:** Node.js 20+, Yarn 4/Corepack, PostgreSQL, and a running RepoMedic AI service.

```bash
corepack enable
yarn install
cp example.env .env
```

Configure the values in `.env`:

```dotenv
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/repomedic
AI_SERVICE_URL=http://localhost:8000
INTERNAL_API_KEY=replace_with_shared_service_key
GITHUB_TOKEN=
ENABLE_WORKER=true
RUN_MIGRATIONS=true
```

> **Verify the internal auth key name against the current integration implementation and `example.env`.** The AI service uses `INTERNAL_API_KEY`, but a backend template may name the same shared value differently. Both sides must agree.

Then run:

```bash
yarn db:migrate
yarn dev
```

The codebase also provides build and start scripts:

```bash
yarn build
yarn start
```

If `RUN_MIGRATIONS=true`, the service is configured to apply migrations on startup; avoid concurrent migrations across multiple replicas without coordinating deployment.

## Deployment

The API and its database run on Railway. The embedded worker can run in the same service when `ENABLE_WORKER=true`.

For a single-instance hackathon MVP, this is a simple deployment model. Multi-instance deployment requires deliberate concurrency and failure-recovery testing rather than assuming the embedded worker acts like a dedicated queue service.

## Security and operational notes

- Keep the AI service credential server-side only.
- Optional test environment values must be handled as sensitive inputs. Do not log or persist raw credentials unintentionally; review the worker handoff and storage lifecycle.
- Apply rate limits or demo access restrictions before allowing arbitrary public submissions; repository execution is expensive and potentially unsafe.
- API job statuses and AI verification outcomes are separate concepts.
- A `.patch` is a proposed change, not a GitHub commit or pull request.

## Related repositories

- [Frontend](https://github.com/abdlim/repomedic-web)
- [AI service](https://github.com/abdlim/repomedic-ai)
- [Benchmark](https://github.com/AbdLim/repomedic-bench)

## License

See [LICENSE](LICENSE).
