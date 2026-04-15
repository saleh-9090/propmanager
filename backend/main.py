from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import onboarding, users, projects, buildings, units, customers, reservations, sales, external_realtors

app = FastAPI(
    title="PropManager API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(buildings.router)
app.include_router(units.router)
app.include_router(customers.router)
app.include_router(reservations.router)
app.include_router(sales.router)
app.include_router(external_realtors.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}
