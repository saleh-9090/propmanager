# backend/app/routers/sales.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/sales", tags=["sales"])

WRITERS = {"owner", "sales_manager"}
READERS = {"owner", "sales_manager", "cfo", "accountant"}
COMMISSION_READERS = {"owner", "sales_manager", "cfo"}
COMMISSION_WRITERS = {"owner", "sales_manager"}
FINALIZERS = {"owner"}


class SaleCreate(BaseModel):
    unit_id: str
    customer_id: str
    payment_amount: float
    payment_method: str
    payment_date: str
    reservation_id: str | None = None
    payment_reference: str | None = None
    notes: str | None = None


class SaleCommissionUpdate(BaseModel):
    total_commission_amount: float = Field(ge=0)


class ParticipantCreate(BaseModel):
    type: str  # "internal" | "external"
    user_id: str | None = None
    external_realtor_id: str | None = None
    commission_percentage: float = Field(gt=0, le=100)
    notes: str | None = None


class ParticipantUpdate(BaseModel):
    commission_percentage: float = Field(gt=0, le=100)
    notes: str | None = None


@router.get("")
async def list_sales(user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in READERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية عرض المبيعات")
    return await supabase_client.get_sales(user["token"])


@router.get("/{sale_id}")
async def get_sale(sale_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in READERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية عرض المبيعات")
    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    return sale


@router.post("", status_code=201)
async def create_sale(body: SaleCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إنشاء بيعة")

    if body.reservation_id:
        reservation = await supabase_client.get_reservation(body.reservation_id, user["token"])
        if not reservation or reservation["status"] != "active":
            raise HTTPException(status_code=409, detail="الحجز غير صالح للتحويل")
        if reservation["unit_id"] != body.unit_id:
            raise HTTPException(status_code=422, detail="unit_id لا يطابق الحجز")
    else:
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


# ── Commission ────────────────────────────────────────────────────────────────

def _ensure_unlocked(sale: dict):
    if sale.get("commission_finalized"):
        raise HTTPException(status_code=409, detail="تم اعتماد العمولة ولا يمكن التعديل")


@router.patch("/{sale_id}/commission-total")
async def set_commission_total(sale_id: str, body: SaleCommissionUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in COMMISSION_WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تعديل العمولة")

    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    _ensure_unlocked(sale)

    return await supabase_client.update_sale(
        sale_id, {"total_commission_amount": body.total_commission_amount}, user["token"]
    )


@router.get("/{sale_id}/participants")
async def list_participants(sale_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in COMMISSION_READERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية عرض المشاركين")
    return await supabase_client.get_sale_participants(sale_id, user["token"])


@router.post("/{sale_id}/participants", status_code=201)
async def add_participant(sale_id: str, body: ParticipantCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in COMMISSION_WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إضافة مشارك")

    if body.type not in ("internal", "external"):
        raise HTTPException(status_code=422, detail="نوع المشارك غير صحيح")
    if body.type == "internal" and not body.user_id:
        raise HTTPException(status_code=422, detail="user_id مطلوب للمشارك الداخلي")
    if body.type == "external" and not body.external_realtor_id:
        raise HTTPException(status_code=422, detail="external_realtor_id مطلوب للمشارك الخارجي")
    if body.type == "internal" and body.external_realtor_id:
        raise HTTPException(status_code=422, detail="لا يمكن تحديد نوعين")
    if body.type == "external" and body.user_id:
        raise HTTPException(status_code=422, detail="لا يمكن تحديد نوعين")

    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    _ensure_unlocked(sale)

    # Check total % doesn't exceed 100
    existing = await supabase_client.get_sale_participants(sale_id, user["token"])
    total = sum(float(p["commission_percentage"]) for p in existing)
    if total + body.commission_percentage > 100:
        raise HTTPException(
            status_code=422,
            detail=f"مجموع النسب سيتجاوز 100٪ (الحالي {total}٪ + المضاف {body.commission_percentage}٪)",
        )

    data = {
        "sale_id": sale_id,
        "company_id": caller["company_id"],
        "type": body.type,
        "user_id": body.user_id,
        "external_realtor_id": body.external_realtor_id,
        "commission_percentage": body.commission_percentage,
        "notes": body.notes,
    }
    return await supabase_client.create_sale_participant(
        {k: v for k, v in data.items() if v is not None}, user["token"]
    )


@router.patch("/{sale_id}/participants/{participant_id}")
async def update_participant(
    sale_id: str,
    participant_id: str,
    body: ParticipantUpdate,
    user=Depends(get_current_user),
):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in COMMISSION_WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تعديل مشارك")

    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    _ensure_unlocked(sale)

    existing = await supabase_client.get_sale_participants(sale_id, user["token"])
    total = sum(
        float(p["commission_percentage"]) for p in existing if p["id"] != participant_id
    )
    if total + body.commission_percentage > 100:
        raise HTTPException(
            status_code=422,
            detail=f"مجموع النسب سيتجاوز 100٪ (الآخرون {total}٪ + الجديد {body.commission_percentage}٪)",
        )

    data = body.model_dump(exclude_none=True)
    updated = await supabase_client.update_sale_participant(participant_id, data, user["token"])
    if not updated:
        raise HTTPException(status_code=404, detail="المشارك غير موجود")
    return updated


@router.delete("/{sale_id}/participants/{participant_id}", status_code=204)
async def remove_participant(
    sale_id: str, participant_id: str, user=Depends(get_current_user)
):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in COMMISSION_WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية حذف مشارك")

    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    _ensure_unlocked(sale)

    await supabase_client.delete_sale_participant(participant_id, user["token"])


@router.post("/{sale_id}/finalize")
async def finalize_commission(sale_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in FINALIZERS:
        raise HTTPException(status_code=403, detail="فقط المالك يستطيع اعتماد العمولة")

    sale = await supabase_client.get_sale(sale_id, user["token"])
    if not sale:
        raise HTTPException(status_code=404, detail="البيعة غير موجودة")
    if sale.get("commission_finalized"):
        raise HTTPException(status_code=409, detail="تم اعتماد العمولة بالفعل")

    if not sale.get("total_commission_amount") or float(sale["total_commission_amount"]) <= 0:
        raise HTTPException(status_code=422, detail="يجب تحديد إجمالي العمولة قبل الاعتماد")

    participants = await supabase_client.get_sale_participants(sale_id, user["token"])
    if not participants:
        raise HTTPException(status_code=422, detail="لا يوجد مشاركون في البيعة")

    total_pct = sum(float(p["commission_percentage"]) for p in participants)
    if abs(total_pct - 100) > 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"مجموع النسب يجب أن يكون 100٪ (الحالي {total_pct}٪)",
        )

    return await supabase_client.update_sale(
        sale_id,
        {
            "commission_finalized": True,
            "commission_finalized_by": user["user_id"],
            "commission_finalized_at": datetime.now(timezone.utc).isoformat(),
        },
        user["token"],
    )
