from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_internal_route_requires_key() -> None:
    response = TestClient(app).get("/internal/ai/ping")
    assert response.status_code == 401


def test_internal_route_rejects_wrong_key() -> None:
    response = TestClient(app).get("/internal/ai/ping", headers={"X-Internal-API-Key": "incorrect"})
    assert response.status_code == 401
