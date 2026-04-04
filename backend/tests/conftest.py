# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from main import app
from app.auth import get_current_user

MOCK_USER = {"user_id": "user-abc", "token": "test-token"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    yield TestClient(app)
    app.dependency_overrides.clear()
