"""
JWT middleware — extracts and validates the Supabase user token from the
Authorization header. FastAPI routes use this as a dependency.

The validated token is passed as-is to Supabase, so RLS policies run as
the authenticated user — never as the service role.
"""

from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
from app.config import settings


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return {"user_id": payload.get("sub"), "token": token}
