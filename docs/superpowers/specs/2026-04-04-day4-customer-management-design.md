# Day 4: Customer Management Design

---

## What This Builds

A searchable customer list at `/customers`. Staff can create, edit, and delete customers. Search works across name, ID number, and phone number. Customers are the people who will be linked to reservations and sales in later days.

---

## Decisions Made

| Decision | Choice |
|---|---|
| Page layout | Full-page table with search bar + modal (no split view) |
| Search fields | full_name, id_number, phone (case-insensitive OR match) |
| Lead source stats/filtering | Deferred |
| Customer detail page | Deferred (no sub-records yet) |

---

## Backend API

Router: `backend/app/routers/customers.py`

All operations follow the existing pattern: user JWT passed to Supabase, RLS enforces `company_id`.

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/customers` | all roles | List customers; optional `?search=` query param |
| POST | `/customers` | owner, sales_manager, reservation_manager | Create customer |
| PATCH | `/customers/{id}` | owner, sales_manager, reservation_manager | Update customer |
| DELETE | `/customers/{id}` | owner | Delete customer |

### GET /customers

- If `search` param is absent: return all customers ordered by `created_at desc`
- If `search` param is present: filter where `full_name ilike %search%` OR `id_number ilike %search%` OR `phone ilike %search%`
- Uses Supabase PostgREST `or` filter with `ilike` operators

### Supabase client functions to add (`backend/app/supabase_client.py`)

```python
get_customers(search: str | None, token: str) -> list[dict]
create_customer(data: dict, token: str) -> dict
update_customer(customer_id: str, data: dict, token: str) -> None
delete_customer(customer_id: str, token: str) -> None
```

---

## Frontend

### Page: `/customers`

Single client component page. No URL params needed (search is local state with debounce).

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  العملاء                          + عميل جديد       │
│  [بحث بالاسم أو رقم الهوية أو الجوال...]            │
│                                                     │
│  الاسم       الهوية    رقم الهوية  الجوال   المصدر  │
│  ──────────────────────────────────────────────     │
│  محمد علي    هوية      1234...     05...    مباشر   │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Files:**
| File | Responsibility |
|---|---|
| `frontend/src/app/customers/page.tsx` | Client page — search bar + customers table + CustomerFormModal |
| `frontend/src/app/customers/_components/CustomerFormModal.tsx` | Add/edit customer form |

### page.tsx behaviour

- Search input: debounced 300ms, calls `GET /customers?search=<value>` on change
- Empty search: fetches all customers
- `+ عميل جديد` button: opens `CustomerFormModal` with no pre-filled data
- Edit (✎) button on each row: opens `CustomerFormModal` pre-filled
- Delete (×) button: confirm dialog → `DELETE /customers/{id}` → remove from list (owner only — button hidden for non-owners via role check)
- Empty state: "لا يوجد عملاء — أضف عميلاً جديداً"
- No results from search: "لا توجد نتائج"

**Table columns:** full_name, id_type (badge), id_number, phone, email, lead_source (Arabic label), actions

**id_type badge labels:**
- `national_id` → هوية
- `iqama` → إقامة
- `passport` → جواز

**lead_source Arabic labels:**
- `instagram` → انستغرام
- `snapchat` → سناب شات
- `tiktok` → تيك توك
- `realtor_referral` → وسيط عقاري
- `walk_in` → زيارة مباشرة
- `direct` → مباشر
- `other` → أخرى

### CustomerFormModal

**Fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| full_name | text | ✓ | |
| id_type | select | ✓ | national_id / iqama / passport |
| id_number | text | ✓ | Unique per company — backend returns 409/400 on duplicate |
| phone | text | ✓ | |
| email | text | | |
| birthdate | date | | |
| lead_source | select | ✓ | 7 options |
| notes | textarea | | |

On create: `POST /customers`
On edit: `PATCH /customers/{id}`

Optional fields sent as `null` when empty.

---

## Permissions Summary

| Action | Roles |
|---|---|
| View customers | All roles |
| Create / edit | owner, sales_manager, reservation_manager |
| Delete | owner only |

Enforced at: API level (caller profile check) + Supabase RLS (company_id isolation).

---

## What's Not In Day 4

- Lead source stats / filtering (deferred)
- Customer detail page with reservation/sales history (deferred to after Day 6-7)
- Customer search from reservation flow (Day 6 will reuse this page's patterns)
