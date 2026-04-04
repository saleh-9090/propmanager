# backend/app/routers/buildings.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/buildings", tags=["buildings"])

WRITERS = {"owner", "sales_manager"}


class BuildingCreate(BaseModel):
    project_id: str
    building_number: str
    name: str | None = None
    total_floors: int | None = None


class BuildingUpdate(BaseModel):
    building_number: str | None = None
    name: str | None = None
    total_floors: int | None = None


@router.post("", status_code=201)
async def create_building(body: BuildingCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and sales managers can create buildings")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_building(data, user["token"])


@router.patch("/{building_id}")
async def update_building(building_id: str, body: BuildingUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and sales managers can update buildings")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")
    await supabase_client.update_building(building_id, data, user["token"])
    return {"ok": True}


@router.delete("/{building_id}", status_code=204)
async def delete_building(building_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can delete buildings")
    await supabase_client.delete_building(building_id, user["token"])
