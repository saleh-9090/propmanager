# Day 3: Inventory Management Design
## Projects → Buildings → Units + CSV Import

---

## What This Builds

A split-view inventory management page at `/projects`. Staff can manage the full hierarchy — projects, buildings, and units — from one screen. Owners can bulk-import units from a CSV file scoped to a project.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Navigation pattern | Split view — tree left, units table right |
| CSV scope | One file per project; `building_number` column routes rows to correct building |
| Buildings for import | Must exist before importing; CSV references them by `building_number` |
| Floor plans | Deferred (not in Day 3) |
| Unit status changes | Deferred to Day 5/6 (reservations/sales drive status) |

---

## Backend API

All routers follow the existing pattern: user JWT passed to Supabase, RLS enforces `company_id`. No service role needed — all operations are performed by authenticated staff.

### Projects — `backend/app/routers/projects.py`

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/projects` | all roles | List all projects with buildings nested (one query) |
| POST | `/projects` | owner, sales_manager | Create project |
| PATCH | `/projects/{id}` | owner, sales_manager | Update project |
| DELETE | `/projects/{id}` | owner | Delete project (cascades to buildings + units) |

`GET /projects` returns:
```json
[
  {
    "id": "...",
    "name": "...",
    "name_ar": "...",
    "project_number": "...",
    "city": "...",
    "buildings": [
      {"id": "...", "name": "...", "building_number": "...", "total_floors": 3}
    ]
  }
]
```

### Buildings — `backend/app/routers/buildings.py`

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/buildings` | owner, sales_manager | Create building under a project |
| PATCH | `/buildings/{id}` | owner, sales_manager | Update building |
| DELETE | `/buildings/{id}` | owner | Delete building (cascades to units) |

### Units — `backend/app/routers/units.py`

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/units?building_id=<id>` | all roles | List units for a building |
| POST | `/units` | owner, sales_manager | Create single unit |
| PATCH | `/units/{id}` | owner, sales_manager | Update unit fields |
| DELETE | `/units/{id}` | owner | Delete unit |
| POST | `/units/import?project_id=<id>` | owner, sales_manager | CSV bulk import |

### CSV Import

**Endpoint:** `POST /units/import?project_id=<id>` (multipart/form-data, field: `file`)

**CSV columns:**

| Column | Required | Notes |
|---|---|---|
| `building_number` | ✓ | Must match an existing building in the project |
| `unit_number` | ✓ | |
| `floor` | ✓ | Positive integer |
| `area_sqm` | ✓ | Positive number |
| `price` | ✓ | Positive number (SAR) |
| `sak_id` | ✓ | Globally unique deed number |
| `electricity_meter_id` | optional | |
| `water_meter_id` | optional | |

**Validation (all-or-nothing):**
The entire file is validated before any row is inserted. If any row fails, the whole import is rejected with a row-by-row error list.

Checks:
1. All required columns present in the header
2. No duplicate `sak_id` within the file
3. No `sak_id` that already exists in the DB (globally — SAK is unique across all companies)
4. `building_number` matches an existing building in the given project
5. `floor` is a positive integer
6. `area_sqm` and `price` are positive numbers

Error response format:
```json
{
  "detail": "Import failed",
  "errors": [
    {"row": 3, "field": "sak_id", "message": "SAK ID XYZ already exists"},
    {"row": 7, "field": "building_number", "message": "Building B5 not found in project"}
  ]
}
```

On success: `{"imported": 42}`

---

## Frontend

### Page: `/projects`

Single page using `useSearchParams` to track selected building.

URL: `/projects?building=<building_id>`

**Layout:**
```
┌─────────────────┬──────────────────────────────────┐
│  Projects Tree  │  Units Panel                     │
│  (w-72, fixed)  │  (flex-1)                        │
│                 │                                   │
│  + مشروع جديد  │  [Building name]  + وحدة  CSV ↑  │
│                 │                                   │
│  ▼ مشروع النرجس │  unit_number  floor  area  price │
│    + مبنى       │  ─────────────────────────────── │
│    □ مبنى A     │  A-101        1      120  450,000 │
│    □ مبنى B ←── │  A-102        1      115  430,000 │
│                 │  ...                              │
│  ▶ مشروع الورود │                                   │
└─────────────────┴──────────────────────────────────┘
```

### Components

All under `frontend/src/app/projects/`:

| File | Type | Responsibility |
|---|---|---|
| `page.tsx` | server | Fetches projects+buildings, passes to client components |
| `_components/ProjectTree.tsx` | client | Accordion tree, URL-driven selection |
| `_components/UnitsPanel.tsx` | client | Fetches + displays units for selected building |
| `_components/ProjectFormModal.tsx` | client | Add/edit project form |
| `_components/BuildingFormModal.tsx` | client | Add/edit building form |
| `_components/UnitFormModal.tsx` | client | Add/edit single unit form |
| `_components/CsvImportModal.tsx` | client | File picker → preview → confirm import |

### ProjectTree

- Accordion: each project expands to show its buildings
- Selected building highlighted
- Clicking building → `router.replace('/projects?building=<id>')`
- "+ مشروع جديد" button at top opens `ProjectFormModal`
- "+ مبنى" button inline with each project name opens `BuildingFormModal`

### UnitsPanel

- Reads `building_id` from URL param
- Fetches `GET /units?building_id=<id>` on mount and after mutations
- Table columns: unit_number, floor, area_sqm, price (formatted SAR), sak_id, status badge
- Edit (pencil icon) → `UnitFormModal` pre-filled
- Delete (trash icon) → confirm dialog → `DELETE /units/{id}`
- Empty state: "لا توجد وحدات — أضف وحدة أو استورد ملف CSV"
- No building selected: "اختر مبنى لعرض وحداته"

### CsvImportModal

1. File picker (accepts `.csv`) → parse CSV in browser → show preview table (first 5 rows + total count)
2. User clicks "استيراد" → `POST /units/import?project_id=<id>` → success or row-by-row error list
3. On error: display errors, keep modal open so user can fix the file
4. On success: close modal, reload units panel

### Forms

**Project form fields:** name_ar (required), name (required), project_number (required), city (optional), location_notes (optional)

**Building form fields:** building_number (required), name (optional), total_floors (optional)

**Unit form fields:** unit_number (required), floor (required), area_sqm (required), price (required), sak_id (required), electricity_meter_id (optional), water_meter_id (optional)

---

## Permissions Summary

| Action | Roles |
|---|---|
| View projects, buildings, units | All roles |
| Create/edit projects | owner, sales_manager |
| Create/edit buildings | owner, sales_manager |
| Create/edit/import units | owner, sales_manager |
| Delete projects, buildings, units | owner only |

Enforced at: API level (caller profile check) + Supabase RLS (company_id isolation).

Adding new roles in the future: update DB check constraint + RLS policies + API permission lists. No structural changes needed.

---

## What's Not In Day 3

- Floor plan uploads (Supabase Storage — deferred)
- Unit status changes (driven by reservations/sales — Day 5/6)
- Project-level reporting (Day 11)
