# RepoMedic AI

**The issue-triage and evidence-backed code repair engine behind RepoMedic.** Built with FastAPI, NVIDIA Nemotron through Nebius Token Factory, and isolated test execution.

Given a public GitHub issue, the service first assesses what the report means. Genuine, reproducible Python bugs enter a bounded regression-and-repair workflow; feature requests and usage mismatches receive implementation suggestions without pretending a bug was verified.

> This repository is the **AI service**, not the entire application. See [Web](https://github.com/abdlim/repomedic-web) and [API](https://github.com/abdlim/repomedic-api).

**Live frontend:** `https://repomedic-web.vercel.app`
**Hackathon:** [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/) · Coding and Agentic Engineering

## Why RepoMedic is different

A code suggestion is not the same as a verified fix. RepoMedic attempts to establish a reproducible baseline, applies a model-generated patch to a **disposable copy** of the repository, and reports the actual test outcome. When the issue describes unsupported behavior rather than a defect, it returns an actionable suggestion instead.

RepoMedic never commits or pushes patches to the original GitHub repository.

## Repair pipeline

```text
Public GitHub issue URL
       |
       v
Fetch issue + pinned repository snapshot
       |
       v
Assess issue type and expected behavior
       |
       +--> usage mismatch / feature request --> implementation suggestion
       |
       +--> unclear --> clarification / non-repair result
       |
       v
Bug: prepare isolated Python environment
       |
       v
Investigate cause with NVIDIA Nemotron
       |
       v
Generate regression test --> run baseline on original source
       |
       +--> test-generation failure --> bounded correction attempts
       |
       +--> not reproduced / environment failure --> honest non-verified result
       |
       v
Generate patch --> run regression + existing suite on patched copy
       |
       +--> bounded patch retry, if needed
       |
       v
Report: diagnosis, test output, status, and unified diff
```

### Model and infrastructure

- **NVIDIA model:** `nvidia/nemotron-3-super-120b-a12b`
- **Inference platform:** Nebius Token Factory, accessed with an OpenAI-compatible API
- **API / orchestration:** Python and FastAPI, with Pydantic-validated structured outputs
- **Repository retrieval:** GitHub API and complete pinned source archive
- **Python dependencies:** supported `pyproject.toml` + `uv.lock` projects
- **Execution:** prepared Python image and pytest, with isolated sandbox backends

Nemotron drives issue assessment, code investigation, regression generation, and proposed patches. The final verification result comes from **executed tests**, not the model's self-assessment.

## Sandbox providers

| Setting | Behavior | Typical use |
| --- | --- | --- |
| `docker` | Uses the local Docker daemon for dependency builds and tests | Local development |
| `railway` | Creates and executes work in a Railway ephemeral sandbox | Deployed execution |
| `auto` | Chooses Railway in a detected Railway context, otherwise local Docker | Portable configuration |

The deployed service uses Railway for the API and ephemeral execution environments; the frontend is hosted separately on Vercel.

**Security boundary:** Sandbox execution involves untrusted repository code. Isolation controls reduce risk but do not guarantee safety. Use approved test repositories and disposable credentials for the public demo; do not pass production secrets.

## Local setup

**Prerequisites:** Python 3.12+, [uv](https://docs.astral.sh/uv/), Docker for the local sandbox provider, a Nebius Token Factory API key, and optional GitHub API token.

```bash
uv sync
```

Create `.env` with the settings required by your application:

```dotenv
INTERNAL_API_KEY=replace_with_shared_service_key
GITHUB_TOKEN=

NEBIUS_API_KEY=replace_with_nebius_key
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_MODEL=nvidia/nemotron-3-super-120b-a12b

SANDBOX_PROVIDER=docker
SANDBOX_TIMEOUT_SECONDS=45
```

Start the API with the template's CLI script:

```bash
uv run dev
```

Run tests and static checks:

```bash
uv run pytest -q
uv run ruff check .
```

The repair route used by the Express integration is:

```http
POST /internal/repairs/run
Content-Type: application/json
X-Internal-API-Key: YOUR_INTERNAL_API_KEY

{
  "issue_url": "https://github.com/AbdLim/repomedic-bench/issues/1",
  "environment": {}
}
```

Use the endpoint only through trusted server-side integrations. Its `environment` object is optional and intended for **test-only settings**, not production credentials.

## Railway deployment

The deployed AI service runs on Railway, while repository code is executed through ephemeral Railway sandboxes instead of trying to run nested Docker directly inside the ordinary web-service container.

Relevant settings:

```dotenv
SANDBOX_PROVIDER=railway
RAILWAY_API_TOKEN=replace_with_railway_token
RAILWAY_ENVIRONMENT_ID=replace_with_environment_id
RAILWAY_PROJECT_ID=replace_with_project_id
```

Set `NEBIUS_API_KEY` and the private `INTERNAL_API_KEY` in Railway as well. Project and environment IDs may be injected in your Railway deployment, but verify them before relying on automatic detection. Ensure the container includes the Railway CLI if your provider invokes that CLI.

To test deployment, run a **known benchmark issue** through the web frontend. Confirm that it progresses past environment preparation, executes a failing baseline, returns a passing patched regression, and destroys its ephemeral sandbox.

## Demonstrated results

### Verified repair: duplicate registration

[repomedic-bench issue #1](https://github.com/AbdLim/repomedic-bench/issues/1)

- Diagnosed an unhandled `RuntimeError` for duplicate email registration.
- Proposed replacing it with an `HTTPException` returning `409 Conflict`.
- Baseline: **1 test failed** against the original repository.
- Patched regression: **1 passed**.
- Patched test suite: **4 passed**.

These counts refer to one observed benchmark run; no overall accuracy or success-rate claim is implied.

### Suggestion: unsupported authentication method

[splitz-api issue #4](https://github.com/mubex-dot/splitz-api/issues/4)

RepoMedic identified that the app's existing login flow accepted phone number and name rather than email/password credentials. It classified the issue as a usage mismatch and suggested an additional email/password endpoint without attempting an unwarranted code repair.

## Known boundaries

- Public GitHub issues and supported Python repositories; broad language and dependency-manager compatibility are out of scope for this MVP.
- Model-generated tests may be incorrect. Failed test collection, missing environment configuration, and ambiguous requirements are not proof of an application bug.
- Passing executed tests supports a limited verification claim, not guaranteed correctness or security.
- User-provided sandbox variables are readable by the repository's code; avoid real secrets and keep values out of model prompts and stored reports.
- The service generates **proposed** patches, not GitHub pull requests or live production code changes.

## Related repositories

- [Frontend](https://github.com/abdlim/repomedic-web)
- [Backend](https://github.com/abdlim/repomedic-api)
- [Benchmark](https://github.com/AbdLim/repomedic-bench)

## License

See [LICENSE](LICENSE).
