# Day 4: Customer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable customer list at `/customers` where staff can create, edit, and delete customers, with search across name, ID number, and phone.

**Architecture:** One new FastAPI router (`customers.py`) follows the existing pattern — user JWT to Supabase, RLS enforces `company_id`. Search uses Supabase PostgREST's `or` filter with `ilike`. Frontend is a single client page with a debounced search bar, table, and one modal for add/edit.

**Tech Stack:** FastAPI + httpx (backend), Next.js 14 App Router + useCallback + debounced useEffect (frontend), Supabase PostgREST `or` + `ilike` filters

---

## File Map

**Backend — new files:**
- `backend/app/routers/customers.py` — CRUD for customers
- `backend/tests/test_customers.py`

**Backend — modified files:**
- `backend/app/supabase_client.py` — 4 new functions
- `backend/main.py` — include customers router

**Frontend — new files:**
- `frontend/src/app/customers/page.tsx` — search bar + table + modal trigger
- `frontend/src/app/customers/_components/CustomerFormModal.tsx` — add/edit form

---

## Task 1: supabase_client.py — customer functions

**Files:**
- Modify: `backend/app/supabase_client.py`

- [ ] **Step 1: Append 4 new functions to the end of `backend/app/supabase_client.py`**

```python

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
```

- [ ] **Step 2: Verify import is clean**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -c "from app import supabase_client; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -q 2>&1 | tail -3
```

Expected: 38 passed.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/supabase_client.py && git commit -m "feat: supabase_client customer functions"
```

---

## Task 2: Customers router (TDD)

**Files:**
- Create: `backend/tests/test_customers.py`
- Create: `backend/app/routers/customers.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_customers.py`:

```python
# backend/tests/test_customers.py
from unittest.mock import AsyncMock, patch

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
RES_MGR = {"id": "user-abc", "company_id": "company-123", "role": "reservation_manager"}
CFO     = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_CUSTOMER = {
    "id": "cust-111",
    "company_id": "company-123",
    "full_name": "محمد علي",
    "id_type": "national_id",
    "id_number": "1234567890",
    "phone": "0501234567",
    "email": None,
    "birthdate": None,
    "lead_source": "direct",
    "notes": None,
}


def test_list_customers_no_search(client):
    with patch("app.routers.customers.supabase_client.get_customers", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_CUSTOMER]
        response = client.get("/customers")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with(None, "test-token")


def test_list_customers_with_search(client):
    with patch("app.routers.customers.supabase_client.get_customers", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_CUSTOMER]
        response = client.get("/customers", params={"search": "محمد"})
        assert response.status_code == 200
        mock.assert_called_once_with("محمد", "test-token")


def test_create_customer_as_owner(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.create_customer", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = OWNER
        mock_create.return_value = MOCK_CUSTOMER
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["full_name"] == "محمد علي"


def test_create_customer_as_reservation_manager(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.create_customer", new_callable=AsyncMock) as mock_create:
        mock_profile.return_value = RES_MGR
        mock_create.return_value = MOCK_CUSTOMER
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 201


def test_create_customer_rejects_cfo(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/customers", json={
            "full_name": "محمد علي",
            "id_type": "national_id",
            "id_number": "1234567890",
            "phone": "0501234567",
            "lead_source": "direct",
        })
        assert response.status_code == 403


def test_update_customer(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.update_customer", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/customers/cust-111", json={"phone": "0509999999"})
        assert response.status_code == 200
        mock_update.assert_called_once_with("cust-111", {"phone": "0509999999"}, "test-token")


def test_delete_customer_as_owner(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.customers.supabase_client.delete_customer", new_callable=AsyncMock) as mock_delete:
        mock_profile.return_value = OWNER
        mock_delete.return_value = None
        response = client.delete("/customers/cust-111")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("cust-111", "test-token")


def test_delete_customer_rejects_sales_manager(client):
    with patch("app.routers.customers.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = SALES
        response = client.delete("/customers/cust-111")
        assert response.status_code == 403
```

- [ ] **Step 2: Run — confirm all 8 fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_customers.py -v 2>&1 | tail -12
```

Expected: 8 × FAILED (404 — router not wired yet).

- [ ] **Step 3: Create the customers router**

Create `backend/app/routers/customers.py`:

```python
# backend/app/routers/customers.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/customers", tags=["customers"])

WRITERS = {"owner", "sales_manager", "reservation_manager"}


class CustomerCreate(BaseModel):
    full_name: str
    id_type: str
    id_number: str
    phone: str
    lead_source: str
    email: str | None = None
    birthdate: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    full_name: str | None = None
    id_type: str | None = None
    id_number: str | None = None
    phone: str | None = None
    lead_source: str | None = None
    email: str | None = None
    birthdate: str | None = None
    notes: str | None = None


@router.get("")
async def list_customers(search: str | None = None, user=Depends(get_current_user)):
    return await supabase_client.get_customers(search, user["token"])


@router.post("", status_code=201)
async def create_customer(body: CustomerCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="Only owners, sales managers, and reservation managers can create customers")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_customer(data, user["token"])


@router.patch("/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="Only owners, sales managers, and reservation managers can update customers")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="No fields to update")
    await supabase_client.update_customer(customer_id, data, user["token"])
    return {"ok": True}


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can delete customers")
    await supabase_client.delete_customer(customer_id, user["token"])
```

- [ ] **Step 4: Wire router into main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import onboarding, users, projects, buildings, units, customers

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
app.include_router(customers.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
```

- [ ] **Step 5: Run — confirm all 8 pass**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_customers.py -v 2>&1 | tail -12
```

Expected: 8 × PASSED.

- [ ] **Step 6: Run full suite**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -q 2>&1 | tail -3
```

Expected: 46 passed (38 existing + 8 new).

- [ ] **Step 7: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/customers.py backend/tests/test_customers.py backend/main.py && git commit -m "feat: customers router (TDD)"
```

---

## Task 3: Frontend — customers page + CustomerFormModal

**Files:**
- Create: `frontend/src/app/customers/page.tsx`
- Create: `frontend/src/app/customers/_components/CustomerFormModal.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /mnt/d/claude/propmanager/frontend/src/app/customers/_components
```

- [ ] **Step 2: Create CustomerFormModal.tsx**

Create `frontend/src/app/customers/_components/CustomerFormModal.tsx`:

```tsx
// frontend/src/app/customers/_components/CustomerFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Customer = {
  id: string
  full_name: string
  id_type: string
  id_number: string
  phone: string
  email: string | null
  birthdate: string | null
  lead_source: string
  notes: string | null
}

type Props = {
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

const ID_TYPE_LABELS: Record<string, string> = {
  national_id: 'هوية وطنية',
  iqama:       'إقامة',
  passport:    'جواز سفر',
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram:        'انستغرام',
  snapchat:         'سناب شات',
  tiktok:           'تيك توك',
  realtor_referral: 'وسيط عقاري',
  walk_in:          'زيارة مباشرة',
  direct:           'مباشر',
  other:            'أخرى',
}

export default function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    full_name:   customer?.full_name   ?? '',
    id_type:     customer?.id_type     ?? 'national_id',
    id_number:   customer?.id_number   ?? '',
    phone:       customer?.phone       ?? '',
    email:       customer?.email       ?? '',
    birthdate:   customer?.birthdate   ?? '',
    lead_source: customer?.lead_source ?? 'direct',
    notes:       customer?.notes       ?? '',
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
        full_name:   form.full_name,
        id_type:     form.id_type,
        id_number:   form.id_number,
        phone:       form.phone,
        lead_source: form.lead_source,
        email:       form.email     || null,
        birthdate:   form.birthdate || null,
        notes:       form.notes     || null,
      }
      if (customer) {
        await apiPatch(`/customers/${customer.id}`, payload)
      } else {
        await apiPost('/customers', payload)
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
        <h2 className="text-lg font-semibold mb-4">{customer ? 'تعديل العميل' : 'عميل جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">الاسم الكامل *</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div>
            <label className="label">نوع الهوية *</label>
            <select className="input" value={form.id_type} onChange={e => set('id_type', e.target.value)} required>
              {Object.entries(ID_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">رقم الهوية *</label>
            <input className="input" value={form.id_number} onChange={e => set('id_number', e.target.value)} required />
          </div>
          <div>
            <label className="label">رقم الجوال *</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="05xxxxxxxx" />
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">تاريخ الميلاد</label>
            <input className="input" type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} />
          </div>
          <div>
            <label className="label">مصدر العميل *</label>
            <select className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)} required>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">ملاحظات</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="col-span-2 flex gap-2 pt-1">
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

- [ ] **Step 3: Create page.tsx**

Create `frontend/src/app/customers/page.tsx`:

```tsx
// frontend/src/app/customers/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiDelete, apiGet } from '@/lib/api'
import CustomerFormModal from './_components/CustomerFormModal'

type Customer = {
  id: string
  full_name: string
  id_type: string
  id_number: string
  phone: string
  email: string | null
  birthdate: string | null
  lead_source: string
  notes: string | null
}

const ID_TYPE_LABELS: Record<string, string> = {
  national_id: 'هوية',
  iqama:       'إقامة',
  passport:    'جواز',
}

const ID_TYPE_COLORS: Record<string, string> = {
  national_id: 'bg-blue-100 text-blue-700',
  iqama:       'bg-purple-100 text-purple-700',
  passport:    'bg-stone-100 text-stone-700',
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram:        'انستغرام',
  snapchat:         'سناب شات',
  tiktok:           'تيك توك',
  realtor_referral: 'وسيط عقاري',
  walk_in:          'زيارة مباشرة',
  direct:           'مباشر',
  other:            'أخرى',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<{ open: boolean; customer?: Customer }>({ open: false })

  const loadCustomers = useCallback(async (searchTerm: string) => {
    setLoading(true)
    setError('')
    try {
      const url = searchTerm ? `/customers?search=${encodeURIComponent(searchTerm)}` : '/customers'
      const data = await apiGet<Customer[]>(url)
      setCustomers(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل العملاء')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { loadCustomers('') }, [loadCustomers])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadCustomers(search), 300)
    return () => clearTimeout(t)
  }, [search, loadCustomers])

  async function handleDelete(customerId: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return
    try {
      await apiDelete(`/customers/${customerId}`)
      setCustomers(prev => prev.filter(c => c.id !== customerId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف العميل')
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">العملاء</h1>
        <button onClick={() => setModal({ open: true })} className="btn-primary">
          + عميل جديد
        </button>
      </div>

      <div className="mb-4">
        <input
          className="input max-w-md"
          placeholder="بحث بالاسم أو رقم الهوية أو الجوال..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : customers.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">
            {search ? 'لا توجد نتائج' : 'لا يوجد عملاء — أضف عميلاً جديداً'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-right">
                <th className="pb-3 font-medium text-stone-600">الاسم</th>
                <th className="pb-3 font-medium text-stone-600">الهوية</th>
                <th className="pb-3 font-medium text-stone-600">رقم الهوية</th>
                <th className="pb-3 font-medium text-stone-600">الجوال</th>
                <th className="pb-3 font-medium text-stone-600">المصدر</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {customers.map(c => (
                <tr key={c.id}>
                  <td className="py-3 font-medium">{c.full_name}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ID_TYPE_COLORS[c.id_type] ?? 'bg-stone-100 text-stone-600'}`}>
                      {ID_TYPE_LABELS[c.id_type] ?? c.id_type}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs text-stone-500">{c.id_number}</td>
                  <td className="py-3">{c.phone}</td>
                  <td className="py-3 text-stone-500">{LEAD_SOURCE_LABELS[c.lead_source] ?? c.lead_source}</td>
                  <td className="py-3 text-left">
                    <button
                      onClick={() => setModal({ open: true, customer: c })}
                      className="text-stone-400 hover:text-stone-700 ml-2 text-xs"
                      title="تعديل"
                    >✎</button>
                    <button
                      onClick={() => handleDelete(c.id, c.full_name)}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="حذف"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <CustomerFormModal
          customer={modal.customer}
          onClose={() => setModal({ open: false })}
          onSaved={() => loadCustomers(search)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -E "customers|Customer" | head -10
```

Expected: no errors referencing the new files.

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/customers/ && git commit -m "feat: customers page + CustomerFormModal"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| GET /customers — all roles | Task 2 |
| GET /customers?search= — ilike on name, id_number, phone | Tasks 1 + 2 |
| POST /customers — owner, sales_manager, reservation_manager; company_id injected | Task 2 |
| PATCH /customers/{id} — same writers | Task 2 |
| DELETE /customers/{id} — owner only | Task 2 |
| Searchable table with debounce | Task 3 |
| Table columns: name, id_type badge, id_number, phone, lead_source | Task 3 |
| CustomerFormModal — all 8 fields, create + edit | Task 3 |
| Empty state + no-results state | Task 3 |
| id_type + lead_source Arabic labels | Task 3 |

All spec requirements covered. ✓

**Placeholder scan:** No TBDs, all code complete. ✓

**Type consistency:** `Customer` type used in both `page.tsx` and `CustomerFormModal.tsx` — identical shape. `loadCustomers(search)` called consistently everywhere. ✓
