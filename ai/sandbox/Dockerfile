FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/workspace

RUN pip install --no-cache-dir \
    "pytest>=8.3,<10" \
    "fastapi>=0.115,<1" \
    "httpx>=0.27,<1" \
    "pydantic>=2.9,<3"

WORKDIR /workspace
USER 65534:65534
