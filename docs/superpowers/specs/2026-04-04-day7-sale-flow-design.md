# Day 7: Sale Flow Design

---

## What This Builds

A sale flow at `/sales`. Staff can create sales in two modes: converting an active reservation to a sale, or recording a direct sale (unit goes straight from available → sold with no prior reservation). After a reservation-to-sale conversion, the deposit return is recorded separately from the `/reservations` page.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Entry points | Both: "تحويل" on `/reservations` + "بيعة جديدة" on `/sales` |
| Deposit return | Separate action after sale — "سداد العربون" button on converted reservations |
| Sale reversal | Deferred — not in Day 7 |
| WRITERS for sales | `{owner, sales_manager}` only — reservation_manager cannot see payment amounts |
| Reservation list filter | Change from `status=eq.active` to show `active` + `converted` (exclude `cancelled` only) |

---

## Pages & Navigation

### `/sales`

Single page. Lists all completed sales. "بيعة جديدة" button opens SaleForm blank (direct sale mode).

**Entry point from `/reservations`:**
- "تحويل" button on active reservation rows → navigates to `/sales?reservation_id=<id>`
- Page reads `?reservation_id=` on mount, fetches the reservation, auto-opens SaleForm pre-filled with unit + customer locked

**Deposit return entry point:**
- `/reservations` page now shows `active` + `converted` reservations (excluding `cancelled`)
- Converted reservations show grey "محوّلة" badge
- If `deposit_returned = false` on a converted reservation: "سداد العربون" button opens ReturnDepositModal

---

## Backend API

Router: `backend/app/routers/sales.py`

WRITERS = `{owner, sales_manager}`

All operations use user JWT passed to Supabase. RLS enforces `company_id` isolation.

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/sales` | owner, sales_manager, cfo, accountant | List all sales |
| POST | `/sales` | owner, sales_manager | Create sale — direct or conversion |
| POST | `/reservations/{id}/return-deposit` | owner, sales_manager | Record deposit return on a converted reservation |

### GET /sales

Returns all sales ordered by `created_at desc`.

Joins: `units(unit_number, building_id)` and `customers(full_name, id_number)` via nested select.

Query: `select=*,units(unit_number,building_id),customers(full_name,id_number)&order=created_at.desc`

### POST /sales

Body fields: `unit_id`, `customer_id`, `payment_amount`, `payment_method`, `payment_date`, `reservation_id` (optional), `payment_reference` (optional), `notes` (optional)

Steps:
1. Check caller role in WRITERS (403 if not)
2. If `reservation_id` provided (conversion mode):
   - Fetch reservation — verify belongs to caller's `company_id` and `status = 'active'`
   - If not found or wrong status: 409 "الحجز غير صالح للتحويل"
3. If no `reservation_id` (direct sale mode):
   - Fetch unit — verify `status = 'available'` (409 "الوحدة غير متاحة للبيع" if not)
4. Insert sale: `company_id` from caller, `status = 'completed'`
5. Update unit `status → 'sold'`
6. If conversion: update reservation `status → 'converted'`

No rollback on step 5/6 failures — same pattern as reservations (internal tool, acceptable risk).

### POST /reservations/{id}/return-deposit

Body: `{ deposit_return_method, deposit_return_date, deposit_return_reference (optional) }`

Steps:
1. Check caller role in WRITERS (403 if not)
2. Fetch reservation — verify belongs to caller's `company_id` and `status = 'converted'`
3. If not found or wrong status: 404 "الحجز غير موجود أو لم يتم تحويله"
4. Patch reservation: `deposit_returned = true`, `deposit_return_method`, `deposit_return_date`, `deposit_return_reference`

### Supabase client functions to add (`backend/app/supabase_client.py`)

```python
get_sales(token: str) -> list[dict]
create_sale(data: dict, token: str) -> dict
update_reservation_status(reservation_id: str, status: str, token: str) -> None
record_deposit_return(reservation_id: str, data: dict, token: str) -> None
```

`get_sales` uses: `select=*,units(unit_number,building_id),customers(full_name,id_number)&order=created_at.desc`

**Also modify existing:**
- `get_reservations`: change filter from `status=eq.active` to `status=in.(active,converted)` — show both active and converted reservations (exclude cancelled only)

---

## Frontend

### Files

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/app/(app)/sales/page.tsx` | Create | Sales list + form orchestration |
| `frontend/src/app/(app)/sales/_components/SaleForm.tsx` | Create | Create sale form (direct + conversion modes) |
| `frontend/src/app/(app)/reservations/page.tsx` | Modify | Add "تحويل" + "سداد العربون" buttons, update status filter |
| `frontend/src/app/(app)/reservations/_components/ReturnDepositModal.tsx` | Create | Deposit return form |

### sales/page.tsx behaviour

- Reads `?reservation_id=` from URL on mount — if present, fetches reservation via `GET /reservations` (filters client-side by id). If reservation `status !== 'active'`: shows error "هذا الحجز لا يمكن تحويله" instead of opening the form. If `status === 'active'`: auto-opens SaleForm pre-filled and locked.
- Fetches all sales on mount: `GET /sales`
- "بيعة جديدة" button: opens SaleForm blank (direct mode)
- After form save: re-fetches sales list, closes form
- No edit or cancel actions on sales in Day 7

### SaleForm

**Conversion mode** (reservation pre-filled):
- Unit displayed as locked read-only (unit_number from reservation.units)
- Customer displayed as locked read-only (full_name from reservation.customers)
- All payment fields editable

**Direct mode** (no pre-fill):
- Unit picker: searchable select of available units (`GET /units`, client-side filter `status === 'available'`)
- Customer picker: searchable select (`GET /customers`, search by name/id_number)

**All modes — payment fields:**
- `payment_amount` (number, required)
- `payment_method` (select: نقد / تحويل بنكي / شيك, required)
- `payment_reference` (text, optional)
- `payment_date` (date, default today, required)
- `notes` (textarea, optional)

Submit → `POST /sales`

### Sales table columns

| Column | Notes |
|---|---|
| الوحدة | unit_number |
| العميل | customer full_name |
| مبلغ البيع | payment_amount (formatted ar-SA) |
| طريقة الدفع | Arabic label |
| تاريخ البيع | payment_date |
| النوع | مباشر (no reservation_id) / تحويل من حجز (has reservation_id) |

**Payment method Arabic labels:**
- `cash` → نقد
- `bank_transfer` → تحويل بنكي
- `check` → شيك

**Empty state:** "لا توجد مبيعات"

### Reservations page modifications

**Filter change:** Backend `get_reservations` now returns `active` + `converted`. Frontend shows all returned rows.

**Status badge additions:**
- `status = 'converted'` → `bg-stone-100 text-stone-600` — محوّلة

**Button additions per row:**
- Active reservations: add "تحويل" button (after ✎ and ✕) → `<Link href={/sales?reservation_id=${r.id}}>تحويل</Link>`
- Converted reservations where `deposit_returned = false`: show "سداد العربون" button → opens ReturnDepositModal
- Converted reservations where `deposit_returned = true`: show green "✓ عربون مُسترد" text (no button)
- Converted reservations: ✎ and ✕ buttons are hidden (cannot edit or cancel a converted reservation)

**Column header change:** "الحالة" badge now has 4 states: نشطة / منتهية / محوّلة

### ReturnDepositModal

Fields:
- `deposit_return_method` (select: نقد / تحويل بنكي / شيك, required)
- `deposit_return_date` (date, default today, required)
- `deposit_return_reference` (text, optional — check number / transfer ref)

Submit → `POST /reservations/{id}/return-deposit`

On success: close modal, re-fetch reservations list

---

## Permissions Summary

| Action | Roles |
|---|---|
| View sales | owner, sales_manager, cfo, accountant |
| Create sale | owner, sales_manager |
| Record deposit return | owner, sales_manager |

Enforced at: API level (caller profile check) + Supabase RLS (company_id isolation).

---

## What's Not in Day 7

- Sale reversal (deferred — Day 9 with audit trail)
- Commission entry on sale (Day 8)
- Sale edit (no edit mode — amount/method are final once recorded)
- Receipt file upload on sale (deferred — same bucket pattern as reservations, can add in Day 8)
