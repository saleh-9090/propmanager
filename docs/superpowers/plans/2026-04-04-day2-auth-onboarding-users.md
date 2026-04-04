# Day 2: Auth + Company Onboarding + User Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auth login page, company onboarding flow for the first owner, and a user management screen where the owner can invite staff.

**Architecture:** Supabase handles auth (email/password + invite emails). A thin FastAPI service-role wrapper (`supabase_client.py`) handles the two operations that require bypassing RLS: creating the first company+owner record during onboarding, and creating `user_profiles` rows for invited users. All other reads go through user JWT so RLS enforces company isolation. The frontend middleware checks for a `user_profiles` row after login and routes to `/onboarding` if missing.

**Tech Stack:** FastAPI + httpx (backend), Next.js 14 App Router + `@supabase/ssr` (frontend), Supabase Auth Admin API (invites), pytest + unittest.mock (backend tests)

---

## File Map

**Backend — new files:**
- `backend/app/supabase_client.py` — httpx wrapper for service-role REST + Auth Admin calls
- `backend/app/routers/__init__.py` — empty
- `backend/app/routers/onboarding.py` — `POST /onboarding`
- `backend/app/routers/users.py` — `GET /users`, `POST /users/invite`, `PATCH /users/{id}/role`, `DELETE /users/{id}`
- `backend/tests/__init__.py` — empty
- `backend/tests/conftest.py` — TestClient fixture + JWT override
- `backend/tests/test_onboarding.py`
- `backend/tests/test_users.py`

**Backend — modified files:**
- `backend/main.py` — include routers
- `backend/requirements.txt` — add pytest, pytest-asyncio

**Frontend — new files:**
- `frontend/src/lib/api.ts` — `apiGet/apiPost/apiPatch/apiDelete` with Bearer token
- `frontend/src/app/auth/page.tsx` — login + signup form (Arabic RTL)
- `frontend/src/app/onboarding/page.tsx` — company setup form
- `frontend/src/app/dashboard/layout.tsx` — sidebar layout (server component)
- `frontend/src/app/dashboard/_components/SignOutButton.tsx` — client sign-out button
- `frontend/src/app/dashboard/page.tsx` — minimal dashboard shell
- `frontend/src/app/settings/users/page.tsx` — user management (client component)

**Frontend — modified files:**
- `frontend/src/middleware.ts` — add `user_profiles` check + `/onboarding` guard

---

## Task 1: Backend — supabase_client.py

**Files:**
- Create: `backend/app/supabase_client.py`

- [ ] **Step 1: Create supabase_client.py**

```python
# backend/app/supabase_client.py
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
            f"{_AUTH}/invite",
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


async def delete_auth_user(user_id: str) -> None:
    """Deletes from auth.users — cascades to user_profiles via FK."""
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_AUTH_ADMIN}/users/{user_id}",
            headers=_SVC,
        )
        r.raise_for_status()
```

- [ ] **Step 2: Create routers package**

```bash
touch backend/app/routers/__init__.py
```

---

## Task 2: Backend — pytest setup

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Add test deps to requirements.txt**

```
fastapi
uvicorn[standard]
python-dotenv
pydantic>=2.0
pydantic-settings
python-jose[cryptography]
httpx
pytest
pytest-asyncio
```

- [ ] **Step 2: Install**

```bash
cd backend && pip install -r requirements.txt
```

Expected: installs pytest and pytest-asyncio.

- [ ] **Step 3: Create pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 4: Create tests/__init__.py**

```bash
touch backend/tests/__init__.py
```

- [ ] **Step 5: Create tests/conftest.py**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from main import app
from app.auth import get_current_user

MOCK_USER = {"user_id": "user-abc", "token": "test-token"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    yield TestClient(app)
    app.dependency_overrides.clear()
```

- [ ] **Step 6: Smoke-test the setup**

```bash
cd backend && pytest --collect-only
```

Expected: `no tests ran` with no import errors.

---

## Task 3: Onboarding endpoint (TDD)

**Files:**
- Create: `backend/tests/test_onboarding.py`
- Create: `backend/app/routers/onboarding.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run — confirm all 3 fail**

```bash
cd backend && pytest tests/test_onboarding.py -v
```

Expected: 3 × FAILED (404 or ImportError — router not wired yet).

- [ ] **Step 3: Create the onboarding router**

```python
# backend/app/routers/onboarding.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(tags=["onboarding"])


class OnboardingRequest(BaseModel):
    company_name: str
    company_name_ar: str | None = None
    full_name: str
    phone: str | None = None
    rega_license: str | None = None


@router.post("/onboarding")
async def onboard(body: OnboardingRequest, user=Depends(get_current_user)):
    existing = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already onboarded")

    company = await supabase_client.insert_company({
        "name": body.company_name,
        "name_ar": body.company_name_ar,
        "rega_license": body.rega_license,
    })

    await supabase_client.insert_user_profile({
        "id": user["user_id"],
        "company_id": company["id"],
        "full_name": body.full_name,
        "phone": body.phone,
        "role": "owner",
    })

    return {"company_id": company["id"]}
```

- [ ] **Step 4: Wire router into main.py**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import onboarding

app = FastAPI(
    title="PropManager API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
```

- [ ] **Step 5: Run — confirm all 3 pass**

```bash
cd backend && pytest tests/test_onboarding.py -v
```

Expected: 3 × PASSED.

- [ ] **Step 6: Commit**

```bash
cd backend && git add app/supabase_client.py app/routers/__init__.py app/routers/onboarding.py main.py requirements.txt tests/ pytest.ini && git commit -m "feat: onboarding endpoint + pytest setup"
```

---

## Task 4: Users endpoints (TDD)

**Files:**
- Create: `backend/tests/test_users.py`
- Create: `backend/app/routers/users.py`

- [ ] **Step 1: Write failing tests**

```python
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

        response = client.delete("/users/user-abc")  # same as MOCK_USER user_id

        assert response.status_code == 400
```

- [ ] **Step 2: Run — confirm all 7 fail**

```bash
cd backend && pytest tests/test_users.py -v
```

Expected: 7 × FAILED.

- [ ] **Step 3: Create the users router**

```python
# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"owner", "cfo", "sales_manager", "reservation_manager", "accountant"}


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    phone: str | None = None


class RoleUpdate(BaseModel):
    role: str


@router.get("")
async def list_users(user=Depends(get_current_user)):
    return await supabase_client.get_company_profiles(user["token"])


@router.post("/invite", status_code=201)
async def invite_user(body: InviteRequest, user=Depends(get_current_user)):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can invite users")

    invited = await supabase_client.invite_auth_user(body.email)

    await supabase_client.insert_user_profile({
        "id": invited["id"],
        "company_id": caller["company_id"],
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
    })

    return {"user_id": invited["id"], "email": body.email}


@router.patch("/{user_id}/role")
async def update_role(user_id: str, body: RoleUpdate, user=Depends(get_current_user)):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can change roles")

    target = await supabase_client.get_user_profile_in_company(user_id, caller["company_id"])
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await supabase_client.update_user_role(user_id, body.role)
    return {"user_id": user_id, "role": body.role}


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can remove users")

    target = await supabase_client.get_user_profile_in_company(user_id, caller["company_id"])
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await supabase_client.delete_auth_user(user_id)
```

- [ ] **Step 4: Wire users router into main.py**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import onboarding, users

app = FastAPI(
    title="PropManager API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
```

- [ ] **Step 5: Run — confirm all 7 pass**

```bash
cd backend && pytest tests/test_users.py -v
```

Expected: 7 × PASSED.

- [ ] **Step 6: Run full test suite**

```bash
cd backend && pytest -v
```

Expected: 10 × PASSED.

- [ ] **Step 7: Commit**

```bash
cd backend && git add app/routers/users.py main.py tests/test_users.py && git commit -m "feat: users endpoints (invite, list, role, delete)"
```

---

## Task 5: Frontend — api.ts helper

**Files:**
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Create api.ts**

```typescript
// frontend/src/lib/api.ts
import { supabase } from './supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `src/lib/api.ts`.

---

## Task 6: Frontend — auth page

**Files:**
- Create: `frontend/src/app/auth/page.tsx`

- [ ] **Step 1: Create the auth page**

```tsx
// frontend/src/app/auth/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">
          {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
        </h1>
        <p className="text-stone-500 text-sm mb-8">
          PropManager — نظام إدارة المبيعات العقارية
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.sa"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'جارٍ التحميل...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          className="mt-4 text-sm text-primary-600 hover:underline w-full text-center"
        >
          {mode === 'login' ? 'إنشاء حساب جديد' : 'تسجيل الدخول بحساب موجود'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep auth
```

Expected: no errors.

---

## Task 7: Frontend — middleware update

**Files:**
- Modify: `frontend/src/middleware.ts`

The middleware needs to: (a) protect `/onboarding` (must be logged in), (b) after confirming a user is logged in for any protected route or `/onboarding`, check `user_profiles` and redirect to `/onboarding` if missing.

- [ ] **Step 1: Replace middleware.ts**

```typescript
// frontend/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED  = ['/dashboard', '/projects', '/units', '/customers', '/reservations', '/sales', '/reports', '/settings', '/onboarding']
const GUEST_ONLY = ['/auth']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Not logged in — redirect to /auth for all protected routes
  if (!user && PROTECTED.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Logged in — redirect away from guest-only pages
  if (user && GUEST_ONLY.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Logged in on a protected route — check if they have a profile
  if (user && PROTECTED.some(p => path === p || path.startsWith(p + '/'))) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    const onOnboarding = path === '/onboarding' || path.startsWith('/onboarding/')

    if (!profile && !onOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    if (profile && onOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep middleware
```

Expected: no errors.

---

## Task 8: Frontend — onboarding page

**Files:**
- Create: `frontend/src/app/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding page**

```tsx
// frontend/src/app/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost } from '@/lib/api'

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    company_name_ar: '',
    full_name: '',
    phone: '',
    rega_license: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiPost('/onboarding', {
        company_name: form.company_name,
        company_name_ar: form.company_name_ar || null,
        full_name: form.full_name,
        phone: form.phone || null,
        rega_license: form.rega_license || null,
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-lg">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">إعداد الشركة</h1>
        <p className="text-stone-500 text-sm mb-8">أدخل بيانات شركتك للبدء</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">اسم الشركة (بالعربي) *</label>
            <input
              className="input"
              value={form.company_name_ar}
              onChange={e => set('company_name_ar', e.target.value)}
              placeholder="شركة النرجس للتطوير العقاري"
              required
            />
          </div>
          <div>
            <label className="label">اسم الشركة (بالإنجليزي) *</label>
            <input
              className="input"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="Al-Narjis Real Estate"
              required
            />
          </div>
          <div>
            <label className="label">اسمك الكامل *</label>
            <input
              className="input"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div>
            <label className="label">رقم ترخيص فال (اختياري)</label>
            <input
              className="input"
              value={form.rega_license}
              onChange={e => set('rega_license', e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'جارٍ الإعداد...' : 'ابدأ'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

## Task 9: Frontend — dashboard layout + shell

**Files:**
- Create: `frontend/src/app/dashboard/_components/SignOutButton.tsx`
- Create: `frontend/src/app/dashboard/layout.tsx`
- Create: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create SignOutButton (client component)**

```tsx
// frontend/src/app/dashboard/_components/SignOutButton.tsx
'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <button onClick={handleSignOut} className="btn-ghost w-full text-sm">
      تسجيل الخروج
    </button>
  )
}
```

- [ ] **Step 2: Create dashboard layout (server component)**

```tsx
// frontend/src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Link from 'next/link'
import SignOutButton from './_components/SignOutButton'

const NAV = [
  { href: '/dashboard',       label: 'الرئيسية' },
  { href: '/projects',        label: 'المشاريع' },
  { href: '/units',           label: 'الوحدات' },
  { href: '/customers',       label: 'العملاء' },
  { href: '/reservations',    label: 'الحجوزات' },
  { href: '/sales',           label: 'المبيعات' },
  { href: '/reports',         label: 'التقارير' },
  { href: '/settings/users',  label: 'الإعدادات' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, companies(name_ar)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const companyName = (profile.companies as { name_ar: string } | null)?.name_ar ?? ''

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-l border-stone-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-stone-200">
          <p className="font-bold text-stone-900 text-sm truncate">{companyName}</p>
          <p className="text-stone-500 text-xs mt-1 truncate">{profile.full_name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 rounded-xl text-sm text-stone-700 hover:bg-stone-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-200">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard page**

```tsx
// frontend/src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">لوحة التحكم</h1>
      <p className="text-stone-500 text-sm">مرحباً بك في PropManager</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "dashboard|layout|SignOut"
```

Expected: no errors.

- [ ] **Step 5: Commit frontend foundation**

```bash
cd frontend && git add src/lib/api.ts src/app/auth/ src/app/onboarding/ src/app/dashboard/ src/middleware.ts && git commit -m "feat: auth page, onboarding, dashboard layout"
```

---

## Task 10: Frontend — user management page

**Files:**
- Create: `frontend/src/app/settings/users/page.tsx`

- [ ] **Step 1: Create user management page**

```tsx
// frontend/src/app/settings/users/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

type UserProfile = {
  id: string
  full_name: string
  role: string
  phone: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner:                'مالك',
  cfo:                  'مدير مالي',
  sales_manager:        'مدير مبيعات',
  reservation_manager:  'مدير حجوزات',
  accountant:           'محاسب',
}

const ROLES = Object.keys(ROLE_LABELS)

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [inviteForm, setInviteForm] = useState({
    email: '', full_name: '', role: 'sales_manager', phone: '',
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  async function loadUsers() {
    try {
      const data = await apiGet<UserProfile[]>('/users')
      setUsers(data)
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'تعذر تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviting(true)
    try {
      await apiPost('/users/invite', {
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        phone: inviteForm.phone || null,
      })
      setInviteSuccess(`تم إرسال الدعوة إلى ${inviteForm.email}`)
      setInviteForm({ email: '', full_name: '', role: 'sales_manager', phone: '' })
      await loadUsers()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'تعذر إرسال الدعوة')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await apiPatch(`/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر تغيير الدور')
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return
    try {
      await apiDelete(`/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المستخدم')
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-8">إدارة المستخدمين</h1>

      {/* Invite form */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4">دعوة مستخدم جديد</h2>
        {inviteError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{inviteError}</div>
        )}
        {inviteSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{inviteSuccess}</div>
        )}
        <form onSubmit={handleInvite} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">البريد الإلكتروني *</label>
            <input
              className="input"
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">الاسم الكامل *</label>
            <input
              className="input"
              value={inviteForm.full_name}
              onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">الدور</label>
            <select
              className="input"
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.filter(r => r !== 'owner').map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input
              className="input"
              type="tel"
              value={inviteForm.phone}
              onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary" disabled={inviting}>
              {inviting ? 'جارٍ الإرسال...' : 'إرسال الدعوة'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">المستخدمون</h2>
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : listError ? (
          <p className="text-red-600 text-sm">{listError}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-right pb-3 font-medium text-stone-600">الاسم</th>
                <th className="text-right pb-3 font-medium text-stone-600">الدور</th>
                <th className="text-right pb-3 font-medium text-stone-600">الجوال</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-3">{u.full_name}</td>
                  <td className="py-3">
                    <select
                      className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white"
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-stone-500">{u.phone ?? '—'}</td>
                  <td className="py-3 text-left">
                    <button
                      onClick={() => handleDelete(u.id, u.full_name)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "users|settings"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/app/settings/ && git commit -m "feat: user management page"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start both servers**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && export NEXT_TELEMETRY_DISABLED=1
cd /mnt/d/claude/propmanager/backend && python -m uvicorn main:app --host 0.0.0.0 --port 8001 &
cd /mnt/d/claude/propmanager/frontend && npm run dev
```

- [ ] **Step 2: Verify health endpoint**

Open `http://localhost:8001/health` — should return `{"status":"ok","env":"development"}`.

- [ ] **Step 3: Test the full onboarding flow**

1. Open `http://localhost:3000` → should redirect to `/auth`
2. Click "إنشاء حساب جديد" → sign up with a new email + password
3. Should redirect to `/onboarding` (no profile yet)
4. Fill in company details → submit
5. Should land on `/dashboard` with company name + your name in sidebar

- [ ] **Step 4: Test user invite (as owner, in `/settings/users`)**

1. Click إعدادات in the sidebar
2. Fill invite form with a second email + role = sales_manager
3. Click "إرسال الدعوة" — confirm success message appears
4. Check the invited email inbox for a Supabase invite link
5. Click the invite link → set password → should land directly on `/dashboard`

- [ ] **Step 5: Test sign-out**

Click "تسجيل الخروج" → should redirect to `/auth`. Navigating to `/dashboard` should redirect back to `/auth`.
