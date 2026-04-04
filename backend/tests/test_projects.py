# backend/tests/test_projects.py
from unittest.mock import AsyncMock, patch

OWNER = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
CFO   = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_PROJECT = {
    "id": "proj-111", "company_id": "company-123",
    "name": "Al Narjis", "name_ar": "النرجس",
    "project_number": "P001", "city": "الرياض", "buildings": [],
}


def test_list_projects(client):
    with patch("app.routers.projects.supabase_client.get_projects_with_buildings", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_PROJECT]
        response = client.get("/projects")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("test-token")


def test_create_project_as_owner(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.projects.supabase_client.create_project", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = OWNER
        mock_create.return_value = MOCK_PROJECT
        response = client.post("/projects", json={
            "name": "Al Narjis", "name_ar": "النرجس", "project_number": "P001",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["name"] == "Al Narjis"


def test_create_project_as_sales_manager(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.projects.supabase_client.create_project", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = SALES
        mock_create.return_value = MOCK_PROJECT
        response = client.post("/projects", json={
            "name": "Al Narjis", "project_number": "P001",
        })
        assert response.status_code == 201


def test_create_project_rejects_cfo(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/projects", json={
            "name": "Al Narjis", "project_number": "P001",
        })
        assert response.status_code == 403


def test_update_project(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.projects.supabase_client.update_project", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/projects/proj-111", json={"city": "جدة"})
        assert response.status_code == 200
        mock_update.assert_called_once_with("proj-111", {"city": "جدة"}, "test-token")


def test_delete_project_as_owner(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.projects.supabase_client.delete_project", new_callable=AsyncMock) as mock_delete:
        mock_profile.return_value = OWNER
        mock_delete.return_value = None
        response = client.delete("/projects/proj-111")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("proj-111", "test-token")


def test_delete_project_rejects_sales_manager(client):
    with patch("app.routers.projects.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = SALES
        response = client.delete("/projects/proj-111")
        assert response.status_code == 403
