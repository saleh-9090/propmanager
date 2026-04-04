# backend/tests/test_units.py
import io
from unittest.mock import AsyncMock, patch

OWNER = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
CFO   = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_UNIT = {
    "id": "unit-333",
    "building_id": "bldg-222", "project_id": "proj-111", "company_id": "company-123",
    "unit_number": "A-101", "floor": 1, "area_sqm": 120.0, "price": 450000.0,
    "sak_id": "SAK001", "status": "available",
    "electricity_meter_id": None, "water_meter_id": None,
}

VALID_CSV = (
    "building_number,unit_number,floor,area_sqm,price,sak_id\n"
    "A,A-101,1,120.0,450000,SAK001\n"
    "A,A-102,1,115.0,430000,SAK002\n"
)

BUILDINGS_IN_PROJECT = [
    {"id": "bldg-222", "building_number": "A"},
]


def test_list_units_by_building(client):
    with patch("app.routers.units.supabase_client.get_units", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_UNIT]
        response = client.get("/units", params={"building_id": "bldg-222"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("bldg-222", None, "test-token")


def test_list_units_by_project(client):
    with patch("app.routers.units.supabase_client.get_units", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_UNIT]
        response = client.get("/units", params={"project_id": "proj-111"})
        assert response.status_code == 200
        mock.assert_called_once_with(None, "proj-111", "test-token")


def test_list_units_all(client):
    with patch("app.routers.units.supabase_client.get_units", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_UNIT]
        response = client.get("/units")
        assert response.status_code == 200
        mock.assert_called_once_with(None, None, "test-token")


def test_create_unit_as_owner(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.create_unit", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = OWNER
        mock_create.return_value = MOCK_UNIT
        response = client.post("/units", json={
            "building_id": "bldg-222", "project_id": "proj-111",
            "unit_number": "A-101", "floor": 1,
            "area_sqm": 120.0, "price": 450000.0, "sak_id": "SAK001",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"


def test_create_unit_rejects_cfo(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/units", json={
            "building_id": "bldg-222", "project_id": "proj-111",
            "unit_number": "A-101", "floor": 1,
            "area_sqm": 120.0, "price": 450000.0, "sak_id": "SAK001",
        })
        assert response.status_code == 403


def test_update_unit(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.update_unit", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/units/unit-333", json={"price": 460000.0})
        assert response.status_code == 200
        mock_update.assert_called_once_with("unit-333", {"price": 460000.0}, "test-token")


def test_delete_unit_as_owner(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.delete_unit", new_callable=AsyncMock) as mock_delete:
        mock_profile.return_value = OWNER
        mock_delete.return_value = None
        response = client.delete("/units/unit-333")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("unit-333", "test-token")


def test_delete_unit_rejects_sales_manager(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = SALES
        response = client.delete("/units/unit-333")
        assert response.status_code == 403


def test_import_units_success(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.get_buildings_in_project", new_callable=AsyncMock) as mock_buildings, \
         patch("app.routers.units.supabase_client.get_existing_sak_ids", new_callable=AsyncMock) as mock_saks, \
         patch("app.routers.units.supabase_client.bulk_insert_units", new_callable=AsyncMock) as mock_insert:
        mock_profile.return_value = OWNER
        mock_buildings.return_value = BUILDINGS_IN_PROJECT
        mock_saks.return_value = []
        mock_insert.return_value = None
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", VALID_CSV.encode(), "text/csv")},
        )
        assert response.status_code == 200
        assert response.json()["imported"] == 2
        inserted = mock_insert.call_args[0][0]
        assert len(inserted) == 2
        assert inserted[0]["sak_id"] == "SAK001"
        assert inserted[0]["company_id"] == "company-123"
        assert inserted[0]["building_id"] == "bldg-222"


def test_import_units_bad_building(client):
    bad_csv = (
        "building_number,unit_number,floor,area_sqm,price,sak_id\n"
        "Z,A-101,1,120.0,450000,SAK001\n"  # building Z doesn't exist
    )
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.get_buildings_in_project", new_callable=AsyncMock) as mock_buildings:
        mock_profile.return_value = OWNER
        mock_buildings.return_value = BUILDINGS_IN_PROJECT
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", bad_csv.encode(), "text/csv")},
        )
        assert response.status_code == 422
        errors = response.json()["detail"]["errors"]
        assert any(e["field"] == "building_number" for e in errors)


def test_import_units_duplicate_sak_in_file(client):
    dup_csv = (
        "building_number,unit_number,floor,area_sqm,price,sak_id\n"
        "A,A-101,1,120.0,450000,SAK001\n"
        "A,A-102,1,115.0,430000,SAK001\n"  # duplicate SAK001
    )
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.get_buildings_in_project", new_callable=AsyncMock) as mock_buildings:
        mock_profile.return_value = OWNER
        mock_buildings.return_value = BUILDINGS_IN_PROJECT
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", dup_csv.encode(), "text/csv")},
        )
        assert response.status_code == 422
        errors = response.json()["detail"]["errors"]
        assert any("Duplicate" in e["message"] for e in errors)


def test_import_units_existing_sak_in_db(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.units.supabase_client.get_buildings_in_project", new_callable=AsyncMock) as mock_buildings, \
         patch("app.routers.units.supabase_client.get_existing_sak_ids", new_callable=AsyncMock) as mock_saks:
        mock_profile.return_value = OWNER
        mock_buildings.return_value = BUILDINGS_IN_PROJECT
        mock_saks.return_value = ["SAK001"]  # already in DB
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", VALID_CSV.encode(), "text/csv")},
        )
        assert response.status_code == 422
        errors = response.json()["detail"]["errors"]
        assert any("already exists" in e["message"] for e in errors)


def test_import_units_missing_columns(client):
    bad_csv = "unit_number,floor\nA-101,1\n"  # missing required columns
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = OWNER
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", bad_csv.encode(), "text/csv")},
        )
        assert response.status_code == 422


def test_import_units_rejects_cfo(client):
    with patch("app.routers.units.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post(
            "/units/import",
            params={"project_id": "proj-111"},
            files={"file": ("units.csv", VALID_CSV.encode(), "text/csv")},
        )
        assert response.status_code == 403
