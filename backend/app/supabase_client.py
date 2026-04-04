import httpx
from app.config import settings

_REST = f"{settings.supabase_url}/rest/v1"
_AUTH_ADMIN = f"{settings.supabase_url}/auth/v1/admin"
_AUTH = f"{settings.supabase_url}/auth/v1"

_SVC = {
    "apikey": settings.supabase_secret_key,
    "Authorization": f"Bearer {settings.supabase_secret_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def _user_headers(token: str) -> dict:
    return {
        "apikey": settings.supabase_secret_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def insert_company(data: dict) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/companies", json=data, headers=_SVC)
        r.raise_for_status()
        return r.json()[0]


async def insert_user_profile(data: dict) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/user_profiles", json=data, headers=_SVC)
        r.raise_for_status()
        return r.json()[0]


async def get_user_profile(user_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/user_profiles",
            params={"id": f"eq.{user_id}", "select": "*"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def get_user_profile_in_company(user_id: str, company_id: str) -> dict | None:
    """Service-role lookup — verifies target user belongs to company before writes."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/user_profiles",
            params={"id": f"eq.{user_id}", "company_id": f"eq.{company_id}", "select": "*"},
            headers=_SVC,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def get_company_profiles(token: str) -> list[dict]:
    """User-JWT call — RLS returns only profiles in the caller's company."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/user_profiles",
            params={"select": "*", "order": "created_at.asc"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def invite_auth_user(email: str) -> dict:
    """Calls Supabase invite endpoint — creates auth user + sends invite email."""
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{_AUTH_ADMIN}/invite",
            json={"email": email},
            headers=_SVC,
        )
        r.raise_for_status()
        return r.json()


async def update_user_role(user_id: str, role: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/user_profiles",
            params={"id": f"eq.{user_id}"},
            json={"role": role},
            headers=_SVC,
        )
        r.raise_for_status()
        if not r.json():
            raise ValueError(f"User {user_id} not found")


async def delete_auth_user(user_id: str) -> None:
    """Deletes from auth.users — cascades to user_profiles via FK."""
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_AUTH_ADMIN}/users/{user_id}",
            headers=_SVC,
        )
        r.raise_for_status()


# ── Projects ──────────────────────────────────────────────────────────────────

async def get_projects_with_buildings(token: str) -> list[dict]:
    """Returns projects with their buildings nested. RLS enforces company_id."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/projects",
            params={
                "select": "*,buildings(id,building_number,name,total_floors)",
                "order": "created_at.asc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def create_project(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/projects", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_project(project_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/projects",
            params={"id": f"eq.{project_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def delete_project(project_id: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/projects",
            params={"id": f"eq.{project_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


# ── Buildings ─────────────────────────────────────────────────────────────────

async def create_building(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/buildings", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_building(building_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/buildings",
            params={"id": f"eq.{building_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def delete_building(building_id: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/buildings",
            params={"id": f"eq.{building_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


# ── Units ─────────────────────────────────────────────────────────────────────

async def get_units(building_id: str | None, project_id: str | None, token: str) -> list[dict]:
    params: dict = {
        "select": "*",
        "order": "project_id.asc,building_id.asc,floor.asc,unit_number.asc",
    }
    if building_id:
        params["building_id"] = f"eq.{building_id}"
    elif project_id:
        params["project_id"] = f"eq.{project_id}"
    # else: no filter — RLS returns all units for the caller's company
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{_REST}/units", params=params, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()


async def create_unit(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/units", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_unit(unit_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def delete_unit(unit_id: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


# ── CSV import helpers ────────────────────────────────────────────────────────

async def get_buildings_in_project(project_id: str, token: str) -> list[dict]:
    """User-JWT read — returns buildings for the project (RLS enforces company)."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/buildings",
            params={"project_id": f"eq.{project_id}", "select": "id,building_number"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def get_existing_sak_ids(sak_ids: list[str]) -> list[str]:
    """Service-role check — SAK is globally unique across all companies."""
    if not sak_ids:
        return []
    sak_list = ",".join(sak_ids)
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/units",
            params={"sak_id": f"in.({sak_list})", "select": "sak_id"},
            headers=_SVC,
        )
        r.raise_for_status()
        return [row["sak_id"] for row in r.json()]


async def bulk_insert_units(units: list[dict]) -> None:
    """Service-role bulk insert — company_id is set explicitly by the caller."""
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/units", json=units, headers=_SVC)
        r.raise_for_status()


# ── Customers ─────────────────────────────────────────────────────────────────

async def get_customers(search: str | None, token: str) -> list[dict]:
    """List customers for the caller's company. Optional full-text search across
    full_name, id_number, and phone (case-insensitive OR match)."""
    params: dict = {"select": "*", "order": "created_at.desc"}
    if search:
        term = search.strip()
        params["or"] = (
            f"(full_name.ilike.*{term}*,"
            f"id_number.ilike.*{term}*,"
            f"phone.ilike.*{term}*)"
        )
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{_REST}/customers", params=params, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()


async def create_customer(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/customers", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_customer(customer_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/customers",
            params={"id": f"eq.{customer_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def delete_customer(customer_id: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/customers",
            params={"id": f"eq.{customer_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


# ── Reservations ──────────────────────────────────────────────────────────────

async def get_reservations(token: str) -> list[dict]:
    """Reservations with status active or converted, ordered by expires_at asc.
    In this domain, 'expired' means expires_at < today but status is still 'active' —
    expiry is computed client-side. Cancelled reservations are excluded."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/reservations",
            params={
                "select": "*,units(unit_number,building_id,price),customers(full_name,id_number)",
                "status": "in.(active,converted)",
                "order": "expires_at.asc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def get_reservation(reservation_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}", "select": "*"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def create_reservation(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/reservations", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def delete_reservation(reservation_id: str, token: str) -> None:
    """Used for rollback only — if unit status update fails after reservation insert."""
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def update_reservation(reservation_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def cancel_reservation(reservation_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def get_unit(unit_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}", "select": "*"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def update_unit_status(unit_id: str, status: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}"},
            json={"status": status},
            headers=_user_headers(token),
        )
        r.raise_for_status()


# ── Sales ─────────────────────────────────────────────────────────────────────

async def get_sales(token: str) -> list[dict]:
    """All completed sales ordered by created_at desc."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/sales",
            params={
                "select": "*,units(unit_number,building_id),customers(full_name,id_number)",
                "order": "created_at.desc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def create_sale(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/sales", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_reservation_status(reservation_id: str, status: str, token: str) -> None:
    """Update reservation status field only — used when converting to sale."""
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json={"status": status},
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def record_deposit_return(reservation_id: str, data: dict, token: str) -> None:
    """Record deposit return details on a converted reservation."""
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()
