from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client
from app.pdf.receipt import generate_receipt_pdf

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


RECEIPT_READERS = {"owner", "sales_manager", "reservation_manager", "cfo"}


@router.get("/{reservation_id}/receipt.pdf")
async def reservation_receipt(reservation_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in RECEIPT_READERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تنزيل السند")

    reservation = await supabase_client.get_reservation(reservation_id, user["token"])
    if not reservation:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")

    token = user["token"]
    unit = await supabase_client.get_unit(reservation["unit_id"], token)
    customer = await supabase_client.get_customer(reservation["customer_id"], token)
    company = await supabase_client.get_company(reservation["company_id"], token)

    if not (unit and customer and company):
        raise HTTPException(status_code=404, detail="بيانات الحجز غير مكتملة")

    project = await supabase_client.get_project(unit["project_id"], token) if unit.get("project_id") else None
    building = await supabase_client.get_building(unit["building_id"], token) if unit.get("building_id") else None

    pdf_bytes = generate_receipt_pdf(
        reservation=reservation,
        unit=unit,
        customer=customer,
        company=company,
        project=project,
        building=building,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="receipt-{reservation_id[:8]}.pdf"',
        },
    )
