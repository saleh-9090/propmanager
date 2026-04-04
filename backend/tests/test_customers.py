# backend/tests/test_customers.py
from unittest.mock import AsyncMock, patch

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
RES_MGR = {"id": "user-abc", "company_id": "company-123", "role": "reservation_manager"}
CFO     = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_CUSTOMER = {
    "id": "cust-111",
    "company_id": "company-123",
    "full_name": "محمد علي",
    "id_type": "national_id",
    "id_number": "1234567890",
    "phone": "0501234567",
    "email": None,
    "birthdate": None,
    "lead_source": "direct",
    "notes": None,
}


def test_list_customers_no_search(client):
    with patch("app.routers.customers.supabase_client.get_customers", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_CUSTOMER]
        response = client.get("/customers")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with(None, "test-token")


def test_list_customers_with_search(client):
    with patch("app.routers.customers.supabase_client.get_customers", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_CUSTOMER]
        response = client.get("/customers", params={"search": "محمد"})
        assert response.status_code == 200
        mock.assert_called_once_with("محمد", "test-token")


def test_create_customer_as_owner(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.create_customer", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = OWNER
        mock_create.return_value = MOCK_CUSTOMER
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["full_name"] == "محمد علي"


def test_create_customer_as_reservation_manager(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.create_customer", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = RES_MGR
        mock_create.return_value = MOCK_CUSTOMER
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 201


def test_create_customer_rejects_cfo(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 403


def test_update_customer(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.update_customer", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/customers/cust-111", json={"phone": "0509999999"})
        assert response.status_code == 200
        mock_update.assert_called_once_with("cust-111", {"phone": "0509999999"}, "test-token")


def test_delete_customer_as_owner(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.delete_customer", new_callable=AsyncMock) as mock_delete:
        mock_profile.return_value = OWNER
        mock_delete.return_value = None
        response = client.delete("/customers/cust-111")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("cust-111", "test-token")


def test_delete_customer_rejects_sales_manager(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = SALES
        response = client.delete("/customers/cust-111")
        assert response.status_code == 403
