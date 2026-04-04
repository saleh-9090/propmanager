# Day 6: Reservation Flow Design

---

## What This Builds

A reservation flow at `/reservations`. Staff can create reservations linking a unit to a customer with a deposit record. Creating a reservation locks the unit to `reserved`. Cancelling unlocks it back to `available`. The list shows active and expired reservations only.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Entry points | Both unit-first and customer-first, via URL params |
| Receipt upload | Optional at creation, updatable via PATCH |
| Expiry handling | Manual only — no background auto-expiry |
| List contents | Active + expired only (cancelled/converted excluded) |
| Unit locking | Sequential: create reservation → update unit; rollback reservation if unit update fails |

---

## Pages & Navigation

### `/reservations`

Single page. Shows active + expired reservations. "حجز جديد" button opens the reservation form.

**Entry points that pre-fill the form:**
- `/units` availability board → "احجز" button on available unit cards → navigates to `/reservations?unit_id=<id>`
- `/customers` list → "حجز" button on each customer row → navigates to `/reservations?customer_id=<id>`

When form opens with a pre-filled unit or customer, that picker is locked (read-only) to prevent accidental changes.

---

## Backend API

Router: `backend/app/routers/reservations.py`

All operations use user JWT passed to Supabase. RLS enforces `company_id` isolation.

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/reservations` | all roles | List active + expired reservations |
| POST | `/reservations` | owner, sales_manager, reservation_manager | Create reservation + lock unit to `reserved` |
| PATCH | `/reservations/{id}` | owner, sales_manager, reservation_manager | Update receipt URL or payment details |
| POST | `/reservations/{id}/cancel` | owner, sales_manager, reservation_manager | Cancel reservation + unlock unit to `available` |

### GET /reservations

Returns reservations where `status = 'active'` (both current and expired). Expired = `expires_at < today`. Ordered by `expires_at asc` (most urgent first). Uses PostgREST `eq` filter on status.

Joins to return: `unit(unit_number, building_id, price)` and `customer(full_name, id_number)` via nested select.

### POST /reservations

WRITERS = `{owner, sales_manager, reservation_manager}`

1. Check caller role is in WRITERS
2. Check unit status is `available` — if not, return 409 "الوحدة غير متاحة للحجز"
3. Insert reservation record with `company_id` from caller profile
4. Update unit `status` to `reserved`
5. If unit update fails: delete the reservation, return 500

Body fields: `unit_id`, `customer_id`, `deposit_amount`, `payment_method`, `payment_reference`, `payment_date`, `expires_at`, `notes`

`receipt_file_url` is not accepted at creation — uploaded separately via PATCH.

### PATCH /reservations/{id}

Accepts any subset of: `deposit_amount`, `payment_method`, `payment_reference`, `payment_date`, `expires_at`, `receipt_file_url`, `notes`

Does not allow changing `unit_id` or `customer_id` after creation.

### POST /reservations/{id}/cancel

Body: `{ cancellation_reason: string, refund_amount: number }`

1. Check caller role is in WRITERS
2. Fetch reservation — verify it belongs to caller's company and status is `active`
3. Update reservation: `status = 'cancelled'`, set `cancellation_reason`, `refund_amount`
4. Update unit `status` back to `available`

### Supabase client functions to add (`backend/app/supabase_client.py`)

```python
get_reservations(token: str) -> list[dict]
create_reservation(data: dict, token: str) -> dict
update_reservation(reservation_id: str, data: dict, token: str) -> None
cancel_reservation(reservation_id: str, data: dict, token: str) -> None
get_unit(unit_id: str, token: str) -> dict
update_unit_status(unit_id: str, status: str, token: str) -> None
```

`get_reservations` uses: `select=*,units(unit_number,building_id,price),customers(full_name,id_number)&status=eq.active&order=expires_at.asc`

---

## Frontend

### Files

| File | Responsibility |
|---|---|
| `frontend/src/app/(app)/reservations/page.tsx` | Client page — reservation list + form |
| `frontend/src/app/(app)/reservations/_components/ReservationForm.tsx` | Create/edit reservation form |
| `frontend/src/app/(app)/reservations/_components/CancelModal.tsx` | Cancellation confirm dialog |

### page.tsx behaviour

- Reads `?unit_id=` and `?customer_id=` from URL on mount — if present, auto-opens the form with those values pre-filled and locked
- Fetches all reservations on mount: `GET /reservations`
- "حجز جديد" button: opens `ReservationForm` with no pre-fill
- ✎ button: opens `ReservationForm` pre-filled with existing reservation data (edit mode)
- ✕ button: opens `CancelModal`
- After form save or cancellation: re-fetches list

### ReservationForm

**Mode: create**
- unit picker: searchable select — fetches `GET /units` (all available units for company), search by unit_number
- customer picker: searchable select — fetches `GET /customers`, search by name or id_number (reuses existing `GET /customers?search=` endpoint)
- If `unit_id` or `customer_id` pre-filled from URL: show as read-only display, not a picker
- `expires_at` default: today + `default_reservation_days` from company profile
- Receipt file upload: hidden in create mode (shown only in edit mode)
- Submit → `POST /reservations`

**Mode: edit**
- All fields editable except unit and customer (always locked in edit)
- Receipt file upload: shown — if `receipt_file_url` exists, show link + "استبدال" button; otherwise show upload input
- Receipt upload flow: upload file to Supabase Storage bucket `receipts`, get public URL, then PATCH reservation with the URL
- Submit → `PATCH /reservations/{id}`

### CancelModal

Fields: cancellation_reason (textarea, required), refund_amount (number, default 0)
Submit → `POST /reservations/{id}/cancel`

### Table columns

| Column | Notes |
|---|---|
| الوحدة | unit_number |
| العميل | customer full_name |
| مبلغ العربون | deposit_amount (formatted ar-SA) |
| طريقة الدفع | Arabic label |
| تاريخ الدفع | payment_date |
| تاريخ الانتهاء | expires_at |
| الحالة | badge: نشطة (green) / منتهية (red) |
| الإجراءات | ✎ edit, ✕ cancel |

**Status badge logic:**
- `expires_at >= today` → `bg-green-100 text-green-700` — نشطة
- `expires_at < today` → `bg-red-100 text-red-700` — منتهية

**Payment method Arabic labels:**
- `cash` → نقد
- `bank_transfer` → تحويل بنكي
- `check` → شيك

**Empty state:** "لا توجد حجوزات نشطة"

### Entry point buttons

**`/units` page.tsx** — add "احجز" button to each available unit card:
```tsx
{u.status === 'available' && (
  <Link href={`/reservations?unit_id=${u.id}`} className="btn-primary text-xs">
    احجز
  </Link>
)}
```

**`/customers` page.tsx** — add "احجز" button to each customer row:
```tsx
<Link href={`/reservations?customer_id=${c.id}`} className="btn-ghost text-xs">
  احجز
</Link>
```

---

## Permissions Summary

| Action | Roles |
|---|---|
| View reservations | All roles |
| Create / edit / cancel | owner, sales_manager, reservation_manager |

Enforced at: API level (caller profile check) + Supabase RLS (company_id isolation).

---

## Receipt File Storage

Bucket: `receipts` (Supabase Storage)

Upload happens client-side from the edit form:
1. User picks file → frontend uploads directly to Supabase Storage using the browser Supabase client
2. Gets back a public URL
3. PATCH reservation with `receipt_file_url`

No backend involvement in file upload — frontend handles it directly via `supabase.storage.from('receipts').upload(...)`.

---

## What's Not in Day 6

- Reservation-to-sale conversion (Day 7)
- Deposit return tracking (Day 7 — when sale is finalised)
- Auto-expiry background job (deferred — manual only)
- Receipt file preview in table (deferred)
- Reservation detail page (deferred)
