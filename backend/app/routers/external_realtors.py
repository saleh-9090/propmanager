from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/external-realtors", tags=["external-realtors"])

WRITERS = {"owner", "sales_manager"}
DELETERS = {"owner"}


class RealtorCreate(BaseModel):
    name: str
    phone: str | None = None
    office_name: str | None = None
    rega_license_number: str | None = None
    notes: str | None = None


class RealtorUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    office_name: str | None = None
    rega_license_number: str | None = None
    notes: str | None = None


@router.get("")
async def list_realtors(user=Depends(get_current_user)):
    return await supabase_client.get_external_realtors(user["token"])


@router.post("", status_code=201)
async def create_realtor(body: RealtorCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إضافة وسيط خارجي")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_external_realtor(data, user["token"])


@router.patch("/{realtor_id}")
async def update_realtor(realtor_id: str, body: RealtorUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تعديل الوسيط")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="لا توجد حقول للتحديث")
    updated = await supabase_client.update_external_realtor(realtor_id, data, user["token"])
    if not updated:
        raise HTTPException(status_code=404, detail="الوسيط غير موجود")
    return updated


@router.delete("/{realtor_id}", status_code=204)
async def delete_realtor(realtor_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in DELETERS:
        raise HTTPException(status_code=403, detail="فقط المالك يستطيع حذف الوسطاء")
    await supabase_client.delete_external_realtor(realtor_id, user["token"])
