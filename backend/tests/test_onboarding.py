# backend/tests/test_onboarding.py
from unittest.mock import AsyncMock, patch


def test_onboarding_creates_company_and_profile(client):
    with patch("app.routers.onboarding.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.onboarding.supabase_client.insert_company", new_callable=AsyncMock) as mock_company, \
         patch("app.routers.onboarding.supabase_client.insert_user_profile", new_callable=AsyncMock) as mock_profile:

        mock_get.return_value = None
        mock_company.return_value = {"id": "company-123"}
        mock_profile.return_value = {"id": "user-abc"}

        response = client.post("/onboarding", json={
            "company_name": "Al-Narjis Real Estate",
            "company_name_ar": "شركة النرجس للتطوير العقاري",
            "full_name": "محمد العلي",
            "phone": "0501234567",
        })

        assert response.status_code == 200
        assert response.json()["company_id"] == "company-123"
        mock_company.assert_called_once_with({
            "name": "Al-Narjis Real Estate",
            "name_ar": "شركة النرجس للتطوير العقاري",
            "rega_license": None,
        })
        mock_profile.assert_called_once_with({
            "id": "user-abc",
            "company_id": "company-123",
            "full_name": "محمد العلي",
            "phone": "0501234567",
            "role": "owner",
        })


def test_onboarding_rejects_existing_profile(client):
    with patch("app.routers.onboarding.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"id": "user-abc", "company_id": "company-123", "role": "owner"}

        response = client.post("/onboarding", json={
            "company_name": "Al-Narjis Real Estate",
            "full_name": "محمد العلي",
        })

        assert response.status_code == 409


def test_onboarding_requires_company_name(client):
    response = client.post("/onboarding", json={"full_name": "محمد العلي"})
    assert response.status_code == 422


def test_onboarding_requires_full_name(client):
    response = client.post("/onboarding", json={"company_name": "Test Co"})
    assert response.status_code == 422
