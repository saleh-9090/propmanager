# backend/tests/test_reservations.py
from unittest.mock import AsyncMock, patch
import pytest

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
CFO     = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_UNIT = {
    "id": "unit-111",
    "company_id": "company-123",
    "unit_number": "A101",
    "building_id": "bldg-1",
    "project_id": "proj-1",
    "floor": 1,
    "area_sqm": 120,
    "price": 500000,
    "status": "available",
    "sak_id": "SAK-001",
}

MOCK_RESERVATION = {
    "id": "res-111",
    "company_id": "company-123",
    "unit_id": "unit-111",
    "customer_id": "cust-111",
    "status": "active",
    "deposit_amount": 10000,
    "payment_method": "bank_transfer",
    "payment_reference": "REF123",
    "payment_date": "2026-04-01",
    "expires_at": "2026-04-15",
    "receipt_file_url": None,
    "notes": None,
    "units": {"unit_number": "A101", "building_id": "bldg-1", "price": 500000},
    "customers": {"full_name": "محمد علي", "id_number": "1234567890"},
}


def test_list_reservations(client):
    with patch("app.routers.reservations.supabase_client.get_reservations", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_RESERVATION]
        response = client.get("/reservations")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("test-token")


def test_create_reservation_as_owner(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit, \
         patch("app.routers.reservations.supabase_client.create_reservation", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.reservations.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT
        mock_create.return_value = MOCK_RESERVATION
        mock_unit_status.return_value = None
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "bank_transfer",
            "payment_reference": "REF123",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["unit_id"] == "unit-111"
        mock_unit_status.assert_called_once_with("unit-111", "reserved", "test-token")


def test_create_reservation_rejects_cfo(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 403


def test_create_reservation_unit_not_available(client):
    reserved_unit = {**MOCK_UNIT, "status": "reserved"}
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit:
        mock_profile.return_value = OWNER
        mock_unit.return_value = reserved_unit
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 409


def test_patch_reservation(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.update_reservation", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/reservations/res-111", json={"deposit_amount": 15000})
        assert response.status_code == 200
        mock_update.assert_called_once_with("res-111", {"deposit_amount": 15000}, "test-token")


def test_patch_reservation_rejects_cfo(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.patch("/reservations/res-111", json={"deposit_amount": 15000})
        assert response.status_code == 403


def test_cancel_reservation(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_reservation", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.reservations.supabase_client.cancel_reservation", new_callable=AsyncMock) as mock_cancel, \
         patch("app.routers.reservations.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_get.return_value = MOCK_RESERVATION
        mock_cancel.return_value = None
        mock_unit_status.return_value = None
        response = client.post("/reservations/res-111/cancel", json={
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 10000,
        })
        assert response.status_code == 200
        mock_cancel.assert_called_once_with("res-111", {
            "status": "cancelled",
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 10000,
        }, "test-token")
        mock_unit_status.assert_called_once_with("unit-111", "available", "test-token")


def test_cancel_reservation_rejects_cfo(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/reservations/res-111/cancel", json={
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 0,
        })
        assert response.status_code == 403
