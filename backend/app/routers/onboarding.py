# backend/app/routers/onboarding.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.auth import get_current_user
from app import supabase_client

router = APIRouter(tags=["onboarding"])


class OnboardingRequest(BaseModel):
    company_name: str
    company_name_ar: str | None = None
    full_name: str
    phone: str | None = None
    rega_license: str | None = None


@router.post("/onboarding")
async def onboard(body: OnboardingRequest, user=Depends(get_current_user)):
    existing = await supabase_client.get_user_profile(user["user_id"], user["token"])
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already onboarded")

    company = await supabase_client.insert_company({
        "name": body.company_name,
        "name_ar": body.company_name_ar,
        "rega_license": body.rega_license,
    })
    if not company or "id" not in company:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create company")

    await supabase_client.insert_user_profile({
        "id": user["user_id"],
        "company_id": company["id"],
        "full_name": body.full_name,
        "phone": body.phone,
        "role": "owner",
    })

    return {"company_id": company["id"]}
