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
