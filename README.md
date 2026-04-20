# PropManager

A multi-tenant B2B sales management platform for real estate developer companies. Manages unit inventory, reservations with deposit tracking, sales lifecycle, commission splits, and Arabic PDF contract generation -- all from a single Arabic-first dashboard with role-based access control enforced at the database level.

Built for Saudi developer companies managing 50-300 units across multiple buildings, replacing fragmented workflows (WhatsApp, Excel, paper) with a system where units are locked on reservation, deposits are tracked end-to-end, and commissions are auditable.

---

## Architecture

```
                    +-----------------+
                    |   Next.js 14    |
                    |  (Arabic RTL)   |
                    |   Tailwind CSS  |
                    +--------+--------+
                             |
                    +--------v--------+
                    |    FastAPI       |
                    |  (Python 3.11+) |
                    +--------+--------+
                             |
                     User JWT only
                     (never service role)
                             |
                    +--------v--------+
                    |    Supabase     |
                    |  (PostgreSQL)   |
                    |                 |
                    |  - RLS policies |
                    |  - RBAC via     |
                    |    company_id   |
                    +--------+--------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +--------v--------+
     | Supabase Storage |          |      n8n        |
     | (receipts, PDFs) |          | (background     |
     |                  |          |  jobs, Telegram) |
     +------------------+          +-----------------+
```

**Key architectural decision:** FastAPI passes the user's JWT directly to Supabase on every request. Row-Level Security policies enforce tenant isolation and role permissions at the database level -- not in application code. The service role key is never used at runtime, ensuring RLS cannot be bypassed even if the API layer is compromised.

---

## Security Model

| Layer | Mechanism | Detail |
|---|---|---|
| **Authentication** | Supabase Auth + JWT | ES256/HS256 token verification via JWKS endpoint, cached in memory |
| **Multi-tenancy** | `company_id` on every table | RLS policies use `auth_company_id()` -- users only see their own company's data |
| **Authorization** | 5-role RBAC | owner, cfo, sales_manager, reservation_manager, accountant -- enforced via `auth_role()` in RLS |
| **Data integrity** | DB-level constraints | SAK (deed number) globally unique at DB level -- prevents double-selling across tenants |
| **API security** | JWT-only Supabase access | Service role key never used in application code -- RLS is the last line of defense |
| **Route protection** | Next.js middleware | All authenticated routes validated server-side before render |
| **Telegram auth** | One-time verification code | chat_id verified against user profile; unknown IDs receive no data |

### RBAC Role Matrix

| Role | Inventory | Reservations | Sales | Financials | Commissions | Users | Audit Log |
|---|---|---|---|---|---|---|---|
| Owner | Full | Full | Full | Full | Finalize | Manage | Read |
| CFO | Read | Read | Read | Full | Read | -- | Read |
| Sales Manager | Read | Full | Full | -- | Input | -- | -- |
| Reservation Manager | Read | Full | -- | -- | -- | -- | -- |
| Accountant | Read | -- | Read | Read | -- | -- | -- |

---

## Features

### Inventory Management
- Project / Building / Unit hierarchy with full CRUD
- CSV bulk import for units (all-or-nothing validation)
- Unit availability board with cascading project/building filters and status badges
- Floor plans stored at building+floor level (shared across units on the same floor)

### Reservation Flow
- Deposit tracking with payment method, reference, receipt upload
- Configurable expiry dates with expiring/expired surfacing (no auto-cancel -- always a human decision)
- Cancellation with full or partial refund tracking (5 dedicated fields)
- Entry points from both unit and customer views

### Sales Lifecycle
- Direct sale (no deposit phase) and reservation-to-sale conversion
- Deposit return tracking on conversion
- Sale reversal (owner-only, reason required, unit returns to available)

### Commission Management
- Per-sale commission total set by owner or sales manager
- Internal staff and external realtor participants with percentage allocation
- Running-sum guard prevents allocations exceeding 100%
- Owner-only finalization lock -- once finalized, no edits permitted

### Customer Management
- Debounced search across name, ID number, and phone
- Lead source tracking (Instagram, Snapchat, TikTok, realtor referral, walk-in, direct)
- ID type support: National ID, Iqama, Passport

### Arabic PDF Generation
- Reservation receipt (arabic receipt) rendered on-demand with ReportLab
- Full Arabic text shaping pipeline: `arabic-reshaper` + `python-bidi` + Amiri font
- Amount-in-words conversion via `num2words` (Arabic locale)
- Authenticated blob download pattern (JWT passed via fetch, not URL)

### External Realtor Registry
- Separate entity for referral sources (not system users)
- REGA license number tracking for compliance
- Performance tracking across multiple deals

### Arabic RTL Support
- Built in from day one -- not retrofitted
- Tajawal font, RTL Tailwind configuration, `dir="rtl"` root layout
- All UI labels, form fields, and status badges in Arabic

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Python + FastAPI | FastAPI latest, Pydantic 2.x |
| Frontend | Next.js + React | Next.js 14.2, React 18 |
| Styling | Tailwind CSS | 3.4 |
| Database | PostgreSQL (Supabase) | Supabase managed |
| Auth | Supabase Auth | JWT (ES256 / HS256) |
| File Storage | Supabase Storage | Receipts, floor plans, PDFs |
| PDF Generation | ReportLab | + arabic-reshaper, python-bidi |
| Background Jobs | n8n | Webhook-based |
| HTTP Client | httpx | Async Supabase REST calls |
| Testing | pytest + pytest-asyncio | 67 tests |

---

## Data Model

```
companies
  +-- user_profiles (staff -- 5 RBAC roles)
  +-- projects
        +-- buildings
              +-- floor_plans (per building+floor)
              +-- units
                    +-- reservations
                    +-- sales
                          +-- sale_participants
customers
  +-- reservations
  +-- sales
external_realtors
  +-- sale_participants
audit_log
```

12 tables, all with `company_id` for tenant isolation. RLS policies on every table using `auth_company_id()` and `auth_role()` security-definer functions (zero recursion risk).

---

## API Endpoints

| Resource | Endpoints | Auth |
|---|---|---|
| Health | `GET /health` | Public |
| Onboarding | `POST /onboarding` | Authenticated |
| Users | `GET / POST / PATCH / DELETE /users` | Owner only |
| Projects | `GET / POST / PATCH / DELETE /projects` | Role-gated |
| Buildings | `POST / PATCH / DELETE /buildings` | Role-gated |
| Units | `GET / POST / PATCH / DELETE /units`, `POST /units/import` | Role-gated |
| Customers | `GET / POST / PATCH / DELETE /customers` | Role-gated |
| Reservations | `GET / POST / PATCH /reservations`, `POST /{id}/cancel`, `POST /{id}/return-deposit`, `GET /{id}/receipt.pdf` | Role-gated |
| Sales | `GET / POST /sales`, `GET /{id}`, `PATCH /{id}/commission-total`, `POST /{id}/finalize` | Role-gated |
| Sale Participants | `GET / POST / PATCH / DELETE /sales/{id}/participants` | Role-gated |
| External Realtors | `GET / POST / PATCH / DELETE /external-realtors` | Role-gated |

---

## Project Structure

```
propmanager/
+-- backend/
|   +-- main.py                  # FastAPI app, CORS, router registration
|   +-- app/
|   |   +-- auth.py              # JWT verification (ES256/HS256, JWKS cache)
|   |   +-- config.py            # pydantic-settings configuration
|   |   +-- supabase_client.py   # httpx-based Supabase REST client
|   |   +-- routers/             # 9 route modules
|   |   +-- pdf/                 # ReportLab templates + Amiri fonts
|   +-- tests/                   # 67 tests (pytest)
+-- frontend/
|   +-- src/
|   |   +-- app/
|   |   |   +-- auth/            # Login / signup
|   |   |   +-- onboarding/      # Company setup
|   |   |   +-- (app)/           # Authenticated routes
|   |   |   |   +-- dashboard/
|   |   |   |   +-- projects/    # Inventory management
|   |   |   |   +-- units/       # Availability board
|   |   |   |   +-- customers/
|   |   |   |   +-- reservations/
|   |   |   |   +-- sales/       # Sales + commission detail
|   |   |   |   +-- settings/    # User management
|   |   +-- lib/                 # Supabase client, API helpers
|   |   +-- middleware.ts        # Route protection
+-- docs/
|   +-- supabase-schema.sql      # Full schema with RLS policies
|   +-- cleanup.sql
```

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project (free tier works)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add Supabase URL + JWT secret
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # Add Supabase URL + anon key
npm run dev
```

### Database
Run `docs/cleanup.sql` then `docs/supabase-schema.sql` against your Supabase project via the SQL Editor.

### Tests
```bash
cd backend
pytest
```

---

## Screenshots

Screenshots coming soon.

---

## License

Proprietary. All rights reserved.
