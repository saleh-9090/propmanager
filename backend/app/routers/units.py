# backend/app/routers/units.py
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.auth import get_current_user
from app import supabase_client

router = APIRouter(prefix="/units", tags=["units"])

WRITERS = {"owner", "sales_manager"}
REQUIRED_CSV_COLS = {"building_number", "unit_number", "floor", "area_sqm", "price", "sak_id"}


class UnitCreate(BaseModel):
    building_id: str
    project_id: str
    unit_number: str
    floor: int
    area_sqm: float
    price: float
    sak_id: str
    electricity_meter_id: str | None = None
    water_meter_id: str | None = None


class UnitUpdate(BaseModel):
    unit_number: str | None = None
    floor: int | None = None
    area_sqm: float | None = None
    price: float | None = None
    sak_id: str | None = None
    electricity_meter_id: str | None = None
    water_meter_id: str | None = None


@router.get("")
async def list_units(building_id: str, user=Depends(get_current_user)):
    return await supabase_client.get_units(building_id, user["token"])


@router.post("", status_code=201)
async def create_unit(body: UnitCreate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="Only owners and sales managers can create units")
    data = body.model_dump(exclude_none=True)
    data["company_id"] = caller["company_id"]
    return await supabase_client.create_unit(data, user["token"])


# NOTE: /import must be defined BEFORE /{unit_id} to avoid path param collision
@router.post("/import")
async def import_units(
    project_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="Only owners and sales managers can import units")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = set(reader.fieldnames or [])
    missing_cols = REQUIRED_CSV_COLS - fieldnames
    if missing_cols:
        raise HTTPException(status_code=422, detail=f"Missing columns: {', '.join(sorted(missing_cols))}")

    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=422, detail="CSV file contains no data rows")

    buildings = await supabase_client.get_buildings_in_project(project_id, user["token"])
    building_map = {b["building_number"]: b["id"] for b in buildings}

    errors: list[dict] = []
    sak_ids_seen: set[str] = set()
    unit_rows: list[dict] = []

    for i, row in enumerate(rows, start=2):
        row_errors: list[dict] = []

        bn = (row.get("building_number") or "").strip()
        if bn not in building_map:
            row_errors.append({"row": i, "field": "building_number",
                                "message": f"Building '{bn}' not found in project"})
            building_id = None
        else:
            building_id = building_map[bn]

        try:
            floor = int((row.get("floor") or "").strip())
            if floor < 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "floor",
                                "message": "Must be a non-negative integer"})
            floor = None

        try:
            area = float((row.get("area_sqm") or "").strip())
            if area <= 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "area_sqm",
                                "message": "Must be a positive number"})
            area = None

        try:
            price = float((row.get("price") or "").strip())
            if price <= 0:
                raise ValueError
        except ValueError:
            row_errors.append({"row": i, "field": "price",
                                "message": "Must be a positive number"})
            price = None

        sak = (row.get("sak_id") or "").strip()
        if not sak:
            row_errors.append({"row": i, "field": "sak_id", "message": "Required"})
        elif sak in sak_ids_seen:
            row_errors.append({"row": i, "field": "sak_id",
                                "message": f"Duplicate SAK ID '{sak}' in file"})
        else:
            sak_ids_seen.add(sak)

        unit_number = (row.get("unit_number") or "").strip()
        if not unit_number:
            row_errors.append({"row": i, "field": "unit_number", "message": "Required"})

        errors.extend(row_errors)

        if not row_errors:
            unit_rows.append({
                "building_id": building_id,
                "project_id": project_id,
                "company_id": caller["company_id"],
                "sak_id": sak,
                "unit_number": unit_number,
                "floor": floor,
                "area_sqm": area,
                "price": price,
                "electricity_meter_id": (row.get("electricity_meter_id") or "").strip() or None,
                "water_meter_id": (row.get("water_meter_id") or "").strip() or None,
            })

    # Check SAK IDs against DB only if no prior errors (avoids noise)
    if not errors and sak_ids_seen:
        existing = await supabase_client.get_existing_sak_ids(list(sak_ids_seen))
        if existing:
            existing_set = set(existing)
            for i, row in enumerate(rows, start=2):
                sak = (row.get("sak_id") or "").strip()
                if sak in existing_set:
                    errors.append({"row": i, "field": "sak_id",
                                   "message": f"SAK ID '{sak}' already exists in system"})

    if errors:
        raise HTTPException(status_code=422, detail={"message": "Import failed", "errors": errors})

    await supabase_client.bulk_insert_units(unit_rows)
    return {"imported": len(unit_rows)}


@router.patch("/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdate, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] not in WRITERS:
        raise HTTPException(status_code=403, detail="Only owners and sales managers can update units")
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="No fields to update")
    await supabase_client.update_unit(unit_id, data, user["token"])
    return {"ok": True}


@router.delete("/{unit_id}", status_code=204)
async def delete_unit(unit_id: str, user=Depends(get_current_user)):
    caller = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if not caller or caller["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can delete units")
    await supabase_client.delete_unit(unit_id, user["token"])
