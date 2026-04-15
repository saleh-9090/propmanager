# Propmanager Workspace

Read `D:/claude/products/propmanager/BRIEF.md` for full project context.
Read `D:/claude/products/propmanager/preferences.md` for work style preferences.

## What this is
B2B sales management platform for Saudi real estate **developer companies** (build + sell ready units). Unit inventory, reservations with deposit tracking, sales, commission splits, PDF contract generation, Telegram bot for owner.

## Current status
- Day 1 complete: scaffold + Supabase schema
- Day 2 complete: auth, company onboarding, user/role management
- Day 3 complete: Project → Building → Unit management + CSV bulk import
- Day 4 complete: Customer management (CRUD + search)
- Day 5 complete: Unit availability board (read-only, client-side filtering)
- Day 6 complete: Reservation flow (create, deposit, expiry, cancel + refund)
- Day 7 complete: Sale flow (direct + conversion + deposit return)
- Day 8 complete: Commission splits + external realtor CRUD
- Day 13 complete: Arabic Reservation Receipt PDF (سند قبض) — ReportLab + Amiri font
- Perf pass: ProfileContext removes per-page Supabase profile fetch
- Next: Day 14 (After-Sale Agreement PDF), Day 9 (Audit trail), or Day 11-12 (Reports / Telegram)

## Stack
- Backend: FastAPI (Python) — `http://localhost:8001`
- Frontend: Next.js 14 + Tailwind (Arabic RTL) — `http://localhost:3000`
- DB + Auth: Supabase (same project as proptech — proptech tables dropped)
- Background jobs + Telegram bot: n8n (Unraid server)
- PDF generation: ReportLab (to be added Day 13)

## Running the servers
```bash
export PATH="/c/Program Files/nodejs:$PATH" && export NEXT_TELEMETRY_DISABLED=1
cd D:/claude/products/propmanager/backend && python -m uvicorn main:app --host 0.0.0.0 --port 8001 &
cd D:/claude/products/propmanager/frontend && npm run dev
```

## Key facts
- Roles: owner, cfo, sales_manager, reservation_manager, accountant
- No rental, no off-plan, no installments, no marketing copy generation
- FastAPI uses user JWT only — never service role (would bypass RLS)
- SAK ID is globally unique at DB level
- Two records: Reservation (deposit) + Sale (full payment) — deposit is always returned
- Supabase project: https://klmldkcpbknkinevwkae.supabase.co
- ⚠️ Rotate secret key before go-live
