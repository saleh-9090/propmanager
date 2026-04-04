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
