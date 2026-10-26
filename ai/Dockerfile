FROM python:3.12-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# copy dependency files (replaces --mount=type=bind)
COPY uv.lock pyproject.toml ./

# install dependencies (removed --mount=type=cache for compatibility)
RUN uv sync --frozen --no-install-project --no-dev

COPY . .

# sync project
RUN uv sync --frozen --no-dev

#
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    tar \
    && curl -fsSL https://railway.com/install.sh | sh -s -- --force --bin-dir /usr/local/bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

EXPOSE 8000

COPY start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]
