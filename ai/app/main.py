from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.features.repairs.router import router as repairs_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=("AI Service for RepoMagic"),
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

# --- Routers ---

app.include_router(repairs_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
