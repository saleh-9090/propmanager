"""
JWT middleware — extracts and validates the Supabase user token from the
Authorization header. FastAPI routes use this as a dependency.

Supabase now issues ES256 JWTs (asymmetric). We verify using the public key
fetched from Supabase's JWKS endpoint and cached in memory.

The validated token is passed as-is to Supabase, so RLS policies run as
the authenticated user — never as the service role.
"""

import httpx
from fastapi import Header, HTTPException, status
from jose import JWTError, jwk, jwt
from app.config import settings

_jwks_cache: dict | None = None


async def _get_public_key(kid: str):
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")
            r.raise_for_status()
            _jwks_cache = r.json()
    key_data = next((k for k in _jwks_cache.get("keys", []) if k.get("kid") == kid), None)
    if not key_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")
    return jwk.construct(key_data)


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ")

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            public_key = await _get_public_key(header["kid"])
            payload = jwt.decode(token, public_key, algorithms=["ES256"], options={"verify_aud": False})
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return {"user_id": payload.get("sub"), "token": token}
