# backend/tests/test_sales.py
from unittest.mock import AsyncMock, patch

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
RES_MGR = {"id": "user-abc", "company_id": "company-123", "role": "reservation_manager"}

MOCK_UNIT_AVAILABLE = {
    "id": "unit-111", "company_id": "company-123", "unit_number": "A101",
    "building_id": "bldg-1", "project_id": "proj-1", "status": "available",
    "floor": 1, "area_sqm": 120, "price": 500000, "sak_id": "SAK-001",
}
MOCK_UNIT_RESERVED = {**MOCK_UNIT_AVAILABLE, "status": "reserved"}

MOCK_RESERVATION_ACTIVE = {
    "id": "res-111", "company_id": "company-123", "unit_id": "unit-111",
    "customer_id": "cust-111", "status": "active", "deposit_amount": 10000,
    "payment_method": "bank_transfer", "payment_date": "2026-04-01",
    "expires_at": "2026-04-15", "deposit_returned": False,
}
MOCK_RESERVATION_CONVERTED = {**MOCK_RESERVATION_ACTIVE, "status": "converted"}

MOCK_SALE = {
    "id": "sale-111", "company_id": "company-123", "unit_id": "unit-111",
    "customer_id": "cust-111", "reservation_id": None, "status": "completed",
    "payment_amount": 500000, "payment_method": "bank_transfer",
    "payment_date": "2026-04-01",
    "units": {"unit_number": "A101", "building_id": "bldg-1"},
    "customers": {"full_name": "محمد علي", "id_number": "1234567890"},
}


def test_list_sales(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_sales", new_callable=AsyncMock) as mock:
        mock_profile.return_value = OWNER
        mock.return_value = [MOCK_SALE]
        response = client.get("/sales")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("test-token")


def test_list_sales_rejects_reservation_manager(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = RES_MGR
        response = client.get("/sales")
        assert response.status_code == 403


def test_create_direct_sale_as_owner(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit, \
         patch("app.routers.sales.supabase_client.create_sale", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.sales.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT_AVAILABLE
        mock_create.return_value = MOCK_SALE
        mock_unit_status.return_value = None
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "bank_transfer",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["status"] == "completed"
        mock_unit_status.assert_called_once_with("unit-111", "sold", "test-token")


def test_create_direct_sale_rejects_reservation_manager(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = RES_MGR
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 403


def test_create_direct_sale_unit_not_available(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT_RESERVED
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 409


def test_create_sale_conversion(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_reservation", new_callable=AsyncMock) as mock_res, \
         patch("app.routers.sales.supabase_client.create_sale", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.sales.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status, \
         patch("app.routers.sales.supabase_client.update_reservation_status", new_callable=AsyncMock) as mock_res_status:
        mock_profile.return_value = OWNER
        mock_res.return_value = MOCK_RESERVATION_ACTIVE
        mock_create.return_value = {**MOCK_SALE, "reservation_id": "res-111"}
        mock_unit_status.return_value = None
        mock_res_status.return_value = None
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "reservation_id": "res-111",
            "payment_amount": 500000,
            "payment_method": "bank_transfer",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 201
        mock_unit_status.assert_called_once_with("unit-111", "sold", "test-token")
        mock_res_status.assert_called_once_with("res-111", "converted", "test-token")


def test_create_sale_conversion_invalid_reservation(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_reservation", new_callable=AsyncMock) as mock_res:
        mock_profile.return_value = OWNER
        mock_res.return_value = MOCK_RESERVATION_CONVERTED  # already converted
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "reservation_id": "res-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 409


def test_create_sale_conversion_unit_mismatch(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_reservation", new_callable=AsyncMock) as mock_res:
        mock_profile.return_value = OWNER
        mock_res.return_value = MOCK_RESERVATION_ACTIVE  # unit_id = "unit-111"
        response = client.post("/sales", json={
            "unit_id": "unit-999",  # wrong unit
            "customer_id": "cust-111",
            "reservation_id": "res-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 422
