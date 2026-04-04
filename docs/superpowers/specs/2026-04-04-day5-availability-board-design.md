# Day 5: Unit Availability Board Design

---

## What This Builds

A read-only availability board at `/units`. All staff can see every unit across the company's inventory in one flat card grid, filtered by project, building, and status. No write actions on this page.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Layout | Top filter bar + card grid |
| Data loading | All units fetched on mount, filtering done client-side |
| Status filtering | Checkboxes (all checked by default) |
| Project/building filtering | Cascading dropdowns |
| Card detail level | Full — unit number, floor, area, price, SAK ID, status badge |
| Settings customisation | Deferred |

---

## Backend

### Changes to existing `GET /units`

File: `backend/app/routers/units.py`

Make `building_id` optional. Add optional `project_id` param. Both `None` → return all units for the company.

| Params | Behaviour |
|---|---|
| none | All units for the company (RLS enforces scope) |
| `?project_id=<id>` | All units in that project |
| `?building_id=<id>` | All units in that building (existing behaviour) |

### Changes to `get_units` in `backend/app/supabase_client.py`

New signature:

```python
async def get_units(building_id: str | None, project_id: str | None, token: str) -> list[dict]
```

When `building_id` is set: filter `eq=building_id.<id>`.
When `project_id` is set (and no building_id): filter `eq=project_id.<id>`.
When both `None`: no extra filter — RLS returns all company units.

All results ordered by `project_id, building_id, floor, unit_number`.

### No new endpoint

`GET /units` is extended in-place. All roles can call it (no permission check needed — read-only, RLS enforces company scope).

---

## Frontend

### Page: `/units`

File: `frontend/src/app/units/page.tsx` — single client component, no sub-components needed.

**On mount:** two parallel fetches:
1. `GET /units` → all units
2. `GET /projects` → projects with buildings nested (for filter dropdowns)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  لوحة الوحدات                                        │
│  [كل المشاريع ▼]  [كل المباني ▼]  ☑ متاحة ☑ محجوزة ☑ مباعة │
│  ٢٤ متاحة · ٨ محجوزة · ١٢ مباعة                     │
│                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ A101 │ │ A102 │ │ B201 │ │ B202 │               │
│  │ط ١   │ │ط ١   │ │ط ٢   │ │ط ٢   │               │
│  │120م² │ │95م²  │ │110م² │ │88م²  │               │
│  │450k  │ │380k  │ │420k  │ │350k  │               │
│  │متاحة │ │محجوز │ │مباعة │ │متاحة │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
└─────────────────────────────────────────────────────┘
```

**Filter behaviour:**
- Project dropdown: "كل المشاريع" + project list (name_ar or name)
- Building dropdown: "كل المباني" + buildings from selected project only; disabled when no project is selected; resets to "كل المباني" when project changes
- Status checkboxes: متاحة / محجوزة / مباعة — all checked by default; all filtering is local state, no re-fetch

**Summary row:** counts reflect the *currently filtered* units — e.g. `٢٤ متاحة · ٨ محجوزة · ١٢ مباعة`

**Card grid:** `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`

**Unit card fields:**
| Field | Display |
|---|---|
| unit_number | Large bold heading |
| floor | `ط <n>` |
| area_sqm | `<n> م²` |
| price | `<n> ر.س` (toLocaleString ar-SA) |
| sak_id | Small monospace, muted |
| status | Badge — same colours as `/projects` |

**Status badge colours** (reuse from existing):
- `available` → `bg-green-100 text-green-700` — متاحة
- `reserved` → `bg-yellow-100 text-yellow-700` — محجوزة
- `sold` → `bg-red-100 text-red-700` — مباعة

**Empty state:** "لا توجد وحدات تطابق الفلتر المحدد"

**No write actions** on this page.

---

## Permissions

All authenticated roles can view the board. No role check needed beyond the JWT (RLS handles company isolation).

---

## What's Not in Day 5

- Settings customisation for card fields (deferred)
- Sorting cards (deferred)
- Price range filter (deferred)
- Clicking a unit to see its reservation/sale history (deferred to Day 6–7)
