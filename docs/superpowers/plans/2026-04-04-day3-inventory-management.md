# Day 3: Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a split-view inventory management page at `/projects` where staff manage projects, buildings, and units, with CSV bulk import scoped to a project.

**Architecture:** Three new FastAPI routers (projects, buildings, units) follow the existing `users.py` pattern — user JWT to Supabase, RLS enforces `company_id`. CSV import uses service role only for the global SAK uniqueness check and bulk insert. Frontend is a single `/projects` page: tree sidebar (right, RTL) + units table (left), URL-driven (`?building=<id>&project=<id>`), all client components fetch their own data.

**Tech Stack:** FastAPI + httpx + python-csv + python-multipart (backend), Next.js 14 App Router + useSearchParams + useCallback (frontend), Supabase PostgREST embedded queries

---

## File Map

**Backend — new files:**
- `backend/app/routers/projects.py` — CRUD for projects
- `backend/app/routers/buildings.py` — CRUD for buildings
- `backend/app/routers/units.py` — CRUD for units + `POST /units/import`
- `backend/tests/test_projects.py`
- `backend/tests/test_buildings.py`
- `backend/tests/test_units.py`

**Backend — modified files:**
- `backend/app/supabase_client.py` — 14 new functions for project/building/unit/import operations
- `backend/main.py` — include 3 new routers
- `backend/requirements.txt` — add `python-multipart`

**Frontend — new files:**
- `frontend/src/app/projects/page.tsx` — server layout shell
- `frontend/src/app/projects/_components/ProjectTree.tsx` — accordion tree
- `frontend/src/app/projects/_components/ProjectFormModal.tsx` — add/edit project
- `frontend/src/app/projects/_components/BuildingFormModal.tsx` — add/edit building
- `frontend/src/app/projects/_components/UnitsPanel.tsx` — units table
- `frontend/src/app/projects/_components/UnitFormModal.tsx` — add/edit unit
- `frontend/src/app/projects/_components/CsvImportModal.tsx` — file upload + preview + import

---

## Task 1: supabase_client.py additions + python-multipart

**Files:**
- Modify: `backend/app/supabase_client.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add `python-multipart` to requirements.txt**

The full file should be:

```
fastapi
uvicorn[standard]
python-dotenv
python-multipart
pydantic>=2.0
pydantic[email]
pydantic-settings
python-jose[cryptography]
httpx
pytest
pytest-asyncio>=0.21
```

- [ ] **Step 2: Install**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pip install python-multipart --break-system-packages -q
```

Expected: installs without error.

- [ ] **Step 3: Append 14 new functions to supabase_client.py**

Add everything below to the END of `backend/app/supabase_client.py`:

```python

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

async def get_units(building_id: str, token: str) -> list[dict]:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/units",
            params={
                "building_id": f"eq.{building_id}",
                "select": "*",
                "order": "floor.asc,unit_number.asc",
            },
            headers=_user_headers(token),
        )
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
```

- [ ] **Step 4: Verify import is clean**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -c "from app import supabase_client; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/supabase_client.py backend/requirements.txt && git commit -m "feat: supabase_client project/building/unit functions"
```

---

## Task 2: Projects router (TDD)

**Files:**
- Create: `backend/tests/test_projects.py`
- Create: `backend/app/routers/projects.py`

- [ ] **Step 1: Write failing tests**

```python
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
```

- [ ] **Step 2: Run — confirm all 7 fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_projects.py -v 2>&1 | tail -10
```

Expected: 7 × FAILED (404 — router not wired yet).

- [ ] **Step 3: Create the projects router**

```python
# backend/app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/projects", tags=["projects"])

WRITERS = {"owner", "sales_manager"}


class ProjectCreate(BaseModel):
    name: str
    name_ar: str | None = None
    project_number: str
    city: str | None = None
    location_notes: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    name_ar: str | None = None
    project_number: str | None = None
    city: str | None = None
    location_notes: str | None = None


@router.get("")
async def list_projects(user=Depends(get_current_user)):
    return await supabase_client.get_projects_with_buildings(user["token"])


@router.post("", status_code=201)
async def create_project(body: ProjectCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can create projects")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_project(data, user["token"])


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can update projects")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "No fields to update")
    await supabase_client.update_project(project_id, data, user["token"])
    return {"ok": True}


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(403, "Only owners can delete projects")
    await supabase_client.delete_project(project_id, user["token"])
```

- [ ] **Step 4: Wire router into main.py temporarily to unblock tests**

Add to `backend/main.py`:
```python
from app.routers import onboarding, users, projects

# add after existing include_router calls:
app.include_router(projects.router)
```

- [ ] **Step 5: Run — confirm all 7 pass**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_projects.py -v 2>&1 | tail -10
```

Expected: 7 × PASSED.

- [ ] **Step 6: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/projects.py backend/tests/test_projects.py backend/main.py && git commit -m "feat: projects router (TDD)"
```

---

## Task 3: Buildings router (TDD)

**Files:**
- Create: `backend/tests/test_buildings.py`
- Create: `backend/app/routers/buildings.py`

- [ ] **Step 1: Write failing tests**

```python
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
```

- [ ] **Step 2: Run — confirm all 6 fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_buildings.py -v 2>&1 | tail -10
```

Expected: 6 × FAILED.

- [ ] **Step 3: Create the buildings router**

```python
# backend/app/routers/buildings.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/buildings", tags=["buildings"])

WRITERS = {"owner", "sales_manager"}


class BuildingCreate(BaseModel):
    project_id: str
    building_number: str
    name: str | None = None
    total_floors: int | None = None


class BuildingUpdate(BaseModel):
    building_number: str | None = None
    name: str | None = None
    total_floors: int | None = None


@router.post("", status_code=201)
async def create_building(body: BuildingCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can create buildings")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_building(data, user["token"])


@router.patch("/{building_id}")
async def update_building(building_id: str, body: BuildingUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can update buildings")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "No fields to update")
    await supabase_client.update_building(building_id, data, user["token"])
    return {"ok": True}


@router.delete("/{building_id}", status_code=204)
async def delete_building(building_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(403, "Only owners can delete buildings")
    await supabase_client.delete_building(building_id, user["token"])
```

- [ ] **Step 4: Add buildings router to main.py**

```python
from app.routers import onboarding, users, projects, buildings

app.include_router(buildings.router)
```

- [ ] **Step 5: Run — confirm all 6 pass**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_buildings.py -v 2>&1 | tail -10
```

Expected: 6 × PASSED.

- [ ] **Step 6: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/buildings.py backend/tests/test_buildings.py backend/main.py && git commit -m "feat: buildings router (TDD)"
```

---

## Task 4: Units router + CSV import (TDD)

**Files:**
- Create: `backend/tests/test_units.py`
- Create: `backend/app/routers/units.py`

**Important:** In the router, define `POST /import` BEFORE `PATCH /{unit_id}` and `DELETE /{unit_id}` so FastAPI doesn't try to match the literal "import" as a `unit_id`.

- [ ] **Step 1: Write failing tests**

```python
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


def test_list_units(client):
    with patch("app.routers.units.supabase_client.get_units", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_UNIT]
        response = client.get("/units", params={"building_id": "bldg-222"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("bldg-222", "test-token")


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
```

- [ ] **Step 2: Run — confirm all 11 fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_units.py -v 2>&1 | tail -15
```

Expected: 11 × FAILED.

- [ ] **Step 3: Create the units router**

```python
# backend/app/routers/units.py
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/units", tags=["units"])

WRITERS = {"owner", "sales_manager"}
REQUIRED_CSV_COLS = {"building_number", "unit_number", "floor", "area_sqm", "price", "sak_id"}


class UnitCreate(BaseModel):
    building_id: str
    project_id: str
    unit_number: str
    floor: int
    area_sqm: float
    price: float
    sak_id: str
    electricity_meter_id: str | None = None
    water_meter_id: str | None = None


class UnitUpdate(BaseModel):
    unit_number: str | None = None
    floor: int | None = None
    area_sqm: float | None = None
    price: float | None = None
    sak_id: str | None = None
    electricity_meter_id: str | None = None
    water_meter_id: str | None = None


@router.get("")
async def list_units(building_id: str, user=Depends(get_current_user)):
    return await supabase_client.get_units(building_id, user["token"])


@router.post("", status_code=201)
async def create_unit(body: UnitCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can create units")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_unit(data, user["token"])


# NOTE: /import must be defined BEFORE /{unit_id} to avoid path param collision
@router.post("/import")
async def import_units(
    project_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can import units")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(422, "File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = set(reader.fieldnames or [])
    missing_cols = REQUIRED_CSV_COLS - fieldnames
    if missing_cols:
        raise HTTPException(422, f"Missing columns: {', '.join(sorted(missing_cols))}")

    rows = list(reader)
    if not rows:
        raise HTTPException(422, "CSV file contains no data rows")

    buildings = await supabase_client.get_buildings_in_project(project_id, user["token"])
    building_map = {b["building_number"]: b["id"] for b in buildings}

    errors: list[dict] = []
    sak_ids_seen: set[str] = set()
    unit_rows: list[dict] = []

    for i, row in enumerate(rows, start=2):
        row_errors: list[dict] = []

        bn = (row.get("building_number") or "").strip()
        if bn not in building_map:
            row_errors.append({"row": i, "field": "building_number",
                                "message": f"Building '{bn}' not found in project"})
            building_id = None
        else:
            building_id = building_map[bn]

        try:
            floor = int((row.get("floor") or "").strip())
            if floor < 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "floor",
                                "message": "Must be a non-negative integer"})
            floor = None

        try:
            area = float((row.get("area_sqm") or "").strip())
            if area <= 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "area_sqm",
                                "message": "Must be a positive number"})
            area = None

        try:
            price = float((row.get("price") or "").strip())
            if price <= 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "price",
                                "message": "Must be a positive number"})
            price = None

        sak = (row.get("sak_id") or "").strip()
        if not sak:
            row_errors.append({"row": i, "field": "sak_id", "message": "Required"})
        elif sak in sak_ids_seen:
            row_errors.append({"row": i, "field": "sak_id",
                                "message": f"Duplicate SAK ID '{sak}' in file"})
        else:
            sak_ids_seen.add(sak)

        unit_number = (row.get("unit_number") or "").strip()
        if not unit_number:
            row_errors.append({"row": i, "field": "unit_number", "message": "Required"})

        errors.extend(row_errors)

        if not row_errors:
            unit_rows.append({
                "building_id": building_id,
                "project_id": project_id,
                "company_id": caller["company_id"],
                "sak_id": sak,
                "unit_number": unit_number,
                "floor": floor,
                "area_sqm": area,
                "price": price,
                "electricity_meter_id": (row.get("electricity_meter_id") or "").strip() or None,
                "water_meter_id": (row.get("water_meter_id") or "").strip() or None,
            })

    # Check SAK IDs against DB only if no prior errors (avoids noise)
    if not errors and sak_ids_seen:
        existing = await supabase_client.get_existing_sak_ids(list(sak_ids_seen))
        if existing:
            existing_set = set(existing)
            for i, row in enumerate(rows, start=2):
                sak = (row.get("sak_id") or "").strip()
                if sak in existing_set:
                    errors.append({"row": i, "field": "sak_id",
                                   "message": f"SAK ID '{sak}' already exists in system"})

    if errors:
        raise HTTPException(status_code=422, detail={"message": "Import failed", "errors": errors})

    await supabase_client.bulk_insert_units(unit_rows)
    return {"imported": len(unit_rows)}


@router.patch("/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can update units")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "No fields to update")
    await supabase_client.update_unit(unit_id, data, user["token"])
    return {"ok": True}


@router.delete("/{unit_id}", status_code=204)
async def delete_unit(unit_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(403, "Only owners can delete units")
    await supabase_client.delete_unit(unit_id, user["token"])
```

- [ ] **Step 4: Add units router to main.py**

Full `backend/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import onboarding, users, projects, buildings, units

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
app.include_router(projects.router)
app.include_router(buildings.router)
app.include_router(units.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
```

- [ ] **Step 5: Run — confirm all 11 pass**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_units.py -v 2>&1 | tail -15
```

Expected: 11 × PASSED.

- [ ] **Step 6: Run full suite**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -v 2>&1 | tail -5
```

Expected: 33 passed (13 existing + 7 projects + 6 buildings + 11 units = 37... wait let me recount: 13 + 7 + 6 + 11 = 37 total).

- [ ] **Step 7: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/units.py backend/tests/test_units.py backend/main.py && git commit -m "feat: units router + CSV import (TDD)"
```

---

## Task 5: Frontend — page.tsx + ProjectTree

**Files:**
- Create: `frontend/src/app/projects/page.tsx`
- Create: `frontend/src/app/projects/_components/ProjectTree.tsx`

- [ ] **Step 1: Create page.tsx**

```tsx
// frontend/src/app/projects/page.tsx
import { Suspense } from 'react'
import ProjectTree from './_components/ProjectTree'
import UnitsPanel from './_components/UnitsPanel'

export default function ProjectsPage() {
  return (
    <div className="flex h-full -m-8 overflow-hidden">
      <aside className="w-72 bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto">
        <Suspense>
          <ProjectTree />
        </Suspense>
      </aside>
      <main className="flex-1 overflow-auto">
        <Suspense>
          <UnitsPanel />
        </Suspense>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create ProjectTree.tsx**

```tsx
// frontend/src/app/projects/_components/ProjectTree.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiDelete, apiGet } from '@/lib/api'
import ProjectFormModal from './ProjectFormModal'
import BuildingFormModal from './BuildingFormModal'

type Building = {
  id: string
  building_number: string
  name: string | null
  total_floors: number | null
}

type Project = {
  id: string
  name: string
  name_ar: string | null
  project_number: string
  city: string | null
  buildings: Building[]
}

export default function ProjectTree() {
  const router = useRouter()
  const params = useSearchParams()
  const selectedBuilding = params.get('building')

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [buildingModal, setBuildingModal] = useState<{ open: boolean; projectId?: string; building?: Building }>({ open: false })

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiGet<Project[]>('/projects')
      setProjects(data)
      setExpanded(new Set(data.map(p => p.id)))
    } catch {
      // silently fail — tree just stays empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  function selectBuilding(buildingId: string, projectId: string) {
    router.replace(`/projects?building=${buildingId}&project=${projectId}`)
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع المباني والوحدات.')) return
    try {
      await apiDelete(`/projects/${projectId}`)
      router.replace('/projects')
      await loadProjects()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المشروع')
    }
  }

  async function handleDeleteBuilding(buildingId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المبنى؟ سيتم حذف جميع الوحدات.')) return
    try {
      await apiDelete(`/buildings/${buildingId}`)
      if (selectedBuilding === buildingId) router.replace('/projects')
      await loadProjects()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المبنى')
    }
  }

  if (loading) return <div className="p-4 text-sm text-stone-500">جارٍ التحميل...</div>

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-stone-900">المشاريع</h2>
        <button
          onClick={() => setProjectModal({ open: true })}
          className="text-xs text-primary-600 hover:underline"
        >
          + مشروع
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {projects.length === 0 && (
          <p className="text-sm text-stone-400 p-2 text-center mt-8">
            لا توجد مشاريع
          </p>
        )}
        {projects.map(project => (
          <div key={project.id}>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-50 group">
              <button
                onClick={() => setExpanded(e => {
                  const next = new Set(e)
                  next.has(project.id) ? next.delete(project.id) : next.add(project.id)
                  return next
                })}
                className="text-stone-400 w-4 text-xs shrink-0"
              >
                {expanded.has(project.id) ? '▼' : '▶'}
              </button>
              <span className="flex-1 text-sm font-medium text-stone-800 truncate">
                {project.name_ar || project.name}
              </span>
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  onClick={() => setBuildingModal({ open: true, projectId: project.id })}
                  className="text-xs text-primary-600 px-1"
                  title="إضافة مبنى"
                >+ مبنى</button>
                <button
                  onClick={() => setProjectModal({ open: true, project })}
                  className="text-xs text-stone-400 hover:text-stone-700 px-1"
                >✎</button>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-1"
                >×</button>
              </div>
            </div>

            {expanded.has(project.id) && (
              <div className="mr-5 space-y-0.5">
                {project.buildings.length === 0 && (
                  <p className="text-xs text-stone-400 px-4 py-1">لا توجد مبانٍ</p>
                )}
                {project.buildings.map(b => (
                  <div
                    key={b.id}
                    onClick={() => selectBuilding(b.id, project.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group ${
                      selectedBuilding === b.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span className="w-4 text-center text-stone-300 text-xs shrink-0">■</span>
                    <span className="flex-1 text-sm truncate">
                      {b.name || `مبنى ${b.building_number}`}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setBuildingModal({ open: true, projectId: project.id, building: b }) }}
                        className="text-xs text-stone-400 hover:text-stone-700 px-1"
                      >✎</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteBuilding(b.id) }}
                        className="text-xs text-red-400 hover:text-red-600 px-1"
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {projectModal.open && (
        <ProjectFormModal
          project={projectModal.project}
          onClose={() => setProjectModal({ open: false })}
          onSaved={loadProjects}
        />
      )}
      {buildingModal.open && buildingModal.projectId && (
        <BuildingFormModal
          projectId={buildingModal.projectId}
          building={buildingModal.building}
          onClose={() => setBuildingModal({ open: false })}
          onSaved={loadProjects}
        />
      )}
    </div>
  )
}
```

Note: `ProjectFormModal` and `BuildingFormModal` are imported but created in the next task. TypeScript will error until Task 6 creates them. Create stub files to unblock:

- [ ] **Step 3: Create placeholder stubs for modals (unblock TS)**

Create `frontend/src/app/projects/_components/ProjectFormModal.tsx`:
```tsx
export default function ProjectFormModal(_: any) { return null }
```

Create `frontend/src/app/projects/_components/BuildingFormModal.tsx`:
```tsx
export default function BuildingFormModal(_: any) { return null }
```

Create `frontend/src/app/projects/_components/UnitsPanel.tsx`:
```tsx
export default function UnitsPanel() { return <div className="p-6 text-stone-400 text-sm">اختر مبنى لعرض وحداته</div> }
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -i "projects" | head -10
```

Expected: no errors referencing the new files.

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/projects/ && git commit -m "feat: projects page shell + ProjectTree"
```

---

## Task 6: Frontend — ProjectFormModal + BuildingFormModal

**Files:**
- Modify: `frontend/src/app/projects/_components/ProjectFormModal.tsx` (replace stub)
- Modify: `frontend/src/app/projects/_components/BuildingFormModal.tsx` (replace stub)

- [ ] **Step 1: Replace ProjectFormModal stub**

```tsx
// frontend/src/app/projects/_components/ProjectFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Project = {
  id: string
  name: string
  name_ar: string | null
  project_number: string
  city: string | null
  location_notes: string | null
}

type Props = {
  project?: Project
  onClose: () => void
  onSaved: () => void
}

export default function ProjectFormModal({ project, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name_ar: project?.name_ar ?? '',
    name: project?.name ?? '',
    project_number: project?.project_number ?? '',
    city: project?.city ?? '',
    location_notes: project?.location_notes ?? '',
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
      const payload = {
        name_ar: form.name_ar || null,
        name: form.name,
        project_number: form.project_number,
        city: form.city || null,
        location_notes: form.location_notes || null,
      }
      if (project) {
        await apiPatch(`/projects/${project.id}`, payload)
      } else {
        await apiPost('/projects', payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{project ? 'تعديل المشروع' : 'مشروع جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">اسم المشروع (بالعربي) *</label>
            <input className="input" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} required placeholder="مشروع النرجس" />
          </div>
          <div>
            <label className="label">اسم المشروع (بالإنجليزي) *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Al Narjis" />
          </div>
          <div>
            <label className="label">رقم المشروع *</label>
            <input className="input" value={form.project_number} onChange={e => set('project_number', e.target.value)} required placeholder="P001" />
          </div>
          <div>
            <label className="label">المدينة</label>
            <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="الرياض" />
          </div>
          <div>
            <label className="label">ملاحظات الموقع</label>
            <input className="input" value={form.location_notes} onChange={e => set('location_notes', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace BuildingFormModal stub**

```tsx
// frontend/src/app/projects/_components/BuildingFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Building = {
  id: string
  building_number: string
  name: string | null
  total_floors: number | null
}

type Props = {
  projectId: string
  building?: Building
  onClose: () => void
  onSaved: () => void
}

export default function BuildingFormModal({ projectId, building, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    building_number: building?.building_number ?? '',
    name: building?.name ?? '',
    total_floors: building?.total_floors?.toString() ?? '',
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
      const payload = {
        building_number: form.building_number,
        name: form.name || null,
        total_floors: form.total_floors ? parseInt(form.total_floors) : null,
        ...(!building && { project_id: projectId }),
      }
      if (building) {
        await apiPatch(`/buildings/${building.id}`, payload)
      } else {
        await apiPost('/buildings', payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">{building ? 'تعديل المبنى' : 'مبنى جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">رقم المبنى *</label>
            <input className="input" value={form.building_number} onChange={e => set('building_number', e.target.value)} required placeholder="A" />
          </div>
          <div>
            <label className="label">اسم المبنى (اختياري)</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="برج الشمال" />
          </div>
          <div>
            <label className="label">عدد الطوابق (اختياري)</label>
            <input className="input" type="number" min="1" value={form.total_floors} onChange={e => set('total_floors', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -i "Modal\|projects" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/projects/_components/ProjectFormModal.tsx frontend/src/app/projects/_components/BuildingFormModal.tsx && git commit -m "feat: project and building form modals"
```

---

## Task 7: Frontend — UnitsPanel + UnitFormModal

**Files:**
- Modify: `frontend/src/app/projects/_components/UnitsPanel.tsx` (replace stub)
- Create: `frontend/src/app/projects/_components/UnitFormModal.tsx`
- Create: `frontend/src/app/projects/_components/CsvImportModal.tsx` (stub only — real impl in Task 8)

- [ ] **Step 1: Create UnitFormModal.tsx**

```tsx
// frontend/src/app/projects/_components/UnitFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  electricity_meter_id: string | null
  water_meter_id: string | null
}

type Props = {
  buildingId: string
  projectId: string
  unit?: Unit
  onClose: () => void
  onSaved: () => void
}

export default function UnitFormModal({ buildingId, projectId, unit, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    unit_number: unit?.unit_number ?? '',
    floor: unit?.floor?.toString() ?? '',
    area_sqm: unit?.area_sqm?.toString() ?? '',
    price: unit?.price?.toString() ?? '',
    sak_id: unit?.sak_id ?? '',
    electricity_meter_id: unit?.electricity_meter_id ?? '',
    water_meter_id: unit?.water_meter_id ?? '',
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
      const payload = {
        unit_number: form.unit_number,
        floor: parseInt(form.floor),
        area_sqm: parseFloat(form.area_sqm),
        price: parseFloat(form.price),
        sak_id: form.sak_id,
        electricity_meter_id: form.electricity_meter_id || null,
        water_meter_id: form.water_meter_id || null,
        ...(!unit && { building_id: buildingId, project_id: projectId }),
      }
      if (unit) {
        await apiPatch(`/units/${unit.id}`, payload)
      } else {
        await apiPost('/units', payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">{unit ? 'تعديل الوحدة' : 'وحدة جديدة'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">رقم الوحدة *</label>
            <input className="input" value={form.unit_number} onChange={e => set('unit_number', e.target.value)} required placeholder="A-101" />
          </div>
          <div>
            <label className="label">الطابق *</label>
            <input className="input" type="number" min="0" value={form.floor} onChange={e => set('floor', e.target.value)} required />
          </div>
          <div>
            <label className="label">المساحة م² *</label>
            <input className="input" type="number" step="0.01" min="0.01" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)} required />
          </div>
          <div>
            <label className="label">السعر ر.س *</label>
            <input className="input" type="number" step="0.01" min="0.01" value={form.price} onChange={e => set('price', e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="label">رقم الصك (SAK) *</label>
            <input className="input" value={form.sak_id} onChange={e => set('sak_id', e.target.value)} required />
          </div>
          <div>
            <label className="label">عداد الكهرباء</label>
            <input className="input" value={form.electricity_meter_id} onChange={e => set('electricity_meter_id', e.target.value)} />
          </div>
          <div>
            <label className="label">عداد الماء</label>
            <input className="input" value={form.water_meter_id} onChange={e => set('water_meter_id', e.target.value)} />
          </div>
          <div className="col-span-2 flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create CsvImportModal stub (will be replaced in Task 8)**

```tsx
// frontend/src/app/projects/_components/CsvImportModal.tsx
type Props = { projectId: string; onClose: () => void; onSaved: () => void }
export default function CsvImportModal(_: Props) { return null }
```

- [ ] **Step 3: Replace UnitsPanel stub with full implementation**

```tsx
// frontend/src/app/projects/_components/UnitsPanel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiDelete, apiGet } from '@/lib/api'
import UnitFormModal from './UnitFormModal'
import CsvImportModal from './CsvImportModal'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  status: 'available' | 'reserved' | 'sold'
  electricity_meter_id: string | null
  water_meter_id: string | null
}

const STATUS_LABELS = { available: 'متاحة', reserved: 'محجوزة', sold: 'مباعة' }
const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700',
  reserved:  'bg-yellow-100 text-yellow-700',
  sold:      'bg-red-100 text-red-700',
}

export default function UnitsPanel() {
  const params = useSearchParams()
  const buildingId = params.get('building')
  const projectId  = params.get('project')

  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unitModal, setUnitModal] = useState<{ open: boolean; unit?: Unit }>({ open: false })
  const [csvModal, setCsvModal] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!buildingId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Unit[]>(`/units?building_id=${buildingId}`)
      setUnits(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الوحدات')
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => { loadUnits() }, [loadUnits])

  async function handleDelete(unitId: string) {
    if (!confirm('هل أنت متأكد من حذف هذه الوحدة؟')) return
    try {
      await apiDelete(`/units/${unitId}`)
      setUnits(prev => prev.filter(u => u.id !== unitId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف الوحدة')
    }
  }

  if (!buildingId) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        اختر مبنى من القائمة لعرض وحداته
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-stone-900">الوحدات</h2>
        <div className="flex gap-2">
          {projectId && (
            <button onClick={() => setCsvModal(true)} className="btn-ghost text-sm">
              ↑ استيراد CSV
            </button>
          )}
          <button
            onClick={() => setUnitModal({ open: true })}
            className="btn-primary text-sm py-2 px-4"
          >
            + وحدة
          </button>
        </div>
      </div>

      {loading && <p className="text-stone-500 text-sm">جارٍ التحميل...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && units.length === 0 && (
        <div className="text-center py-16 text-stone-400 text-sm">
          لا توجد وحدات — أضف وحدة أو استورد ملف CSV
        </div>
      )}

      {!loading && units.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-right">
              <th className="pb-3 font-medium text-stone-600">رقم الوحدة</th>
              <th className="pb-3 font-medium text-stone-600">الطابق</th>
              <th className="pb-3 font-medium text-stone-600">م²</th>
              <th className="pb-3 font-medium text-stone-600">السعر (ر.س)</th>
              <th className="pb-3 font-medium text-stone-600">رقم الصك</th>
              <th className="pb-3 font-medium text-stone-600">الحالة</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {units.map(u => (
              <tr key={u.id}>
                <td className="py-3 font-medium">{u.unit_number}</td>
                <td className="py-3">{u.floor}</td>
                <td className="py-3">{u.area_sqm.toLocaleString('ar-SA')}</td>
                <td className="py-3">{u.price.toLocaleString('ar-SA')}</td>
                <td className="py-3 font-mono text-xs text-stone-500">{u.sak_id}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                    {STATUS_LABELS[u.status]}
                  </span>
                </td>
                <td className="py-3 text-left">
                  <button
                    onClick={() => setUnitModal({ open: true, unit: u })}
                    className="text-stone-400 hover:text-stone-700 ml-2 text-xs"
                    title="تعديل"
                  >✎</button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="حذف"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unitModal.open && buildingId && projectId && (
        <UnitFormModal
          buildingId={buildingId}
          projectId={projectId}
          unit={unitModal.unit}
          onClose={() => setUnitModal({ open: false })}
          onSaved={loadUnits}
        />
      )}

      {csvModal && projectId && (
        <CsvImportModal
          projectId={projectId}
          onClose={() => setCsvModal(false)}
          onSaved={loadUnits}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -i "units\|Unit" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/projects/_components/ && git commit -m "feat: UnitsPanel + UnitFormModal"
```

---

## Task 8: Frontend — CsvImportModal

**Files:**
- Modify: `frontend/src/app/projects/_components/CsvImportModal.tsx` (replace stub)

- [ ] **Step 1: Replace CsvImportModal stub with full implementation**

```tsx
// frontend/src/app/projects/_components/CsvImportModal.tsx
'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ImportError = {
  row: number
  field: string
  message: string
}

type Props = {
  projectId: string
  onClose: () => void
  onSaved: () => void
}

export default function CsvImportModal({ projectId, onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<string[][] | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setErrors([])

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) ?? []
      const dataRows = lines.slice(1)
      setTotalRows(dataRows.length)
      const previewRows = dataRows.slice(0, 5).map(row =>
        row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      )
      setPreview([headers, ...previewRows])
    }
    reader.readAsText(f)
  }

  async function handleImport() {
    if (!file) return
    setErrors([])
    setImporting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
      const res = await fetch(`${backend}/units/import?project_id=${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json()
        if (body.detail?.errors) {
          setErrors(body.detail.errors)
          return
        }
        throw new Error(body.detail || 'Import failed')
      }

      const result = await res.json()
      onSaved()
      onClose()
      alert(`تم استيراد ${result.imported} وحدة بنجاح`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrors([{ row: 0, field: '', message: err.message }])
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">استيراد وحدات من CSV</h2>

        <div className="mb-4 p-3 bg-stone-50 rounded-xl text-xs text-stone-600 space-y-1">
          <p className="font-medium">الأعمدة المطلوبة:</p>
          <p className="font-mono">building_number, unit_number, floor, area_sqm, price, sak_id</p>
          <p className="font-medium mt-1">اختيارية:</p>
          <p className="font-mono">electricity_meter_id, water_meter_id</p>
          <p className="text-stone-400 mt-1">يجب أن تكون المباني موجودة مسبقاً. يُرجع الملف بأكمله في حال وجود أي خطأ.</p>
        </div>

        <div className="mb-4">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost border border-stone-200 w-full py-3 text-sm"
          >
            {fileName || 'اختر ملف CSV...'}
          </button>
        </div>

        {preview && (
          <div className="mb-4 overflow-x-auto">
            <p className="text-xs text-stone-500 mb-2">معاينة ({totalRows} صف)</p>
            <table className="text-xs w-full border border-stone-200 rounded-xl overflow-hidden">
              <thead className="bg-stone-50">
                <tr>
                  {preview[0].map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-right font-medium text-stone-600 border-b border-stone-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {preview.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {totalRows > 5 && (
              <p className="text-xs text-stone-400 mt-1 text-center">... و {totalRows - 5} صفوف أخرى</p>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm max-h-48 overflow-y-auto">
            <p className="font-semibold text-red-700 mb-2">أخطاء في الملف ({errors.length})</p>
            <div className="space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  {e.row > 0 ? `صف ${e.row}` : 'خطأ عام'}{e.field ? ` (${e.field})` : ''}: {e.message}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="btn-primary flex-1"
            disabled={!file || importing}
          >
            {importing ? 'جارٍ الاستيراد...' : 'استيراد'}
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -i "csv\|import" | head -10
```

Expected: no errors.

- [ ] **Step 3: Run full backend test suite to confirm nothing regressed**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -v 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/projects/_components/CsvImportModal.tsx && git commit -m "feat: CsvImportModal"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| GET /projects with nested buildings | Task 2 |
| POST/PATCH/DELETE /projects | Task 2 |
| POST/PATCH/DELETE /buildings | Task 3 |
| GET/POST/PATCH/DELETE /units | Task 4 |
| POST /units/import — CSV, project_id, building_number routing | Task 4 |
| CSV validation: required cols, +ve numbers, building lookup, SAK dups, SAK DB check | Task 4 |
| All-or-nothing import | Task 4 |
| Row-by-row error response | Task 4 |
| Split view page at /projects | Task 5 |
| ProjectTree accordion, URL-driven, hover actions | Task 5 |
| ProjectFormModal add/edit | Task 6 |
| BuildingFormModal add/edit | Task 6 |
| UnitsPanel: table, status badge, edit/delete | Task 7 |
| UnitFormModal add/edit | Task 7 |
| CsvImportModal: file picker, preview, import, errors | Task 8 |

All spec requirements covered. No placeholders found. Types are consistent across tasks (Unit, Project, Building types match between UnitsPanel and UnitFormModal). Route order in units.py puts `/import` before `/{unit_id}`. ✓
