# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"owner", "cfo", "sales_manager", "reservation_manager", "accountant"}


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    phone: str | None = None


class RoleUpdate(BaseModel):
    role: str


@router.get("")
async def list_users(user=Depends(get_current_user)):
    return await supabase_client.get_company_profiles(user["token"])


@router.post("/invite", status_code=201)
async def invite_user(body: InviteRequest, user=Depends(get_current_user)):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can invite users")

    invited = await supabase_client.invite_auth_user(body.email)

    await supabase_client.insert_user_profile({
        "id": invited["id"],
        "company_id": caller["company_id"],
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
    })

    return {"user_id": invited["id"], "email": body.email}


@router.patch("/{user_id}/role")
async def update_role(user_id: str, body: RoleUpdate, user=Depends(get_current_user)):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can change roles")

    target = await supabase_client.get_user_profile_in_company(user_id, caller["company_id"])
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await supabase_client.update_user_role(user_id, body.role)
    return {"user_id": user_id, "role": body.role}


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can remove users")

    target = await supabase_client.get_user_profile_in_company(user_id, caller["company_id"])
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await supabase_client.delete_auth_user(user_id)
