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
