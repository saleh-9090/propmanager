# User Preferences — propmanager

All agents in this workspace must read and respect these preferences.

## Communication Style
- Be concise and direct
- Use bullet points over long paragraphs
- Explain decisions briefly before acting
- Document every error encountered (symptom → root cause → fix → lesson)

## Coding Conventions
- Write clean, readable code with meaningful variable names
- Prefer simplicity over cleverness
- Python: follow PEP 8, always add type hints, include docstrings
- TypeScript: strict mode, explicit return types on functions
- Arabic-first UI — RTL built in from day one, never added later

## Tool Preferences
- Python: pip for packages, pytest for testing
- JS/TS: npm, Next.js App Router
- Always unpin Python packages initially (Python 3.14 has no wheels for many pinned versions)
- Use `@supabase/ssr` (not `@supabase/supabase-js`) for Next.js auth

## Work Style
- Read WORKSPACE.md at D:/claude/WORKSPACE.md before starting any new session
- Read this BRIEF.md at the start of every session
- Show a brief plan before executing complex tasks
- Verify work before reporting completion
- Commit after each completed feature with a summary entry in BRIEF.md
- Document every error in the BRIEF.md error log

## Machine Context
- OS: Windows 11, project drive D:/, system drive C:/
- Python 3.14.3 at C:\Users\mcona\AppData\Local\Python\pythoncore-3.14-64\
- Node.js 24.14.1 at C:\Program Files\nodejs\ — NOT on PATH by default
- Always run: export PATH="/c/Program Files/nodejs:$PATH"
- Always run: export NEXT_TELEMETRY_DISABLED=1
- Always use: load_dotenv(".env", override=True) in Python backends
- Full machine notes: D:/claude/WORKSPACE.md

## Active Studies — Connect Concepts While Building
This person is studying SEC+ (SY0-701) and CCNA (200-301).
When anything in this project relates to either cert, briefly mention the connection.
- Multi-tenant RLS → SEC+ access control, authorisation, separation of duties
- PDF upload pipeline → SEC+ file upload vulnerabilities, input validation
- Supabase Storage → SEC+ data at rest encryption
- Background job queue → SEC+ availability, fault tolerance
- Cloudflare tunnel for deployment → SEC+/CCNA tunnelling protocols, NAT traversal
- Docker networking on server → CCNA VLANs, subnetting, network segmentation
- Nginx reverse proxy → SEC+/CCNA DMZ, proxy security
Full study context: D:/claude/studies/BRIEF.md

## Domain Context
- Product: B2B property portfolio management platform for Saudi real estate companies
- Market: Saudi Arabia (Arabic-first, RTL, Moyasar payments, mada support)
- Project root: D:/claude/propmanager/
- Backend: D:/claude/propmanager/backend/
- Frontend: D:/claude/propmanager/frontend/
- Docs: D:/claude/propmanager/docs/
- Data: D:/claude/propmanager/data/
- Scripts: D:/claude/propmanager/scripts/
- Reference project: D:/claude/proptech/ (proven patterns to borrow from)
