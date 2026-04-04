# backend/app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/projects", tags=["projects"])

WRITERS = {"owner", "sales_manager"}


class ProjectCreate(BaseModel):
    name: str
    name_ar: str | None = None
    project_number: str
    city: str | None = None
    location_notes: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    name_ar: str | None = None
    project_number: str | None = None
    city: str | None = None
    location_notes: str | None = None


@router.get("")
async def list_projects(user=Depends(get_current_user)):
    return await supabase_client.get_projects_with_buildings(user["token"])


@router.post("", status_code=201)
async def create_project(body: ProjectCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can create projects")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_project(data, user["token"])


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(403, "Only owners and sales managers can update projects")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "No fields to update")
    await supabase_client.update_project(project_id, data, user["token"])
    return {"ok": True}


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(403, "Only owners can delete projects")
    await supabase_client.delete_project(project_id, user["token"])
