# backend/tests/test_buildings.py
from unittest.mock import AsyncMock, patch

OWNER = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
CFO   = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_BUILDING = {
    "id": "bldg-222", "project_id": "proj-111", "company_id": "company-123",
    "building_number": "A", "name": "برج الشمال", "total_floors": 10,
}


def test_create_building_as_owner(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.buildings.supabase_client.create_building", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = OWNER
        mock_create.return_value = MOCK_BUILDING
        response = client.post("/buildings", json={
            "project_id": "proj-111", "building_number": "A", "total_floors": 10,
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["building_number"] == "A"


def test_create_building_as_sales_manager(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.buildings.supabase_client.create_building", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = SALES
        mock_create.return_value = MOCK_BUILDING
        response = client.post("/buildings", json={
            "project_id": "proj-111", "building_number": "A",
        })
        assert response.status_code == 201


def test_create_building_rejects_cfo(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/buildings", json={
            "project_id": "proj-111", "building_number": "A",
        })
        assert response.status_code == 403


def test_update_building(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.buildings.supabase_client.update_building", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/buildings/bldg-222", json={"total_floors": 12})
        assert response.status_code == 200
        mock_update.assert_called_once_with("bldg-222", {"total_floors": 12}, "test-token")


def test_delete_building_as_owner(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.buildings.supabase_client.delete_building", new_callable=AsyncMock) as mock_delete:
        mock_profile.return_value = OWNER
        mock_delete.return_value = None
        response = client.delete("/buildings/bldg-222")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("bldg-222", "test-token")


def test_delete_building_rejects_sales_manager(client):
    with patch("app.routers.buildings.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = SALES
        response = client.delete("/buildings/bldg-222")
        assert response.status_code == 403
