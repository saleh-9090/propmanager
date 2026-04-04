# backend/tests/test_users.py
from unittest.mock import AsyncMock, patch

OWNER_PROFILE = {"id": "user-abc", "company_id": "company-123", "role": "owner", "full_name": "محمد"}
STAFF_PROFILE = {"id": "user-def", "company_id": "company-123", "role": "sales_manager", "full_name": "سارة"}


def test_list_users_returns_company_profiles(client):
    with patch("app.routers.users.supabase_client.get_company_profiles", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = [OWNER_PROFILE, STAFF_PROFILE]

        response = client.get("/users")

        assert response.status_code == 200
        assert len(response.json()) == 2
        mock_list.assert_called_once_with("test-token")


def test_invite_user_creates_profile(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.users.supabase_client.invite_auth_user", new_callable=AsyncMock) as mock_invite, \
         patch("app.routers.users.supabase_client.insert_user_profile", new_callable=AsyncMock) as mock_profile:

        mock_get.return_value = OWNER_PROFILE
        mock_invite.return_value = {"id": "user-new"}
        mock_profile.return_value = {"id": "user-new"}

        response = client.post("/users/invite", json={
            "email": "sara@company.sa",
            "full_name": "سارة",
            "role": "sales_manager",
        })

        assert response.status_code == 201
        assert response.json()["user_id"] == "user-new"
        mock_profile.assert_called_once_with({
            "id": "user-new",
            "company_id": "company-123",
            "full_name": "سارة",
            "role": "sales_manager",
            "phone": None,
        })


def test_invite_user_rejects_non_owner(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = STAFF_PROFILE

        response = client.post("/users/invite", json={
            "email": "other@company.sa",
            "full_name": "آخر",
            "role": "accountant",
        })

        assert response.status_code == 403


def test_invite_user_rejects_invalid_role(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = OWNER_PROFILE

        response = client.post("/users/invite", json={
            "email": "x@company.sa",
            "full_name": "خالد",
            "role": "superadmin",
        })

        assert response.status_code == 422


def test_update_role_as_owner(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.users.supabase_client.get_user_profile_in_company", new_callable=AsyncMock) as mock_target, \
         patch("app.routers.users.supabase_client.update_user_role", new_callable=AsyncMock) as mock_update:

        mock_get.return_value = OWNER_PROFILE
        mock_target.return_value = STAFF_PROFILE
        mock_update.return_value = None

        response = client.patch("/users/user-def/role", json={"role": "accountant"})

        assert response.status_code == 200
        mock_update.assert_called_once_with("user-def", "accountant")


def test_delete_user_as_owner(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.users.supabase_client.get_user_profile_in_company", new_callable=AsyncMock) as mock_target, \
         patch("app.routers.users.supabase_client.delete_auth_user", new_callable=AsyncMock) as mock_delete:

        mock_get.return_value = OWNER_PROFILE
        mock_target.return_value = STAFF_PROFILE
        mock_delete.return_value = None

        response = client.delete("/users/user-def")

        assert response.status_code == 204
        mock_delete.assert_called_once_with("user-def")


def test_delete_user_cannot_delete_self(client):
    with patch("app.routers.users.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = OWNER_PROFILE

        response = client.delete("/users/user-abc")  # same as MOCK_USER["user_id"]

        assert response.status_code == 400
