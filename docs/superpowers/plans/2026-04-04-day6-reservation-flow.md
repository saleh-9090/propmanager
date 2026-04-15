# Day 6: Reservation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reservation flow at `/reservations` where staff can create reservations linking a unit to a customer with a deposit record, cancel them, and edit deposit details.

**Architecture:** Backend adds a `reservations` router with 4 endpoints; supabase_client gets reservation + unit-status helpers. Frontend is a single client page with an inline form component and a cancel modal — no routing changes needed beyond the new directory.

**Tech Stack:** FastAPI + httpx PostgREST client (backend), Next.js 14 App Router client components + Tailwind (frontend), Supabase Storage for receipt files.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/supabase_client.py` | Modify | Add 6 reservation/unit helpers |
| `backend/app/routers/reservations.py` | Create | GET, POST, PATCH, POST cancel endpoints |
| `backend/tests/test_reservations.py` | Create | Unit tests for all 4 endpoints |
| `backend/main.py` | Modify | Register reservations router |
| `frontend/src/app/(app)/reservations/page.tsx` | Create | List + form orchestration |
| `frontend/src/app/(app)/reservations/_components/ReservationForm.tsx` | Create | Create/edit form |
| `frontend/src/app/(app)/reservations/_components/CancelModal.tsx` | Create | Cancel confirm dialog |
| `frontend/src/app/(app)/units/page.tsx` | Modify | Add "احجز" button on available unit cards |
| `frontend/src/app/(app)/customers/page.tsx` | Modify | Add "احجز" button on customer rows |

---

## Task 1: Supabase client helpers for reservations

**Files:**
- Modify: `backend/app/supabase_client.py`

- [ ] **Step 1: Write the failing tests** (in test file, ahead of implementation)

Create `backend/tests/test_reservations.py` with just the imports and fixtures first:

```python
# backend/tests/test_reservations.py
from unittest.mock import AsyncMock, patch
import pytest

OWNER   = {"id": "user-abc", "company_id": "company-123", "role": "owner"}
SALES   = {"id": "user-abc", "company_id": "company-123", "role": "sales_manager"}
CFO     = {"id": "user-abc", "company_id": "company-123", "role": "cfo"}

MOCK_UNIT = {
    "id": "unit-111",
    "company_id": "company-123",
    "unit_number": "A101",
    "building_id": "bldg-1",
    "project_id": "proj-1",
    "floor": 1,
    "area_sqm": 120,
    "price": 500000,
    "status": "available",
    "sak_id": "SAK-001",
}

MOCK_RESERVATION = {
    "id": "res-111",
    "company_id": "company-123",
    "unit_id": "unit-111",
    "customer_id": "cust-111",
    "status": "active",
    "deposit_amount": 10000,
    "payment_method": "bank_transfer",
    "payment_reference": "REF123",
    "payment_date": "2026-04-01",
    "expires_at": "2026-04-15",
    "receipt_file_url": None,
    "notes": None,
    "units": {"unit_number": "A101", "building_id": "bldg-1", "price": 500000},
    "customers": {"full_name": "محمد علي", "id_number": "1234567890"},
}


def test_list_reservations(client):
    with patch("app.routers.reservations.supabase_client.get_reservations", new_callable=AsyncMock) as mock:
        mock.return_value = [MOCK_RESERVATION]
        response = client.get("/reservations")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock.assert_called_once_with("test-token")


def test_create_reservation_as_owner(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit, \
         patch("app.routers.reservations.supabase_client.create_reservation", new_callable=AsyncMock) as mock_create, \
         patch("app.routers.reservations.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_unit.return_value = MOCK_UNIT
        mock_create.return_value = MOCK_RESERVATION
        mock_unit_status.return_value = None
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "bank_transfer",
            "payment_reference": "REF123",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert call_data["company_id"] == "company-123"
        assert call_data["unit_id"] == "unit-111"
        mock_unit_status.assert_called_once_with("unit-111", "reserved", "test-token")


def test_create_reservation_rejects_cfo(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 403


def test_create_reservation_unit_not_available(client):
    reserved_unit = {**MOCK_UNIT, "status": "reserved"}
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_unit", new_callable=AsyncMock) as mock_unit:
        mock_profile.return_value = OWNER
        mock_unit.return_value = reserved_unit
        response = client.post("/reservations", json={
            "unit_id": "unit-111",
            "customer_id": "cust-111",
            "deposit_amount": 10000,
            "payment_method": "cash",
            "payment_date": "2026-04-01",
            "expires_at": "2026-04-15",
        })
        assert response.status_code == 409


def test_patch_reservation(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.update_reservation", new_callable=AsyncMock) as mock_update:
        mock_profile.return_value = OWNER
        mock_update.return_value = None
        response = client.patch("/reservations/res-111", json={"deposit_amount": 15000})
        assert response.status_code == 200
        mock_update.assert_called_once_with("res-111", {"deposit_amount": 15000}, "test-token")


def test_cancel_reservation(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile, \
         patch("app.routers.reservations.supabase_client.get_reservation", new_callable=AsyncMock) as mock_get, \
         patch("app.routers.reservations.supabase_client.cancel_reservation", new_callable=AsyncMock) as mock_cancel, \
         patch("app.routers.reservations.supabase_client.update_unit_status", new_callable=AsyncMock) as mock_unit_status:
        mock_profile.return_value = OWNER
        mock_get.return_value = MOCK_RESERVATION
        mock_cancel.return_value = None
        mock_unit_status.return_value = None
        response = client.post("/reservations/res-111/cancel", json={
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 10000,
        })
        assert response.status_code == 200
        mock_cancel.assert_called_once_with("res-111", {
            "status": "cancelled",
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 10000,
        }, "test-token")
        mock_unit_status.assert_called_once_with("unit-111", "available", "test-token")


def test_cancel_reservation_rejects_cfo(client):
    with patch("app.routers.reservations.supabase_client.get_user_profile", new_callable=AsyncMock) as mock_profile:
        mock_profile.return_value = CFO
        response = client.post("/reservations/res-111/cancel", json={
            "cancellation_reason": "العميل تراجع",
            "refund_amount": 0,
        })
        assert response.status_code == 403
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_reservations.py -v 2>&1 | head -30
```

Expected: ERRORS — `ModuleNotFoundError` or import error because `app.routers.reservations` doesn't exist yet.

- [ ] **Step 3: Add supabase_client helpers**

Append to `backend/app/supabase_client.py` after the `# ── Customers` section:

```python
# ── Reservations ──────────────────────────────────────────────────────────────

async def get_reservations(token: str) -> list[dict]:
    """Active reservations (both current and expired) ordered by expires_at asc."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/reservations",
            params={
                "select": "*,units(unit_number,building_id,price),customers(full_name,id_number)",
                "status": "eq.active",
                "order": "expires_at.asc",
            },
            headers=_user_headers(token),
        )
        r.raise_for_status()
        return r.json()


async def get_reservation(reservation_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}", "select": "*"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def create_reservation(data: dict, token: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_REST}/reservations", json=data, headers=_user_headers(token))
        r.raise_for_status()
        return r.json()[0]


async def delete_reservation(reservation_id: str, token: str) -> None:
    """Used for rollback only — if unit status update fails after reservation insert."""
    async with httpx.AsyncClient() as c:
        r = await c.delete(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def update_reservation(reservation_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def cancel_reservation(reservation_id: str, data: dict, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/reservations",
            params={"id": f"eq.{reservation_id}"},
            json=data,
            headers=_user_headers(token),
        )
        r.raise_for_status()


async def get_unit(unit_id: str, token: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}", "select": "*"},
            headers=_user_headers(token),
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def update_unit_status(unit_id: str, status: str, token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.patch(
            f"{_REST}/units",
            params={"id": f"eq.{unit_id}"},
            json={"status": status},
            headers=_user_headers(token),
        )
        r.raise_for_status()
```

- [ ] **Step 4: Commit supabase_client additions**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/supabase_client.py && git commit -m "feat: add reservation + unit-status helpers to supabase_client"
```

---

## Task 2: Reservations router, tests, and main.py registration

**Files:**
- Create: `backend/app/routers/reservations.py`
- Create: `backend/tests/test_reservations.py` (already written in Task 1)
- Modify: `backend/main.py`

- [ ] **Step 1: Create the router**

Create `backend/app/routers/reservations.py`:

```python
# backend/app/routers/reservations.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/reservations", tags=["reservations"])

WRITERS = {"owner", "sales_manager", "reservation_manager"}


class ReservationCreate(BaseModel):
    unit_id: str
    customer_id: str
    deposit_amount: float
    payment_method: str
    payment_date: str
    expires_at: str
    payment_reference: str | None = None
    notes: str | None = None


class ReservationUpdate(BaseModel):
    deposit_amount: float | None = None
    payment_method: str | None = None
    payment_reference: str | None = None
    payment_date: str | None = None
    expires_at: str | None = None
    receipt_file_url: str | None = None
    notes: str | None = None


class CancelBody(BaseModel):
    cancellation_reason: str
    refund_amount: float = 0


@router.get("")
async def list_reservations(user=Depends(get_current_user)):
    return await supabase_client.get_reservations(user["token"])


@router.post("", status_code=201)
async def create_reservation(body: ReservationCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إنشاء حجز")

    unit = await supabase_client.get_unit(body.unit_id, user["token"])
    if not unit or unit["status"] != "available":
        raise HTTPException(status_code=409, detail="الوحدة غير متاحة للحجز")

    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    data["status"] = "active"

    reservation = await supabase_client.create_reservation(data, user["token"])

    try:
        await supabase_client.update_unit_status(body.unit_id, "reserved", user["token"])
    except Exception:
        await supabase_client.delete_reservation(reservation["id"], user["token"])
        raise HTTPException(status_code=500, detail="تعذر تحديث حالة الوحدة — تم إلغاء الحجز")

    return reservation


@router.patch("/{reservation_id}")
async def update_reservation(reservation_id: str, body: ReservationUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تعديل الحجز")

    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await supabase_client.update_reservation(reservation_id, data, user["token"])
    return {"ok": True}


@router.post("/{reservation_id}/cancel")
async def cancel_reservation(reservation_id: str, body: CancelBody, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إلغاء الحجز")

    reservation = await supabase_client.get_reservation(reservation_id, user["token"])
    if not reservation or reservation["status"] != "active":
        raise HTTPException(status_code=404, detail="الحجز غير موجود أو غير نشط")

    await supabase_client.cancel_reservation(reservation_id, {
        "status": "cancelled",
        "cancellation_reason": body.cancellation_reason,
        "refund_amount": body.refund_amount,
    }, user["token"])

    await supabase_client.update_unit_status(reservation["unit_id"], "available", user["token"])

    return {"ok": True}
```

- [ ] **Step 2: Register router in main.py**

Edit `backend/main.py`:

```python
from app.routers import onboarding, users, projects, buildings, units, customers, reservations
```

And add after `app.include_router(customers.router)`:

```python
app.include_router(reservations.router)
```

- [ ] **Step 3: Run the tests**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest tests/test_reservations.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 4: Run the full test suite to ensure nothing regressed**

```bash
cd /mnt/d/claude/propmanager/backend && python3.12 -m pytest -v 2>&1 | tail -20
```

Expected: All tests pass (previously 48, now 55).

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add backend/app/routers/reservations.py backend/tests/test_reservations.py backend/main.py && git commit -m "feat: reservations router with create, list, patch, cancel"
```

---

## Task 3: Frontend — reservations page, form, and cancel modal

**Files:**
- Create: `frontend/src/app/(app)/reservations/page.tsx`
- Create: `frontend/src/app/(app)/reservations/_components/ReservationForm.tsx`
- Create: `frontend/src/app/(app)/reservations/_components/CancelModal.tsx`

- [ ] **Step 1: Create CancelModal**

Create `frontend/src/app/(app)/reservations/_components/CancelModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

type Props = {
  reservationId: string
  onClose: () => void
  onCancelled: () => void
}

export default function CancelModal({ reservationId, onClose, onCancelled }: Props) {
  const [reason, setReason] = useState('')
  const [refundAmount, setRefundAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setError('سبب الإلغاء مطلوب')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiPost(`/reservations/${reservationId}/cancel`, {
        cancellation_reason: reason,
        refund_amount: refundAmount,
      })
      onCancelled()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الحجز')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-4">إلغاء الحجز</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">سبب الإلغاء *</label>
            <textarea
              className="input w-full"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="أدخل سبب الإلغاء..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">مبلغ الاسترداد (ر.س)</label>
            <input
              type="number"
              className="input w-full"
              min={0}
              step={0.01}
              value={refundAmount}
              onChange={e => setRefundAmount(Number(e.target.value))}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              تراجع
            </button>
            <button type="submit" disabled={saving} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ReservationForm**

Create `frontend/src/app/(app)/reservations/_components/ReservationForm.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { supabase } from '@/lib/supabase'

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
  deposit_amount: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
  expires_at: string
  receipt_file_url: string | null
  notes: string | null
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

type Props = {
  reservation?: Reservation
  prefillUnitId?: string
  prefillCustomerId?: string
  onClose: () => void
  onSaved: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

function defaultExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

export default function ReservationForm({ reservation, prefillUnitId, prefillCustomerId, onClose, onSaved }: Props) {
  const isEdit = !!reservation

  const [units, setUnits] = useState<Unit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [unitId, setUnitId] = useState(reservation?.unit_id ?? prefillUnitId ?? '')
  const [customerId, setCustomerId] = useState(reservation?.customer_id ?? prefillCustomerId ?? '')
  const [depositAmount, setDepositAmount] = useState(reservation?.deposit_amount ?? 0)
  const [paymentMethod, setPaymentMethod] = useState(reservation?.payment_method ?? 'bank_transfer')
  const [paymentReference, setPaymentReference] = useState(reservation?.payment_reference ?? '')
  const [paymentDate, setPaymentDate] = useState(reservation?.payment_date ?? new Date().toISOString().slice(0, 10))
  const [expiresAt, setExpiresAt] = useState(reservation?.expires_at ?? defaultExpiry())
  const [notes, setNotes] = useState(reservation?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const unitLocked = !!prefillUnitId || isEdit
  const customerLocked = !!prefillCustomerId || isEdit

  useEffect(() => {
    if (!unitLocked) {
      apiGet<Unit[]>('/units').then(setUnits).catch(() => {})
    }
  }, [unitLocked])

  useEffect(() => {
    if (!customerLocked) {
      const url = customerSearch
        ? `/customers?search=${encodeURIComponent(customerSearch)}`
        : '/customers'
      apiGet<Customer[]>(url).then(setCustomers).catch(() => {})
    }
  }, [customerSearch, customerLocked])

  const filteredUnits = units.filter(u =>
    u.status === 'available' &&
    u.unit_number.toLowerCase().includes(unitSearch.toLowerCase())
  )

  async function handleReceiptUpload(file: File) {
    if (!reservation) return
    setUploading(true)
    setError('')
    try {
      const path = `${reservation.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      await apiPatch(`/reservations/${reservation.id}`, { receipt_file_url: data.publicUrl })
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الإيصال')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !customerId) {
      setError('الوحدة والعميل مطلوبان')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        deposit_amount: depositAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        expires_at: expiresAt,
      }
      if (paymentReference) payload.payment_reference = paymentReference
      if (notes) payload.notes = notes

      if (isEdit) {
        await apiPatch(`/reservations/${reservation.id}`, payload)
      } else {
        payload.unit_id = unitId
        payload.customer_id = customerId
        await apiPost('/reservations', payload)
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الحجز')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          {isEdit ? 'تعديل الحجز' : 'حجز جديد'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Unit */}
          {unitLocked ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation?.units.unit_number ?? prefillUnitId}
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
          {customerLocked ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation?.customers.full_name ?? prefillCustomerId}
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

          {/* Deposit amount */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">مبلغ العربون (ر.س) *</label>
            <input
              type="number"
              className="input w-full"
              min={0}
              step={0.01}
              value={depositAmount}
              onChange={e => setDepositAmount(Number(e.target.value))}
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
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ الدفع *</label>
            <input
              type="date"
              className="input w-full"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Expires at */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ انتهاء الحجز *</label>
            <input
              type="date"
              className="input w-full"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
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

          {/* Receipt upload — edit mode only */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الإيصال</label>
              {reservation.receipt_file_url ? (
                <div className="flex items-center gap-3">
                  <a
                    href={reservation.receipt_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 text-sm underline"
                  >
                    عرض الإيصال
                  </a>
                  <label className="text-sm text-stone-500 cursor-pointer hover:text-stone-700">
                    استبدال
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm text-stone-500 cursor-pointer hover:text-stone-700">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
                  />
                  {uploading ? 'جارٍ الرفع...' : 'رفع إيصال'}
                </label>
              )}
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء الحجز'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the reservations page**

Create `frontend/src/app/(app)/reservations/page.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import ReservationForm from './_components/ReservationForm'
import CancelModal from './_components/CancelModal'

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  deposit_amount: number
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

export default function ReservationsPage() {
  const searchParams = useSearchParams()
  const prefillUnitId = searchParams.get('unit_id') ?? undefined
  const prefillCustomerId = searchParams.get('customer_id') ?? undefined

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canWrite, setCanWrite] = useState(false)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
    prefillUnitId?: string
    prefillCustomerId?: string
  }>({ open: false })

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  useEffect(() => {
    getUserProfile().then(profile => {
      const role = (profile as { role?: string } | null)?.role
      setCanWrite(['owner', 'sales_manager', 'reservation_manager'].includes(role ?? ''))
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

  // Auto-open form if URL has pre-fill params
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
          <p className="text-stone-400 text-sm text-center py-12">لا توجد حجوزات نشطة</p>
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
              {reservations.map(r => {
                const expired = isExpired(r.expires_at)
                return (
                  <tr key={r.id}>
                    <td className="py-3 font-medium">{r.units.unit_number}</td>
                    <td className="py-3">{r.customers.full_name}</td>
                    <td className="py-3">{r.deposit_amount.toLocaleString('ar-SA')} ر.س</td>
                    <td className="py-3">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                    <td className="py-3">{r.payment_date}</td>
                    <td className="py-3">{r.expires_at}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        expired
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {expired ? 'منتهية' : 'نشطة'}
                      </span>
                    </td>
                    <td className="py-3 text-left">
                      {canWrite && (
                        <>
                          <button
                            onClick={() => setForm({ open: true, reservation: r })}
                            className="text-stone-400 hover:text-stone-700 ml-2 text-xs"
                            title="تعديل"
                          >✎</button>
                          <button
                            onClick={() => setCancelTarget(r.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="إلغاء"
                          >✕</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
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
    </div>
  )
}
```

- [ ] **Step 4: Verify the page directory structure**

```bash
ls /mnt/d/claude/propmanager/frontend/src/app/\(app\)/reservations/
```

Expected output:
```
_components/  page.tsx
```

```bash
ls /mnt/d/claude/propmanager/frontend/src/app/\(app\)/reservations/_components/
```

Expected output:
```
CancelModal.tsx  ReservationForm.tsx
```

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/\(app\)/reservations/ && git commit -m "feat: reservations page, form, and cancel modal"
```

---

## Task 4: Entry point buttons on units and customers pages

**Files:**
- Modify: `frontend/src/app/(app)/units/page.tsx`
- Modify: `frontend/src/app/(app)/customers/page.tsx`

- [ ] **Step 1: Add "احجز" button to unit cards in units/page.tsx**

In `frontend/src/app/(app)/units/page.tsx`, add `Link` to imports:

```tsx
import Link from 'next/link'
```

Then, inside the card map where `{filtered.map(u => (` renders each unit card, find the `<div className="mt-2 font-mono text-xs text-stone-400 truncate">{u.sak_id}</div>` line and add the button after it:

```tsx
{u.status === 'available' && (
  <Link
    href={`/reservations?unit_id=${u.id}`}
    className="mt-3 block text-center btn-primary text-xs py-1"
  >
    احجز
  </Link>
)}
```

The full card body after the edit:

```tsx
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
  {u.status === 'available' && (
    <Link
      href={`/reservations?unit_id=${u.id}`}
      className="mt-3 block text-center btn-primary text-xs py-1"
    >
      احجز
    </Link>
  )}
</div>
```

- [ ] **Step 2: Add "احجز" button to customer rows in customers/page.tsx**

In `frontend/src/app/(app)/customers/page.tsx`, add `Link` to imports:

```tsx
import Link from 'next/link'
```

In the customer table row, find the `<td className="py-3 text-left">` actions cell and add the "احجز" link before the edit button. The full actions cell after the edit:

```tsx
<td className="py-3 text-left">
  <Link
    href={`/reservations?customer_id=${c.id}`}
    className="btn-ghost text-xs ml-2"
  >
    احجز
  </Link>
  {canWrite && (
    <button
      onClick={() => setModal({ open: true, customer: c })}
      className="text-stone-400 hover:text-stone-700 ml-2 text-xs"
      title="تعديل"
    >✎</button>
  )}
  {isOwner && (
    <button
      onClick={() => handleDelete(c.id, c.full_name)}
      className="text-red-400 hover:text-red-600 text-xs"
      title="حذف"
    >×</button>
  )}
</td>
```

- [ ] **Step 3: Verify frontend builds without TypeScript errors**

```bash
cd /mnt/d/claude/propmanager/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No output (no errors). If there are errors, fix them before committing.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/claude/propmanager && git add frontend/src/app/\(app\)/units/page.tsx frontend/src/app/\(app\)/customers/page.tsx && git commit -m "feat: add reserve entry point buttons on units and customers pages"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| GET /reservations — active only, ordered by expires_at asc | Task 2 |
| POST /reservations — role check, unit available check, create, lock unit, rollback | Task 2 |
| PATCH /reservations/{id} — subset of fields, no unit/customer change | Task 2 |
| POST /reservations/{id}/cancel — role check, fetch, update, unlock unit | Task 2 |
| supabase_client helpers: get_reservations, create_reservation, update_reservation, cancel_reservation, get_reservation, delete_reservation, get_unit, update_unit_status | Task 1 |
| page.tsx — list + form orchestration, reads URL params, auto-opens form | Task 3 |
| ReservationForm — unit/customer pickers (locked when pre-filled), edit mode receipt upload | Task 3 |
| CancelModal — reason textarea + refund amount, POST cancel | Task 3 |
| Status badge: green (نشطة) / red (منتهية) based on expires_at | Task 3 |
| احجز button on available unit cards → /reservations?unit_id= | Task 4 |
| احجز button on customer rows → /reservations?customer_id= | Task 4 |

**Type consistency check:**
- `Reservation` type defined in `page.tsx` and imported shape used in `ReservationForm` — both include `units` and `customers` nested objects matching PostgREST response shape.
- `get_reservation` returns the plain reservation row (no joins) — cancel endpoint only needs `unit_id` from it, which is a top-level field. ✓
- `cancel_reservation` and `update_reservation` are separate functions with identical implementation but semantically different names — consistent with spec. ✓

**Placeholder scan:** No TBD, no "add appropriate error handling", no forward references to undefined types.
