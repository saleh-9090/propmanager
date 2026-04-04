# Day 5: Unit Availability Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only `/units` availability board that shows all company units in a filterable card grid (by project, building, and status).

**Architecture:** Extend the existing `GET /units` endpoint to support no-filter (all company units) and `?project_id=` filter in addition to the existing `?building_id=` filter. The frontend page fetches all units plus the projects list on mount, then filters entirely client-side — no re-fetch on filter change.

**Tech Stack:** FastAPI + httpx (backend), Next.js 14 App Router + Tailwind + TypeScript (frontend), pytest (backend tests), Supabase PostgREST (data layer)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `backend/app/supabase_client.py` | Modify ~line 188 | Extend `get_units` to accept optional `building_id` and `project_id` |
| `backend/app/routers/units.py` | Modify ~line 39–41 | Make `building_id` optional, add `project_id` query param |
| `backend/tests/test_units.py` | Modify ~line 28–34 | Update existing list test + add 2 new GET tests |
| `frontend/src/app/units/page.tsx` | Create | Availability board — filter bar + summary + card grid |

The nav link `/units` already exists in `frontend/src/app/dashboard/layout.tsx` — no changes needed there.

---

## Task 1: Backend — extend `GET /units`

**Files:**
- Modify: `backend/tests/test_units.py` (lines 28–34)
- Modify: `backend/app/supabase_client.py` (lines 188–200)
- Modify: `backend/app/routers/units.py` (lines 39–41)

### Context

Current `get_units(building_id: str, token)` requires `building_id`. The router passes it directly. The existing test asserts `mock.assert_called_once_with("bldg-222", "test-token")`. All three must change together.

Current `get_units` in `backend/app/supabase_client.py`:
```python
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
```

Current router in `backend/app/routers/units.py`:
```python
@router.get("")
async def list_units(building_id: str, user=Depends(get_current_user)):
    return await supabase_client.get_units(building_id, user["token"])
```

- [ ] **Step 1: Write the failing tests**

Replace the existing `test_list_units` and add two new tests in `backend/tests/test_units.py`. These will fail until the implementation is done because `get_units` currently requires `building_id` as a positional arg.

```python
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
```

Note: rename `test_list_units` → `test_list_units_by_building` (the existing function at line 28).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /mnt/d/claude/propmanager/backend
python3.12 -m pytest tests/test_units.py::test_list_units_by_building tests/test_units.py::test_list_units_by_project tests/test_units.py::test_list_units_all -v
```

Expected: 3 FAILED (AssertionError on mock call args or signature error)

- [ ] **Step 3: Implement — update `get_units` in `backend/app/supabase_client.py`**

Replace the existing `get_units` function (lines 188–200):

```python
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
```

- [ ] **Step 4: Implement — update `list_units` in `backend/app/routers/units.py`**

Replace lines 39–41:

```python
@router.get("")
async def list_units(
    building_id: str | None = None,
    project_id: str | None = None,
    user=Depends(get_current_user),
):
    return await supabase_client.get_units(building_id, project_id, user["token"])
```

- [ ] **Step 5: Run the 3 new tests to verify they pass**

```bash
cd /mnt/d/claude/propmanager/backend
python3.12 -m pytest tests/test_units.py::test_list_units_by_building tests/test_units.py::test_list_units_by_project tests/test_units.py::test_list_units_all -v
```

Expected: 3 PASSED

- [ ] **Step 6: Run the full suite to check for regressions**

```bash
python3.12 -m pytest tests/ -q
```

Expected: all tests pass (was 46 before this task — should remain 46 since we renamed one test and added 2, net +2 = 48)

- [ ] **Step 7: Commit**

```bash
cd /mnt/d/claude/propmanager
git add backend/app/supabase_client.py backend/app/routers/units.py backend/tests/test_units.py
git commit -m "feat: extend GET /units to support project_id filter and no-filter (all units)"
```

---

## Task 2: Frontend — availability board page

**Files:**
- Create: `frontend/src/app/units/page.tsx`

### Context

- The nav link `/units` already exists in `frontend/src/app/dashboard/layout.tsx` — the page just needs to be created.
- `GET /projects` returns `[{ id, name, name_ar, buildings: [{ id, building_number, name }] }]`.
- `GET /units` (no params) returns all company units after Task 1.
- Use `apiGet` from `@/lib/api` — it handles auth automatically.
- Status colours and labels already exist in `UnitsPanel.tsx` — replicate them here (no shared module exists in this codebase; inline the constants).
- The `card` and `input` CSS classes are defined in `frontend/src/app/globals.css`.

- [ ] **Step 1: Create `frontend/src/app/units/page.tsx`**

```tsx
// frontend/src/app/units/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  status: 'available' | 'reserved' | 'sold'
  building_id: string
  project_id: string
}

type Building = {
  id: string
  building_number: string
  name: string | null
}

type Project = {
  id: string
  name: string
  name_ar: string | null
  buildings: Building[]
}

const STATUS_LABELS: Record<string, string> = {
  available: 'متاحة',
  reserved:  'محجوزة',
  sold:      'مباعة',
}
const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved:  'bg-yellow-100 text-yellow-700',
  sold:      'bg-red-100 text-red-700',
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [checkedStatuses, setCheckedStatuses] = useState<Set<string>>(
    new Set(['available', 'reserved', 'sold'])
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [unitsData, projectsData] = await Promise.all([
          apiGet<Unit[]>('/units'),
          apiGet<Project[]>('/projects'),
        ])
        setUnits(unitsData)
        setProjects(projectsData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const availableBuildings = selectedProject?.buildings ?? []

  const filtered = units.filter(u => {
    if (selectedProjectId && u.project_id !== selectedProjectId) return false
    if (selectedBuildingId && u.building_id !== selectedBuildingId) return false
    if (!checkedStatuses.has(u.status)) return false
    return true
  })

  const counts = {
    available: filtered.filter(u => u.status === 'available').length,
    reserved:  filtered.filter(u => u.status === 'reserved').length,
    sold:      filtered.filter(u => u.status === 'sold').length,
  }

  function toggleStatus(s: string) {
    setCheckedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-6">لوحة الوحدات</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          className="input w-48"
          value={selectedProjectId}
          onChange={e => {
            setSelectedProjectId(e.target.value)
            setSelectedBuildingId('')
          }}
        >
          <option value="">كل المشاريع</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name_ar ?? p.name}</option>
          ))}
        </select>

        <select
          className="input w-48"
          value={selectedBuildingId}
          onChange={e => setSelectedBuildingId(e.target.value)}
          disabled={!selectedProjectId}
        >
          <option value="">كل المباني</option>
          {availableBuildings.map(b => (
            <option key={b.id} value={b.id}>{b.name ?? b.building_number}</option>
          ))}
        </select>

        <div className="flex gap-4">
          {(['available', 'reserved', 'sold'] as const).map(s => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={checkedStatuses.has(s)}
                onChange={() => toggleStatus(s)}
              />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Summary row */}
      {!loading && !error && (
        <p className="text-sm text-stone-500 mb-4">
          {counts.available} متاحة · {counts.reserved} محجوزة · {counts.sold} مباعة
        </p>
      )}

      {loading && <p className="text-stone-500 text-sm">جارٍ التحميل...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-stone-400 text-sm text-center py-16">
          لا توجد وحدات تطابق الفلتر المحدد
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(u => (
            <div key={u.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold text-stone-900">{u.unit_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                  {STATUS_LABELS[u.status]}
                </span>
              </div>
              <div className="text-sm text-stone-600 space-y-0.5">
                <div>ط {u.floor}</div>
                <div>{u.area_sqm.toLocaleString('ar-SA')} م²</div>
                <div>{u.price.toLocaleString('ar-SA')} ر.س</div>
              </div>
              <div className="mt-2 font-mono text-xs text-stone-400 truncate">{u.sak_id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript (no node_modules needed — just check syntax)**

The file has no imports that could cause type errors beyond `apiGet`. If `node_modules` is available:

```bash
cd /mnt/d/claude/propmanager/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on `src/app/units/page.tsx`

- [ ] **Step 3: Commit**

```bash
cd /mnt/d/claude/propmanager
git add frontend/src/app/units/page.tsx
git commit -m "feat: Day 5 — unit availability board"
```
