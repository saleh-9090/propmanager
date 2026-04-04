# Day 7: Sale Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sale flow at `/sales` supporting direct sales and reservation-to-sale conversion, with a separate deposit-return action on the reservations page.

**Architecture:** Backend adds a `sales` router and a `return-deposit` endpoint on the existing reservations router; supabase_client gets 4 new helpers and one modified function. Frontend is a new `/sales` page with a SaleForm, plus targeted modifications to the reservations page (status filter expansion, "تحويل" + "سداد العربون" buttons, ReturnDepositModal).

**Tech Stack:** FastAPI + httpx PostgREST client (backend), Next.js 14 App Router client components + Tailwind (frontend).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/supabase_client.py` | Modify | Add `get_sales`, `create_sale`, `update_reservation_status`, `record_deposit_return`; modify `get_reservations` filter |
| `backend/app/routers/sales.py` | Create | `GET /sales`, `POST /sales` |
| `backend/app/routers/reservations.py` | Modify | Add `POST /reservations/{id}/return-deposit` |
| `backend/tests/test_sales.py` | Create | Tests for sales router (6 tests) |
| `backend/tests/test_reservations.py` | Modify | Add 3 tests for return-deposit endpoint |
| `backend/main.py` | Modify | Register sales router |
| `frontend/src/app/(app)/sales/page.tsx` | Create | Sales list + form orchestration |
| `frontend/src/app/(app)/sales/_components/SaleForm.tsx` | Create | Create sale form (direct + conversion modes) |
| `frontend/src/app/(app)/reservations/page.tsx` | Modify | Add تحويل + سداد العربون buttons; update Reservation type; expand status badge |
| `frontend/src/app/(app)/reservations/_components/ReturnDepositModal.tsx` | Create | Deposit return form |

---

## Task 1: Supabase client helpers for sales

**Files:**
- Modify: `backend/app/supabase_client.py`

- [ ] **Step 1: Modify `get_reservations` to include converted reservations**

In `backend/app/supabase_client.py`, find the `get_reservations` function. Change the `"status": "eq.active"` param to `"status": "in.(active,converted)"` and update the docstring:

```python
async def get_reservations(token: str) -> list[dict]:
    """Reservations with status active or converted, ordered by expires_at asc.
    In this domain, 'expired' means expires_at < today but status is still 'active' —
    expiry is computed client-side. Cancelled reservations are excluded."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/reservations",
            params={
                "select": "*,units(unit_number,building_id,price),customers(full_name,id_number)",
                "status": "in.(active,converted)",
                "order": "expires_at.asc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()
```

- [ ] **Step 2: Append the sales helpers section**

Append to the end of `backend/app/supabase_client.py`:

```python
# ── Sales ─────────────────────────────────────────────────────────────────────

async def get_sales(token: str) -> list[dict]:
    """All completed sales ordered by created_at desc."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/sales",
            params={
                "select": "*,units(unit_number,building_id),customers(full_name,id_number)",
                "order": "created_at.desc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def create_sale(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/sales", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def update_reservation_status(reservation_id: str, status: str, token: str) -> None:
    """Update reservation status field only — used when converting to sale."""
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json={"status": status},
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def record_deposit_return(reservation_id: str, data: dict, token: str) -> None:
    """Record deposit return details on a converted reservation."""
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/supabase_client.py && git commit -m "feat: add sales helpers + expand reservation filter to include converted"
```

---

## Task 2: Sales router, return-deposit endpoint, tests, main.py

**Files:**
- Create: `backend/app/routers/sales.py`
- Create: `backend/tests/test_sales.py`
- Modify: `backend/app/routers/reservations.py`
- Modify: `backend/tests/test_reservations.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write test_sales.py first**

Create `backend/tests/test_sales.py`:

```python
# backend/tests/test_sales.py
from unittest.mock import AsyncMock, patch

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
RES_MGR = {"id": "user-abc", "company_id": "company-123", "role": "reservation_manager"}

MOCK_UNIT_AVAILABLE = {
    "id": "unit-111", "company_id": "company-123", "unit_number": "A101",
    "building_id": "bldg-1", "project_id": "proj-1", "status": "available",
    "floor": 1, "area_sqm": 120, "price": 500000, "sak_id": "SAK-001",
}
MOCK_UNIT_RESERVED = {**MOCK_UNIT_AVAILABLE, "status": "reserved"}

MOCK_RESERVATION_ACTIVE = {
    "id": "res-111", "company_id": "company-123", "unit_id": "unit-111",
    "customer_id": "cust-111", "status": "active", "deposit_amount": 10000,
    "payment_method": "bank_transfer", "payment_date": "2026-04-01",
    "expires_at": "2026-04-15", "deposit_returned": False,
}
MOCK_RESERVATION_CONVERTED = {**MOCK_RESERVATION_ACTIVE, "status": "converted"}

MOCK_SALE = {
    "id": "sale-111", "company_id": "company-123", "unit_id": "unit-111",
    "customer_id": "cust-111", "reservation_id": None, "status": "completed",
    "payment_amount": 500000, "payment_method": "bank_transfer",
    "payment_date": "2026-04-01",
    "units": {"unit_number": "A101", "building_id": "bldg-1"},
    "customers": {"full_name": "محمد علي", "id_number": "1234567890"},
}


def test_list_sales(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_sales", new_callable=AsyncMock) as mock:
        mock_profile.return_value = OWNER
        mock.return_value = [MOCK_SALE]
        response = client.get("/sales")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("test-token")


def test_list_sales_rejects_reservation_manager(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = RES_MGR
        response = client.get("/sales")
        assert response.status_code == 403


def test_create_direct_sale_as_owner(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit, \
         patch("app.routers.sales.supabase_client.create_sale", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.sales.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT_AVAILABLE
        mock_create.return_value = MOCK_SALE
        mock_unit_status.return_value = None
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "bank_transfer",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["status"] == "completed"
        mock_unit_status.assert_called_once_with("unit-111", "sold", "test-token")


def test_create_direct_sale_rejects_reservation_manager(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = RES_MGR
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 403


def test_create_direct_sale_unit_not_available(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT_RESERVED
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 409


def test_create_sale_conversion(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_reservation", new_callable=AsyncMock) as mock_res, \
         patch("app.routers.sales.supabase_client.create_sale", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.sales.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status, \
         patch("app.routers.sales.supabase_client.update_reservation_status", new_callable=AsyncMock) as mock_res_status:
        mock_profile.return_value = OWNER
        mock_res.return_value = MOCK_RESERVATION_ACTIVE
        mock_create.return_value = {**MOCK_SALE, "reservation_id": "res-111"}
        mock_unit_status.return_value = None
        mock_res_status.return_value = None
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "reservation_id": "res-111",
            "payment_amount": 500000,
            "payment_method": "bank_transfer",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 201
        mock_unit_status.assert_called_once_with("unit-111", "sold", "test-token")
        mock_res_status.assert_called_once_with("res-111", "converted", "test-token")


def test_create_sale_conversion_invalid_reservation(client):
    with patch("app.routers.sales.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.sales.supabase_client.get_reservation", new_callable=AsyncMock) as mock_res:
        mock_profile.return_value = OWNER
        mock_res.return_value = MOCK_RESERVATION_CONVERTED  # already converted
        response = client.post("/sales", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "reservation_id": "res-111",
            "payment_amount": 500000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
        })
        assert response.status_code == 409
```

- [ ] **Step 2: Add return-deposit tests to test_reservations.py**

Append to the end of `backend/tests/test_reservations.py` (after the last test). Note: `MOCK_RESERVATION` and `OWNER`, `RES_MGR` are already defined at the top of that file. Use `RES_MGR` from the existing fixtures.

```python
def test_return_deposit(client):
    converted_reservation = {
        "id": "res-111", "company_id": "company-123", "unit_id": "unit-111",
        "customer_id": "cust-111", "status": "converted", "deposit_returned": False,
        "deposit_amount": 10000, "payment_method": "bank_transfer",
        "payment_date": "2026-04-01", "expires_at": "2026-04-15",
        "receipt_file_url": None, "notes": None,
        "units": {"unit_number": "A101", "building_id": "bldg-1", "price": 500000},
        "customers": {"full_name": "محمد علي", "id_number": "1234567890"},
    }
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_reservation", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.reservations.supabase_client.record_deposit_return", new_callable=AsyncMock) as mock_return:
        mock_profile.return_value = OWNER
        mock_get.return_value = converted_reservation
        mock_return.return_value = None
        response = client.post("/reservations/res-111/return-deposit", json={
            "deposit_return_method": "bank_transfer",
            "deposit_return_date": "2026-04-05",
        })
        assert response.status_code == 200
        mock_return.assert_called_once_with("res-111", {
            "deposit_returned": True,
            "deposit_return_method": "bank_transfer",
            "deposit_return_date": "2026-04-05",
        }, "test-token")


def test_return_deposit_rejects_reservation_manager(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = RES_MGR
        response = client.post("/reservations/res-111/return-deposit", json={
            "deposit_return_method": "cash",
            "deposit_return_date": "2026-04-05",
        })
        assert response.status_code == 403


def test_return_deposit_not_converted(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_reservation", new_callable=AsyncMock) as mock_get:
        mock_profile.return_value = OWNER
        mock_get.return_value = MOCK_RESERVATION  # status is "active", not "converted"
        response = client.post("/reservations/res-111/return-deposit", json={
            "deposit_return_method": "cash",
            "deposit_return_date": "2026-04-05",
        })
        assert response.status_code == 404
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_sales.py tests/test_reservations.py -v 2>&1 | head -30
```

Expected: test_sales.py fails with ModuleNotFoundError (router doesn't exist); the 3 new return-deposit tests in test_reservations.py fail because the endpoint doesn't exist.

- [ ] **Step 4: Create the sales router**

Create `backend/app/routers/sales.py`:

```python
# backend/app/routers/sales.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/sales", tags=["sales"])

WRITERS = {"owner", "sales_manager"}
READERS = {"owner", "sales_manager", "cfo", "accountant"}


class SaleCreate(BaseModel):
    unit_id: str
    customer_id: str
    payment_amount: float
    payment_method: str
    payment_date: str
    reservation_id: str | None = None
    payment_reference: str | None = None
    notes: str | None = None


@router.get("")
async def list_sales(user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in READERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية عرض المبيعات")
    return await supabase_client.get_sales(user["token"])


@router.post("", status_code=201)
async def create_sale(body: SaleCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إنشاء بيعة")

    if body.reservation_id:
        # Conversion mode: verify reservation is active
        reservation = await supabase_client.get_reservation(body.reservation_id, user["token"])
        if not reservation or reservation["status"] != "active":
            raise HTTPException(status_code=409, detail="الحجز غير صالح للتحويل")
    else:
        # Direct sale mode: verify unit is available
        unit = await supabase_client.get_unit(body.unit_id, user["token"])
        if not unit or unit["status"] != "available":
            raise HTTPException(status_code=409, detail="الوحدة غير متاحة للبيع")

    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    data["status"] = "completed"

    sale = await supabase_client.create_sale(data, user["token"])
    await supabase_client.update_unit_status(body.unit_id, "sold", user["token"])

    if body.reservation_id:
        await supabase_client.update_reservation_status(body.reservation_id, "converted", user["token"])

    return sale
```

- [ ] **Step 5: Add return-deposit endpoint to the reservations router**

Add to the end of `backend/app/routers/reservations.py`:

```python
SALE_WRITERS = {"owner", "sales_manager"}


class ReturnDepositBody(BaseModel):
    deposit_return_method: str
    deposit_return_date: str
    deposit_return_reference: str | None = None


@router.post("/{reservation_id}/return-deposit")
async def return_deposit(reservation_id: str, body: ReturnDepositBody, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in SALE_WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تسجيل استرداد العربون")

    reservation = await supabase_client.get_reservation(reservation_id, user["token"])
    if not reservation or reservation["status"] != "converted":
        raise HTTPException(status_code=404, detail="الحجز غير موجود أو لم يتم تحويله")

    data = body.model_dump(exclude_none=True)
    data["deposit_returned"] = True
    await supabase_client.record_deposit_return(reservation_id, data, user["token"])
    return {"ok": True}
```

- [ ] **Step 6: Register sales router in main.py**

Edit `backend/main.py`. Change the import line to:

```python
from app.routers import onboarding, users, projects, buildings, units, customers, reservations, sales
```

Add after `app.include_router(reservations.router)`:

```python
app.include_router(sales.router)
```

- [ ] **Step 7: Run all new tests**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_sales.py tests/test_reservations.py -v 2>&1 | tail -20
```

Expected: All 8 tests in test_sales.py pass, all 11 tests in test_reservations.py pass (8 existing + 3 new).

- [ ] **Step 8: Run full suite**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -q
```

Expected: 67 passed (56 previous + 11 new: 8 sales + 3 return-deposit).

- [ ] **Step 9: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/sales.py backend/app/routers/reservations.py backend/tests/test_sales.py backend/tests/test_reservations.py backend/main.py && git commit -m "feat: sales router + return-deposit endpoint"
```

---

## Task 3: Frontend sales page and SaleForm

**Files:**
- Create: `frontend/src/app/(app)/sales/page.tsx`
- Create: `frontend/src/app/(app)/sales/_components/SaleForm.tsx`

- [ ] **Step 1: Create SaleForm**

Create `frontend/src/app/(app)/sales/_components/SaleForm.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  building_id: string
  price: number
  status: string
}

type Customer = {
  id: string
  full_name: string
  id_number: string
}

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

type Props = {
  reservation?: Reservation
  onClose: () => void
  onSaved: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

export default function SaleForm({ reservation, onClose, onSaved }: Props) {
  const isConversion = !!reservation

  const [units, setUnits] = useState<Unit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [unitId, setUnitId] = useState(reservation?.unit_id ?? '')
  const [customerId, setCustomerId] = useState(reservation?.customer_id ?? '')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConversion) {
      apiGet<Unit[]>('/units').then(setUnits).catch(() => {})
      apiGet<Customer[]>('/customers').then(setCustomers).catch(() => {})
    }
  }, [isConversion])

  useEffect(() => {
    if (!isConversion && customerSearch) {
      apiGet<Customer[]>(`/customers?search=${encodeURIComponent(customerSearch)}`)
        .then(setCustomers)
        .catch(() => {})
    }
  }, [customerSearch, isConversion])

  const filteredUnits = units.filter(
    u => u.status === 'available' &&
    u.unit_number.toLowerCase().includes(unitSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !customerId) {
      setError('الوحدة والعميل مطلوبان')
      return
    }
    if (paymentAmount <= 0) {
      setError('مبلغ البيع يجب أن يكون أكبر من صفر')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        unit_id: unitId,
        customer_id: customerId,
        payment_amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
      }
      if (reservation?.id) payload.reservation_id = reservation.id
      if (paymentReference) payload.payment_reference = paymentReference
      if (notes) payload.notes = notes
      await apiPost('/sales', payload)
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ البيعة')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          {isConversion ? 'تحويل حجز إلى بيعة' : 'بيعة جديدة'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Unit */}
          {isConversion ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation.units.unit_number} — {reservation.units.price.toLocaleString('ar-SA')} ر.س
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة *</label>
              <input
                className="input w-full mb-1"
                placeholder="بحث برقم الوحدة..."
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
              />
              <select
                className="input w-full"
                value={unitId}
                onChange={e => setUnitId(e.target.value)}
                required
              >
                <option value="">اختر وحدة...</option>
                {filteredUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number} — {u.price.toLocaleString('ar-SA')} ر.س
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer */}
          {isConversion ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation.customers.full_name} — {reservation.customers.id_number}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل *</label>
              <input
                className="input w-full mb-1"
                placeholder="بحث بالاسم أو الهوية..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              <select
                className="input w-full"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
              >
                <option value="">اختر عميل...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} — {c.id_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payment amount */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">مبلغ البيع (ر.س) *</label>
            <input
              type="number"
              className="input w-full"
              min={1}
              step={0.01}
              value={paymentAmount || ''}
              onChange={e => setPaymentAmount(Number(e.target.value))}
              required
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">طريقة الدفع *</label>
            <select
              className="input w-full"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              required
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Payment reference */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">رقم المرجع</label>
            <input
              className="input w-full"
              value={paymentReference}
              onChange={e => setPaymentReference(e.target.value)}
              placeholder="رقم التحويل أو الشيك..."
            />
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ البيع *</label>
            <input
              type="date"
              className="input w-full"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">ملاحظات</label>
            <textarea
              className="input w-full"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : isConversion ? 'تأكيد التحويل' : 'تسجيل البيعة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create sales/page.tsx**

Create `frontend/src/app/(app)/sales/page.tsx`:

```tsx
'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import SaleForm from './_components/SaleForm'

type Sale = {
  id: string
  unit_id: string
  customer_id: string
  reservation_id: string | null
  payment_amount: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
  status: string
  units: { unit_number: string; building_id: string }
  customers: { full_name: string; id_number: string }
}

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  status: string
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
}

function SalesContent() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservation_id') ?? undefined

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canWrite, setCanWrite] = useState(false)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
  }>({ open: false })

  const [prefillError, setPrefillError] = useState('')

  useEffect(() => {
    getUserProfile().then(profile => {
      const role = (profile as { role?: string } | null)?.role
      setCanWrite(['owner', 'sales_manager'].includes(role ?? ''))
    })
  }, [])

  const loadSales = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Sale[]>('/sales')
      setSales(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المبيعات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  // Auto-open form if URL has reservation_id
  useEffect(() => {
    if (!reservationId) return
    apiGet<Reservation[]>('/reservations')
      .then(reservations => {
        const r = reservations.find(r => r.id === reservationId)
        if (!r) {
          setPrefillError('الحجز غير موجود')
          return
        }
        if (r.status !== 'active') {
          setPrefillError('هذا الحجز لا يمكن تحويله')
          return
        }
        setForm({ open: true, reservation: r })
      })
      .catch(() => setPrefillError('تعذر تحميل بيانات الحجز'))
  }, [reservationId])

  function handleFormSaved() {
    setForm({ open: false })
    loadSales()
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">المبيعات</h1>
        {canWrite && (
          <button onClick={() => setForm({ open: true })} className="btn-primary">
            + بيعة جديدة
          </button>
        )}
      </div>

      {prefillError && (
        <p className="text-red-600 text-sm mb-4">{prefillError}</p>
      )}

      <div className="card">
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : sales.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">لا توجد مبيعات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-right">
                <th className="pb-3 font-medium text-stone-600">الوحدة</th>
                <th className="pb-3 font-medium text-stone-600">العميل</th>
                <th className="pb-3 font-medium text-stone-600">مبلغ البيع</th>
                <th className="pb-3 font-medium text-stone-600">طريقة الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ البيع</th>
                <th className="pb-3 font-medium text-stone-600">النوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sales.map(s => (
                <tr key={s.id}>
                  <td className="py-3 font-medium">{s.units.unit_number}</td>
                  <td className="py-3">{s.customers.full_name}</td>
                  <td className="py-3">{s.payment_amount.toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3">{PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method}</td>
                  <td className="py-3">{s.payment_date}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                      {s.reservation_id ? 'تحويل من حجز' : 'مباشر'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form.open && (
        <SaleForm
          reservation={form.reservation}
          onClose={() => setForm({ open: false })}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesContent />
    </Suspense>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -E "sales" | head -20
```

Expected: no output (no errors in new files). Fix any errors before committing.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/\(app\)/sales/ && git commit -m "feat: sales page and SaleForm"
```

---

## Task 4: Modify reservations page + ReturnDepositModal

**Files:**
- Create: `frontend/src/app/(app)/reservations/_components/ReturnDepositModal.tsx`
- Modify: `frontend/src/app/(app)/reservations/page.tsx`

- [ ] **Step 1: Create ReturnDepositModal**

Create `frontend/src/app/(app)/reservations/_components/ReturnDepositModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

type Props = {
  reservationId: string
  onClose: () => void
  onReturned: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

export default function ReturnDepositModal({ reservationId, onClose, onReturned }: Props) {
  const [returnMethod, setReturnMethod] = useState('bank_transfer')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))
  const [returnReference, setReturnReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, string> = {
        deposit_return_method: returnMethod,
        deposit_return_date: returnDate,
      }
      if (returnReference) payload.deposit_return_reference = returnReference
      await apiPost(`/reservations/${reservationId}/return-deposit`, payload)
      onReturned()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل استرداد العربون')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-4">تسجيل استرداد العربون</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">طريقة الاسترداد *</label>
            <select
              className="input w-full"
              value={returnMethod}
              onChange={e => setReturnMethod(e.target.value)}
              required
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ الاسترداد *</label>
            <input
              type="date"
              className="input w-full"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">رقم المرجع</label>
            <input
              className="input w-full"
              value={returnReference}
              onChange={e => setReturnReference(e.target.value)}
              placeholder="رقم التحويل أو الشيك..."
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">تراجع</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : 'تأكيد الاسترداد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite reservations/page.tsx**

Replace the full content of `frontend/src/app/(app)/reservations/page.tsx` with:

```tsx
'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import ReservationForm from './_components/ReservationForm'
import CancelModal from './_components/CancelModal'
import ReturnDepositModal from './_components/ReturnDepositModal'

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  status: 'active' | 'converted' | 'cancelled'
  deposit_amount: number
  deposit_returned: boolean
  payment_method: string
  payment_reference: string | null
  payment_date: string
  expires_at: string
  receipt_file_url: string | null
  notes: string | null
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date(new Date().toDateString())
}

function StatusBadge({ reservation }: { reservation: Reservation }) {
  if (reservation.status === 'converted') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
        محوّلة
      </span>
    )
  }
  const expired = isExpired(reservation.expires_at)
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`}>
      {expired ? 'منتهية' : 'نشطة'}
    </span>
  )
}

function ReservationsContent() {
  const searchParams = useSearchParams()
  const prefillUnitId = searchParams.get('unit_id') ?? undefined
  const prefillCustomerId = searchParams.get('customer_id') ?? undefined

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [canSale, setCanSale] = useState(false)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
    prefillUnitId?: string
    prefillCustomerId?: string
  }>({ open: false })

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [returnDepositTarget, setReturnDepositTarget] = useState<string | null>(null)

  useEffect(() => {
    getUserProfile().then(profile => {
      const role = (profile as { role?: string } | null)?.role
      setCanWrite(['owner', 'sales_manager', 'reservation_manager'].includes(role ?? ''))
      setCanSale(['owner', 'sales_manager'].includes(role ?? ''))
    })
  }, [])

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Reservation[]>('/reservations')
      setReservations(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الحجوزات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReservations()
  }, [loadReservations])

  useEffect(() => {
    if (prefillUnitId || prefillCustomerId) {
      setForm({ open: true, prefillUnitId, prefillCustomerId })
    }
  }, [prefillUnitId, prefillCustomerId])

  function handleFormSaved() {
    setForm({ open: false })
    loadReservations()
  }

  function handleCancelled() {
    setCancelTarget(null)
    loadReservations()
  }

  function handleDepositReturned() {
    setReturnDepositTarget(null)
    loadReservations()
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">الحجوزات</h1>
        {canWrite && (
          <button
            onClick={() => setForm({ open: true })}
            className="btn-primary"
          >
            + حجز جديد
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : reservations.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">لا توجد حجوزات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-right">
                <th className="pb-3 font-medium text-stone-600">الوحدة</th>
                <th className="pb-3 font-medium text-stone-600">العميل</th>
                <th className="pb-3 font-medium text-stone-600">مبلغ العربون</th>
                <th className="pb-3 font-medium text-stone-600">طريقة الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ الانتهاء</th>
                <th className="pb-3 font-medium text-stone-600">الحالة</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reservations.map(r => (
                <tr key={r.id}>
                  <td className="py-3 font-medium">{r.units.unit_number}</td>
                  <td className="py-3">{r.customers.full_name}</td>
                  <td className="py-3">{r.deposit_amount.toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                  <td className="py-3">{r.payment_date}</td>
                  <td className="py-3">{r.expires_at}</td>
                  <td className="py-3"><StatusBadge reservation={r} /></td>
                  <td className="py-3 text-left space-x-2 space-x-reverse">
                    {r.status === 'active' && canWrite && (
                      <>
                        <button
                          onClick={() => setForm({ open: true, reservation: r })}
                          className="text-stone-400 hover:text-stone-700 text-xs"
                          title="تعديل"
                        >✎</button>
                        <button
                          onClick={() => setCancelTarget(r.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="إلغاء"
                        >✕</button>
                      </>
                    )}
                    {r.status === 'active' && canSale && (
                      <Link
                        href={`/sales?reservation_id=${r.id}`}
                        className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                      >
                        تحويل
                      </Link>
                    )}
                    {r.status === 'converted' && canSale && !r.deposit_returned && (
                      <button
                        onClick={() => setReturnDepositTarget(r.id)}
                        className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                      >
                        سداد العربون
                      </button>
                    )}
                    {r.status === 'converted' && r.deposit_returned && (
                      <span className="text-green-600 text-xs">✓ عربون مُسترد</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form.open && (
        <ReservationForm
          reservation={form.reservation}
          prefillUnitId={form.prefillUnitId}
          prefillCustomerId={form.prefillCustomerId}
          onClose={() => setForm({ open: false })}
          onSaved={handleFormSaved}
        />
      )}

      {cancelTarget && (
        <CancelModal
          reservationId={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}

      {returnDepositTarget && (
        <ReturnDepositModal
          reservationId={returnDepositTarget}
          onClose={() => setReturnDepositTarget(null)}
          onReturned={handleDepositReturned}
        />
      )}
    </div>
  )
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={null}>
      <ReservationsContent />
    </Suspense>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | grep -E "(reservations|sales)" | head -20
```

Expected: no output. Fix any errors before committing.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/\(app\)/reservations/ && git commit -m "feat: add convert + deposit return actions to reservations page"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `get_reservations` filter: `active` + `converted` | Task 1 |
| `get_sales`, `create_sale`, `update_reservation_status`, `record_deposit_return` | Task 1 |
| `GET /sales` — readers only (403 for reservation_manager) | Task 2 |
| `POST /sales` — direct sale (unit available check, 409) | Task 2 |
| `POST /sales` — conversion (reservation active check, 409) | Task 2 |
| After conversion: unit→sold, reservation→converted | Task 2 |
| `POST /reservations/{id}/return-deposit` — WRITERS check, converted check | Task 2 |
| `/sales` page — list + "بيعة جديدة" button | Task 3 |
| `SaleForm` — direct mode (unit/customer pickers) | Task 3 |
| `SaleForm` — conversion mode (locked unit+customer from reservation) | Task 3 |
| Sales table columns: unit, customer, amount, method, date, type badge | Task 3 |
| `?reservation_id=` pre-fill: fetch reservation, check status=active, show error if not | Task 3 |
| "تحويل" Link on active reservation rows → `/sales?reservation_id=` | Task 4 |
| "سداد العربون" button on converted rows where `deposit_returned=false` | Task 4 |
| "✓ عربون مُسترد" text on converted rows where `deposit_returned=true` | Task 4 |
| `ReturnDepositModal` — method, date, reference fields | Task 4 |
| `محوّلة` badge for converted reservations | Task 4 |
| `canSale` state (owner, sales_manager only) gates تحويل + سداد العربون | Task 4 |
| ✎ and ✕ hidden on converted rows | Task 4 |

**Placeholder scan:** No TBD, no "add appropriate error handling", no forward references.

**Type consistency:**
- `Reservation` type in `page.tsx` includes `status`, `deposit_returned` — both used in the JSX. ✓
- `SaleForm` receives `reservation?: Reservation` where `Reservation` has `.units` and `.customers` nested objects — used in the locked display. ✓
- `update_reservation_status(reservation_id, status, token)` called in sales router as `update_reservation_status("res-111", "converted", "test-token")` — matches signature. ✓
- `record_deposit_return(reservation_id, data, token)` — data dict built in the router includes `deposit_returned: True` plus the body fields — matches the supabase_client function signature. ✓
