# PropManager → ERPNext Migration Plan (Path B)

> **Status:** PARKED — do not start until trigger condition is met.
> **Authored:** 2026-04-25
> **Trigger to revisit:** First paying real estate developer customer asks for accounting / ZATCA / payroll / inventory features that are out of scope for current PropManager.

---

## Why This Plan Exists

PropManager (current) is a focused real estate SaaS — units, reservations, sales, commissions. It does NOT do accounting, ZATCA e-invoicing, payroll, inventory, or general ERP.

When a Saudi real estate developer signs up for PropManager, sooner or later they will ask:
- "Can it generate ZATCA-compliant invoices?"
- "Can it talk to our accountant's books?"
- "Can it track our employees / commissions as payroll?"
- "Can it handle our office supplies / inventory?"

Building all of that from scratch = rebuilding ERPNext (a 5+ year project). Bad use of time.

ERPNext (GPLv3, free, open source) already does all of it. The play is to **migrate PropManager onto ERPNext as the backend** when a paying customer's needs justify it.

---

## The Architecture Vision

```
                    ┌─────────────────────┐
                    │  Frappe / ERPNext   │  ← single source of truth
                    │  REST API           │
                    └─────────────────────┘
                       ↑       ↑       ↑
        ┌──────────────┘       │       └──────────────┐
        │                      │                      │
   Next.js web            Mobile app            Bots / partners
   (customer-facing       (customer-facing      (Telegram, WhatsApp,
   PropManager UI)        React Native /        BI tools, realtor
                          Flutter)              portals)


   Frappe admin UI  ←  ONLY for Saleh + dev tooling
                       Customers never see it
                       Used for: accounting, ZATCA setup, payroll,
                                 inventory, system config
```

**Key principle:** customers interact ONLY with PropManager-branded surfaces (web, mobile, bots). The Frappe admin UI is a dev/back-office tool.

---

## Three Migration Patterns (Choose One When Triggered)

### Pattern A — Full Frappe App Rebuild
- Rebuild PropManager DocTypes inside Frappe (Unit, Reservation, Sale...)
- Customers use Frappe's built-in UI
- **Pros:** Tightest integration, least code, fastest to ZATCA/accounting
- **Cons:** Throws away current Next.js frontend (the killer Arabic RTL design). Frappe UI is functional but generic.

### Pattern B — Headless ERPNext (RECOMMENDED) ⭐
- Keep current Next.js frontend exactly as designed
- Replace Supabase backend with Frappe REST API
- Frappe handles: data, accounting, ZATCA, multi-tenancy, auth
- Next.js handles: branded UI, customer experience
- **Pros:** Keep the Arabic RTL design (real differentiator). Customer never sees Frappe. Multi-surface ready (mobile, bots).
- **Cons:** More integration code than Pattern A. Two UIs to maintain (yours + Frappe admin). Auth across surfaces is non-trivial.

### Pattern C — Sync Bridge
- Keep PropManager standalone on Supabase
- When a Sale completes → POST to ERPNext API → creates Sales Invoice + Payment Entry there
- Accounting flows in ERPNext, real estate ops stay in PropManager
- **Pros:** Smallest immediate change. Two systems can run side by side.
- **Cons:** Two databases, eventual consistency issues, sync layer is fragile, customer support nightmare.

**Decision:** Pattern B unless the customer specifically wants to live inside the ERP UI.

---

## Pattern B — Migration Phases (When Triggered)

### Phase 1 — Headless Web (4–6 weeks)
- Stand up ERPNext on Saudi cloud (AWS Riyadh me-central-1 — required for PDPL compliance)
- Define DocTypes: Project, Building, Floor Plan, Unit, Reservation, Sale (extends Sales Invoice), Sale Participant, External Realtor
- Reuse ERPNext's Customer DocType (don't rebuild)
- Migrate existing PropManager data → DocTypes via Frappe import scripts
- Replace Supabase calls in Next.js with Frappe REST API calls:
  - `supabase.from('units').select()` → `fetch('/api/resource/Unit')`
  - `supabase.auth.signIn()` → `POST /api/method/login` → store `sid` cookie or `api_key` + `api_secret`
- Replace Supabase Storage with Frappe File DocType
- Port Arabic PDF templates → Frappe Print Formats (Jinja2)
- Port reservation expiry / unit lifecycle logic → Frappe DocType controllers (Python)

### Phase 2 — Mobile App (8–12 weeks, only if customer asks)
- React Native (TS knowledge transfers) or Flutter (better UX, learn Dart)
- Same Frappe REST API
- Auth: API key + secret per user (Frappe generates these), stored in mobile keychain
- Real-estate killer features: walk units, photo upload, push notifications for new reservations, offline cache for site visits
- Apple Developer account ($99/yr) + Google Play one-time $25
- App store review = 1–2 week buffer per release

### Phase 3 — Bots & Integrations (incremental)
- Telegram bot (already planned in PropManager BRIEF Day 12) → call Frappe API
- WhatsApp Business API (huge in Saudi) → call Frappe API
- Realtor partner portal → role-restricted Frappe users with limited DocType access
- BI / dashboards → Metabase or Frappe Insights pointing at the same DB

---

## Hard Problems to Solve Before Phase 1

### 1. Auth Across Surfaces
- **Web:** Frappe session cookie (`sid`) via `POST /api/method/login`
- **Mobile:** Long-lived API key + secret pair per user (Frappe generates), stored in OS keychain
- **Bots:** Service account user with API key/secret, scoped role
- **Don't hand-roll.** Use Frappe's built-in auth primitives.

### 2. File Uploads
- All files (receipts, unit photos, ID copies, contracts) flow through Frappe File DocType
- Standardize early: every uploaded file is attached to a parent DocType (e.g. Reservation), not orphaned
- Set up file retention + access controls in Frappe permissions

### 3. API Contract Versioning
- When a DocType field changes, all 3 frontends (web, mobile, bots) must update in lockstep
- Strategy: never break field names — add new fields, deprecate old ones with a 6-month grace period
- Optional: build a thin GraphQL or BFF layer if the contract gets too brittle

### 4. Multi-Tenancy
- Frappe sites = one site per tenant (best isolation, more ops overhead)
- OR shared site + Company DocType + permission scoping (less isolation, easier to manage)
- For Saudi compliance (PDPL data isolation) — strongly prefer per-site

### 5. ZATCA Phase 2 E-Invoicing
- ERPNext has an open-source ZATCA app (community-maintained) — verify it's still active when migrating
- If not, this is a custom Frappe app to build (real revenue opportunity beyond PropManager itself)

---

## What Survives the Migration

| Current PropManager asset | Survives? | Notes |
|---|---|---|
| Next.js frontend (Arabic RTL design) | ✅ Fully | The whole point of Pattern B |
| Tailwind + RTL config | ✅ Fully | Same |
| FastAPI route logic | ⚠️ Conceptually | Reimplemented as Frappe DocType controllers |
| Postgres schema | ⚠️ Conceptually | Recreated as DocTypes |
| Supabase auth + RLS | ❌ Replaced | Frappe roles + permissions |
| Supabase Storage | ❌ Replaced | Frappe File DocType |
| Arabic PDF templates (ReportLab) | ⚠️ Conceptually | Reimplemented as Frappe Print Formats (Jinja2) |
| 67+ pytest tests | ❌ Mostly | New tests against Frappe API |
| Demo data seed script | ⚠️ | Rewrite as Frappe fixtures |

**Realistic estimate:** ~60% of business logic survives in concept, ~30% of code survives literally.

---

## What ERPNext Gives You for Free

- Customer / Contact / Address DocTypes (no rebuild)
- Sales Invoice + Payment Entry (deposits become liability accounts automatically)
- ZATCA e-invoicing scaffolding
- Full general ledger / chart of accounts
- Multi-currency
- Multi-tenancy via sites
- Built-in roles + permissions (replaces RLS)
- File / attachment system
- Email + notification framework
- Webhooks
- REST API (auto-generated for every DocType)
- Workflow engine
- Print format engine
- Audit log
- Backup / restore
- HR + payroll modules (if you ever need them)
- Inventory + stock (if you ever need it)

---

## Connection to AWS SAA Learning

This architecture is the textbook AWS SAA Domain 3 (Design High-Performing Architectures) decoupled API pattern:

- API Gateway + Lambda backends ≈ Frappe REST API
- Multiple consumer frontends ≈ Pattern B (web, mobile, bots)
- DynamoDB or RDS ≈ Frappe DB
- S3 ≈ Frappe File DocType (or S3-backed file storage in production)
- CloudFront in front of Next.js ≈ same as you'd do today

When the migration trigger fires, Saleh's AWS SAA knowledge will map 1:1 to deploying this on AWS Riyadh.

---

## DO NOT DO (Until Triggered)

- ❌ Don't pre-emptively rewrite PropManager as a Frappe app
- ❌ Don't build a sync bridge "just in case"
- ❌ Don't add ERPNext dependencies to current PropManager
- ❌ Don't tell prospects "we use ERPNext under the hood" — current PropManager doesn't
- ❌ Don't spend April–May 2026 thinking about this — focus is Upwork + AWS SAA

## DO (Now)

- ✅ Finish PropManager Days 8–11 (June) for portfolio
- ✅ Get one paying customer in Q3 2026
- ✅ Listen for the trigger phrase: "we also need [accounting/ZATCA/payroll/HR]"
- ✅ When triggered, re-read this doc and start Phase 1

---

## Useful Reference Material (Add Links When Triggered)

- ERPNext docs: https://docs.erpnext.com/
- Frappe Framework docs: https://frappeframework.com/docs/
- Frappe REST API: https://frappeframework.com/docs/user/en/api/rest
- Frappe DocType reference: https://frappeframework.com/docs/user/en/basics/doctypes
- ZATCA Phase 2 community app: search "frappe zatca" on GitHub when migrating
