import asyncio
import subprocess
import sys

import uvicorn


def dev() -> None:
    """Run the AI service in development mode with hot reload."""
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)


def start() -> None:
    """Run the AI service in production mode."""
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)


def test() -> None:
    """Run the test suite."""
    subprocess.run(["pytest", "-v", *sys.argv[1:]])


def migrate() -> None:
    """Apply pending database migrations."""
    subprocess.run(["alembic", "upgrade", "head", *sys.argv[1:]])


def makemigrations() -> None:
    """Generate a new Alembic migration file."""
    args = sys.argv[1:]
    command = ["alembic", "revision", "--autogenerate"]
    if not any(arg in ["-m", "--message"] for arg in args):
        command += ["-m", "auto migration"]
    subprocess.run(command + args)


def worker() -> None:
    """Run a background worker process.

    Usage:
        uv run worker document
        uv run worker embedding
        uv run worker generation
    """
    worker_name = sys.argv[1] if len(sys.argv) > 1 else ""

    worker_map = {
        "document": "app.workers.document_worker",
        "embedding": "app.workers.embedding_worker",
        "generation": "app.workers.generation_worker",
    }

    if worker_name not in worker_map:
        print(f"Unknown worker: '{worker_name}'")
        print(f"Available workers: {', '.join(worker_map.keys())}")
        sys.exit(1)

    module_path = worker_map[worker_name]
    import importlib

    module = importlib.import_module(module_path)

    print(f"Starting worker: {worker_name}")
    asyncio.run(module.run())
