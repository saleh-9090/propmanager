# Project Brief — PropManager (Developer Sales OS)

> Read this file at the start of every session to get full context on what we're building.
> Also read D:/claude/WORKSPACE.md for machine setup, account details, and cross-project context.

---

## ⚠️ Security Reminders

- Rotate Supabase secret key before go-live
- Never commit `.env` files
- Use `load_dotenv(override=True)` in all backends — Windows stale env vars
- SAK ID is globally unique — enforce at DB level, never just application level
- FastAPI uses **user JWT only** — never service role (would bypass RLS)

---

## What We're Building

A B2B sales management platform for Saudi real estate **developer companies** — companies that build projects (towers, compounds, villas) and sell ready units to buyers. Office staff manage unit inventory, reservations, sales, customers, and commissions from one Arabic-first dashboard. The owner gets a Telegram bot for on-the-go access.

**Working name:** PropManager (Arabic name TBD)

---

## The Problem

Saudi real estate developer companies with 50–300 units across multiple buildings manage everything through WhatsApp groups, Excel sheets, and paper files. Core pain points:
- Double-bookings: two salespeople reserve the same unit simultaneously
- No live availability view — "is unit B3-405 available?" requires a phone call
- Reservation deposits tracked in notebooks — returns go unrecorded, disputes follow
- Commission splits decided verbally, forgotten, argued over
- Contracts filled manually in Word — slow, inconsistent, typo-prone
- Owner has no real-time view without being in the office

---

## The Solution

One dashboard for the whole office. Units are locked the moment a reservation is made. Reservations expire automatically if not converted. Deposits are tracked from collection to return. Sales generate PDF contracts from fixed templates. The owner gets a Telegram bot that answers questions in plain Arabic.

---

## Scope (Locked)

**In scope:**
- Ready units only (completed buildings)
- Full payment or reservation deposit only — no installments
- Office-based users only (no field agent mobile access in v1)
- Saudi developer companies (build and sell)

**Out of scope (decided — do not revisit):**
- Rental management
- Off-plan / Wafi sales
- Installment payment plans
- Marketing copy generation (proptech is a separate product)
- ZATCA / VAT e-invoicing
- AI contract generation
- Portal integrations (Aqar, Property Finder, Bayut)
- Full accounting / double-entry bookkeeping
- Field sales agent mobile app

---

## Target User

**Primary:** Owner / CEO of a Saudi real estate developer company (50–300 units under management)
**Office staff:** Sales Manager, Reservation Manager, CFO, Accountant

Not targeting solo agents, rental companies, or property management agencies.

---

## Business Model

| Plan | Price | Units | Users |
|---|---|---|---|
| Starter | 299 SAR/mo | Up to 50 | 3 users |
| Growth | 599 SAR/mo | Up to 150 | 8 users |
| Enterprise | 1,200 SAR/mo | Unlimited | Unlimited |

> Pricing TBD — validate with target companies in Phase 0.

SaaS subscription billed via **Moyasar** (mada / Visa / AMEX).

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Python + FastAPI | Same as proptech |
| Frontend | Next.js + Tailwind (Arabic RTL) | Borrowed from proptech |
| Database + Auth | Supabase (PostgreSQL + RLS) | Multi-tenant via `company_id` |
| File Storage | Supabase Storage | Receipts, floor plans, PDF contracts |
| Background Jobs | n8n | Already running on Unraid server |
| Telegram Bot | n8n Telegram trigger | Owner-facing, authenticated via chat_id |
| PDF Generation | Template-based (ReportLab or similar) | Fixed templates, data filled in |
| Payments (SaaS) | Moyasar | mada support — Saudi-native |
| Hosting (dev) | Unraid home server | Testing only |
| Hosting (prod) | AWS Riyadh (me-central-1) or Azure Jeddah | Saudi PDPL / NCA compliance required before taking money from Saudi companies |

**Auth pattern:** FastAPI passes user JWT to Supabase → RLS enforces permissions at DB level. Service role is never used.

---

## Roles & Permissions (RBAC via Supabase RLS)

| Role | Access |
|---|---|
| **Owner / CEO** | Full access — all data, all projects, commission finalization, user management, Telegram bot |
| **CFO** | Full financial data — revenue, payments, commission summaries, reports. Read-only on unit/reservation/sale records. |
| **Sales Manager** | All projects — manage reservations, sales, customers, commission input. Cannot finalize commissions. |
| **Reservation Manager** | Create and manage reservations, customer intake, unit availability. Cannot see payment amounts or commission. |
| **Accountant** | Read-only — payment records, financial reports. No editing. |

Every table has `company_id`. Users only see data belonging to their company. RLS policies enforce this at DB level — not just in application code.

---

## Data Model

### Entity hierarchy
```
companies
  └── users (staff — one of 5 roles above)
  └── projects (project number)
        └── buildings (building number)
              └── floor_plans (PDF — stored at building + floor level, shared by all units on that floor)
              └── units
                    └── reservations
                    └── sales
customers
  └── reservations (customer reserved a unit)
  └── sales (customer bought a unit)
external_realtors (referral sources — not system users)
sale_participants (who was involved + commission %)
audit_log
```

### Unit fields
| Field | Notes |
|---|---|
| `sak_id` | صك — globally unique at DB level (nationally unique deed number) |
| `unit_number` | |
| `floor` | |
| `area_sqm` | |
| `price` | SAR |
| `electricity_meter_id` | |
| `water_meter_id` | |
| `status` | `available` / `reserved` / `sold` |
| `project_id`, `building_id` | FK |

Floor plans stored on `floor_plans` table (building_id + floor) — not per-unit. All units on the same floor share one floor plan file.

### Customer fields
| Field | Notes |
|---|---|
| `id_number` | National ID / Iqama / Passport — required for PDF contracts |
| `id_type` | `national_id` / `iqama` / `passport` |
| `phone` | |
| `birthdate` | |
| `email` | |
| `lead_source` | `instagram` / `snapchat` / `tiktok` / `realtor_referral` / `walk_in` / `direct` |

### Unit lifecycle
```
Available
  → Reserved       (Reservation record created, deposit paid)
      → Sold        (Sale record created, full payment received, deposit returned to buyer)
      → Available   (Reservation cancelled, deposit refunded)
Available
  → Sold directly  (Sale record created with no prior Reservation — full payment, no deposit phase)
Sold
  → reversed       (Owner-only escape hatch — Sale.status = 'reversed', unit returns to Available, reason logged)
```

### Reservation record
| Field | Notes |
|---|---|
| `unit_id`, `customer_id` | FK |
| `deposit_amount` | SAR |
| `payment_method` | `cash` / `bank_transfer` / `check` |
| `payment_reference` | Check number, transfer ref, etc. |
| `payment_date` | |
| `received_by` | user_id of staff who collected |
| `receipt_file` | Supabase Storage URL (image or PDF of receipt) |
| `status` | `active` / `converted` / `cancelled` |
| `expires_at` | Default set at company or project level (e.g. 14 days) — system surfaces expiring/expired, no auto-cancel |
| `deposit_returned` | boolean |
| `deposit_return_date` | |
| `deposit_return_method` | `cash` / `bank_transfer` / `check` |
| `deposit_return_reference` | |
| `deposit_returned_by` | user_id |
| `refund_amount` | For partial refunds on cancellation |

### Sale record
| Field | Notes |
|---|---|
| `unit_id`, `customer_id` | FK — direct link, not inherited through Reservation |
| `reservation_id` | FK — nullable (null for direct sales with no deposit phase) |
| `payment_amount` | SAR — full payment |
| `payment_method` | `cash` / `bank_transfer` / `check` |
| `payment_reference` | |
| `payment_date` | |
| `received_by` | user_id |
| `receipt_file` | Supabase Storage URL |
| `total_commission_amount` | SAR — set manually by Owner or Sales Manager. Participants' percentages calculate against this. |
| `commission_finalized` | boolean — toggled by Owner only. Locks commission amounts. |
| `status` | `completed` / `reversed` |
| `reversal_reason` | Text — required when status set to reversed |

### Sale participants
| Field | Notes |
|---|---|
| `sale_id` | FK |
| `type` | `internal` / `external` |
| `user_id` | FK — nullable (internal staff) |
| `external_realtor_id` | FK — nullable (external referral) |
| `commission_percentage` | Must sum to 100% across all participants on a sale |
| `commission_amount_sar` | Calculated: `total_commission_amount × (percentage / 100)` — display only |

### External realtor
| Field | Notes |
|---|---|
| `name` | |
| `phone` | |
| `office_name` | Brokerage office (مكتب عقاري) — commission payments often go to the office |
| `rega_license_number` | Optional — for compliance records |

### Audit log
Logs: reservation created/cancelled/converted, sale created/reversed, commission finalized, payment recorded, unit status change, user role change.

```
(id, timestamp, user_id, action, entity_type, entity_id, old_value JSONB, new_value JSONB, company_id)
```

Viewable by Owner and CFO only.

---

## PDF Generation

Two fixed-template documents — company layout and legal clauses are pre-written. System fills in data fields.

| Document | Triggered when | Required fields |
|---|---|---|
| Reservation Agreement (عقد حجز) | Reservation created | Customer ID, unit details, deposit amount, date |
| After-Sale Agreement | Sale completed | Customer ID, unit details, full payment amount, date |

**Validation:** Before generating, system checks all required fields are populated and shows a clear error if anything is missing. Partial PDFs are never generated.

---

## Telegram Bot (Owner / CEO only)

- Owner queries via plain Arabic or set commands (e.g. `/report`, `/available`, `كم وحدة متبقية في مشروع النرجس؟`)
- Connected via n8n webhook (n8n running on Unraid server)
- **Authentication:** One-time verification code generated from web app → stored against `telegram_chat_id` on user profile. Unknown `chat_id`s get a generic rejection — no data exposed.
- **Heartbeat:** n8n pings uptime monitor after each daily summary. If summary not sent by expected time, backup alert fires (email or SMS).

**Auto daily summary includes:**
- Units sold today / this week
- Revenue today / this week
- Active reservations count
- Reservations expiring in ≤ 3 days ⚠️
- Expired reservations pending action
- Deposit returns pending

---

## Reporting (in-app + Telegram)

- Sales velocity per project (units sold per week/month)
- Revenue per project
- Unit availability breakdown (available / reserved / sold counts)
- Pipeline value (total SAR in active reservations)
- Lead source breakdown (which channel brings most buyers)
- Commission summary per participant (across all their deals)
- Expiring reservations report

---

## Key Decisions Made

| Decision | Rationale |
|---|---|
| Ready units only — no off-plan | Avoids Wafi/REGA escrow compliance complexity for v1 |
| No installments — deposit or full payment only | Eliminates installment tracking complexity. Primary objection for prospects who do installments — known gap. |
| No marketing copy generation | proptech is a separate product. PropManager stays focused. |
| No field agent access in v1 | All users are office-based. Simplifies RLS, no mobile-first pressure. |
| Two separate records (Reservation + Sale) | Deposit is a refundable hold, not a down payment. Cleaner to track independently. |
| Sale has direct customer_id FK | Handles direct sales (no deposit phase) cleanly. Reservation FK is nullable. |
| Floor plans at building+floor level | Same floor plan PDF serves all units on a floor — avoids 40x duplicate uploads. |
| SAK ID globally unique at DB level | Duplicate SAK = double-selling a unit = legal disaster. Enforced in DB, not just app. |
| FastAPI uses user JWT — not service role | RLS is the last line of defense. Service role bypasses it entirely. |
| commission_finalized boolean on Sale | Owner explicitly locks commission after review. Not automatic. |
| Deposit return tracked with 5 fields | The #1 source of disputes in sales offices. Must be airtight. |
| Reservation expires_at — no auto-cancel | System surfaces expiring/expired prominently. Cancellation is always a manual human decision. |
| External realtor as separate entity | Same realtor appears in multiple deals — avoid duplicate data, enable performance tracking. |
| Telegram auth via chat_id + one-time code | Bots have no built-in auth. Company financials must not be exposed to unknown chat_ids. |
| Hosting: Unraid for dev, Saudi cloud for prod | Saudi PDPL + NCA require in-Kingdom data storage before taking money from Saudi companies. |
| n8n for background jobs and Telegram | Already running on server. No new infrastructure needed. |
| Arabic RTL built-in from day one | Cannot be added later without full refactor. |
| Moyasar for SaaS billing | mada support — dominant Saudi payment method. Stripe doesn't support it. |

---

## Known Gaps & Future Phases

| Gap | Impact | When to address |
|---|---|---|
| No installment support | Limits addressable market — some developers do payment plans | Phase 3+ if customer demand |
| No ZATCA e-invoicing | Developers need compliant invoices — will use separate tool for now | Phase 3+ |
| No portal integration (Aqar, PF) | Developers maintain two systems for marketing | Phase 3+ |
| No mobile app | Office-first for now — responsive web is the minimum | Phase 2 polish |
| No bulk CSV import for units | Onboarding pain for large projects | Phase 1 — must ship with launch |
| Reporting is basic | Lead-source ROI, project benchmarking, cash flow forecasting not included | Phase 2 |

---

## Current Status

- [x] Phase 0 — Validation (skipped — 4 years domain experience, pain points confirmed)
- [x] Phase 1, Day 1 — Project scaffold + Supabase schema
- [x] Schema deployed to Supabase (2026-04-04) — cleanup.sql + supabase-schema.sql run successfully
- [x] Phase 1, Day 2 — Auth + company onboarding + user/role management
- [x] Phase 1, Day 3 — Project → Building → Unit management + CSV bulk import
- [x] Phase 1, Day 4 — Customer management
- [ ] Phase 1, Day 5 — Unit availability board

---

## Build Plan

### Phase 0 — Validation (before any code)
- [ ] Talk to 3–5 Saudi real estate developer companies
- [ ] Confirm pain points: double-bookings, deposit tracking, commission disputes?
- [ ] Validate pricing range (299 / 599 / 1,200 SAR/mo)
- [ ] Define MVP feature cut based on feedback

### Phase 1 — Foundation
- [ ] Day 1: Project scaffold + Supabase schema (multi-tenant, all entities)
- [ ] Day 2: Auth + company onboarding + user/role management
- [ ] Day 3: Project → Building → Unit management + CSV bulk import
- [ ] Day 4: Customer management
- [ ] Day 5: Unit availability board (live status dashboard)

### Phase 2 — Core Transactions
- [ ] Day 6: Reservation flow (create, deposit record, expiry, cancellation + refund)
- [ ] Day 7: Sale flow (direct sale + reservation-to-sale conversion, deposit return)
- [ ] Day 8: Commission split entry + finalization
- [ ] Day 9: Audit trail
- [ ] Day 10: External realtor management

### Phase 3 — Reporting + Telegram
- [ ] Day 11: In-app reports (availability, revenue, pipeline, lead source, commission)
- [ ] Day 12: Telegram bot (n8n webhook, auth, daily summary, query commands)

### Phase 4 — PDF Generation + Payments
- [ ] Day 13: Reservation Agreement PDF generation
- [ ] Day 14: After-Sale Agreement PDF generation
- [ ] Day 15: Moyasar SaaS subscription billing

### Phase 5 — Polish & Launch
- [ ] Mobile responsiveness
- [ ] Arabic error messages
- [ ] Beta launch to Phase 0 validated companies

---

## Build Log

### Day 1 — Scaffold + Supabase Schema (2026-04-02)

**What was built:**

Full project scaffold and Supabase schema. Nothing runs yet — this is the foundation everything builds on.

**Files created:**
| File | Purpose |
|---|---|
| `docs/cleanup.sql` | Drops proptech tables from shared Supabase project — run first |
| `docs/supabase-schema.sql` | Full PropManager schema — all 12 tables, indexes, RLS |
| `backend/main.py` | FastAPI app, CORS, health check |
| `backend/app/config.py` | Settings via pydantic-settings, `load_dotenv(override=True)` |
| `backend/app/auth.py` | JWT middleware — validates Supabase user token, never service role |
| `backend/requirements.txt` | FastAPI, uvicorn, python-jose, pydantic-settings |
| `backend/.env` + `.env.example` | Supabase URL + secret key pre-filled |
| `frontend/package.json` | Next.js 14, React 18, @supabase/ssr, Tailwind |
| `frontend/next.config.mjs` | Minimal config (avoids Next.js 14 .ts bug) |
| `frontend/tailwind.config.ts` | Primary blue palette + Tajawal font + RTL |
| `frontend/src/app/layout.tsx` | Root layout — `dir="rtl"`, `lang="ar"`, Tajawal |
| `frontend/src/app/globals.css` | Tailwind + `.input`, `.card`, `.btn-primary`, `.btn-ghost` |
| `frontend/src/middleware.ts` | Route protection — all app routes require auth |
| `frontend/src/lib/supabase.ts` | Browser client (createBrowserClient), getUser, getUserProfile, signOut |
| `frontend/.env.local` | Supabase URL + publishable key pre-filled |

**Schema tables:** companies, user_profiles, projects, buildings, floor_plans, units, customers, external_realtors, reservations, sales, sale_participants, audit_log

**RLS approach:**
- `auth_company_id()` and `auth_role()` — security definer functions that query user_profiles
- All policies use these functions — zero recursion risk
- reservation_manager cannot SELECT from sales table (no payment amounts)
- audit_log is insert-only via backend service role; read by owner + cfo only

**⚠️ One thing needed from Supabase Dashboard:**
- Go to Settings → API → JWT Secret → copy into `backend/.env` as `SUPABASE_JWT_SECRET`

**Next:** Day 3 — Project → Building → Unit management + CSV bulk import.

---

### Day 2 — Auth + Onboarding + User Management (2026-04-04)

**What was built:**

Full auth flow, company onboarding, and user/role management.

**Files created/modified:**
| File | Purpose |
|---|---|
| `backend/app/supabase_client.py` | httpx-based Supabase REST client — auth/user operations |
| `backend/app/routers/onboarding.py` | POST /onboarding — create company + owner profile |
| `backend/app/routers/users.py` | GET/POST/PATCH/DELETE /users — invite, role change, delete |
| `frontend/src/app/auth/page.tsx` | Arabic login/signup toggle |
| `frontend/src/app/onboarding/page.tsx` | 5-field company setup form |
| `frontend/src/app/dashboard/layout.tsx` | Sidebar layout with nav, company name, role |
| `frontend/src/app/settings/users/page.tsx` | Invite form + users table with role dropdown |
| `frontend/src/middleware.ts` | Route protection + post-login profile check |

**Next:** Day 3 — Project → Building → Unit management + CSV bulk import.

---

### Day 3 — Inventory Management (2026-04-04)

**What was built:**

Full project/building/unit CRUD with CSV bulk import. Split-view UI at `/projects`.

**Backend:**
| File | Purpose |
|---|---|
| `backend/app/routers/projects.py` | GET/POST/PATCH/DELETE /projects |
| `backend/app/routers/buildings.py` | POST/PATCH/DELETE /buildings |
| `backend/app/routers/units.py` | GET/POST/PATCH/DELETE /units + POST /units/import |
| `backend/app/supabase_client.py` | +14 functions for projects/buildings/units/import |
| `backend/tests/test_projects.py` | 7 tests |
| `backend/tests/test_buildings.py` | 6 tests |
| `backend/tests/test_units.py` | 12 tests (including all CSV import cases) |

**Frontend:**
| File | Purpose |
|---|---|
| `frontend/src/app/projects/page.tsx` | Split-view shell (aside + main) |
| `frontend/src/app/projects/_components/ProjectTree.tsx` | Accordion tree, URL-driven building selection |
| `frontend/src/app/projects/_components/ProjectFormModal.tsx` | Add/edit project |
| `frontend/src/app/projects/_components/BuildingFormModal.tsx` | Add/edit building |
| `frontend/src/app/projects/_components/UnitsPanel.tsx` | Units table with status badges |
| `frontend/src/app/projects/_components/UnitFormModal.tsx` | Add/edit unit |
| `frontend/src/app/projects/_components/CsvImportModal.tsx` | File picker → preview → multipart import |

**Key decisions:**
- CSV import is all-or-nothing: entire file validated before any insert
- SAK ID uniqueness is global (across all companies) — service role check
- `/units/import` defined before `/{unit_id}` to avoid FastAPI path collision
- URL pattern: `/projects?building=<id>&project=<id>`

**Test count:** 38 total (13 Day 1-2 + 25 new)

**Next:** Day 4 — Customer management.

---

### Day 4 — Customer Management (2026-04-04)

**What was built:**
- `GET /customers` with optional `?search=` (ilike OR across full_name, id_number, phone)
- `POST /customers`, `PATCH /customers/{id}`, `DELETE /customers/{id}` with role guards
- Supabase client: `get_customers`, `create_customer`, `update_customer`, `delete_customer`
- Frontend `/customers` page: searchable table, debounced 300ms, two empty states
- `CustomerFormModal` with 8 fields (full_name, id_type, id_number, phone, email, birthdate, lead_source, notes)
- Role gating: create/edit hidden for cfo/accountant; delete hidden for non-owners

**Key decisions:**
- Search uses PostgREST `or` + `ilike` with `*` wildcards (URL-friendly vs `%`)
- WRITERS = `{owner, sales_manager, reservation_manager}`; DELETE = owner only
- `getUserProfile()` called client-side to gate UI buttons; backend enforces authoritatively

**Test count:** 46 total (38 Day 1-3 + 8 new)

**Next:** Day 5 — Unit availability board.

---

## Error Log

> Empty — errors documented here as they occur.
> Format: ERR-001, ERR-002, etc. — symptom → root cause → fix → lesson.

---

## Folder Structure

```
D:/claude/propmanager/
├── backend/          ← FastAPI app
├── frontend/         ← Next.js app
├── docs/             ← Schema, API specs, decisions
├── data/
│   ├── uploads/      ← Local test PDFs (never commit real documents)
│   └── research/     ← Market research
├── scripts/          ← Utility scripts
├── BRIEF.md          ← This file
└── preferences.md    ← Workspace preferences
```

---

## Assets Borrowed From proptech

| Asset | Source | Status |
|---|---|---|
| Arabic auth page | `proptech/frontend/src/app/auth/` | Not copied yet |
| RTL Tailwind config | `proptech/frontend/tailwind.config.ts` | Not copied yet |
| Supabase RLS pattern | `proptech/docs/supabase-schema.sql` | Not copied yet — needs company_id + role extension |
