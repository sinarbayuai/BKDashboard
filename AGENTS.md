# AGENTS.md

## Language & Communication Rules

- **Allowed Languages:** Strictly limited to **Bahasa Indonesia** or **English** for all interactions, explanations, code reviews, and thoughts.
- **Language Priority:** Respond using the same language used by the user — Indonesian if the user writes Indonesian, English if the user writes English.
- **Prohibited Languages:** Never respond or output text in any other language (e.g., Chinese, Russian, French), even if the underlying model defaults to them.
- Keep technical terms in standard English or common Indonesian programming forms (e.g., *array*, *endpoint*, *loop*, *debugging*).

## Stack

- **Backend**: FastAPI + SQLite (`app/db.py`, `app/main.py`). No ORM — raw SQL via `sqlite3`.
- **Frontend**: Vanilla JS + ECharts (vendored). No build step.
- **Python**: `.venv/bin/python` (Python 3.14). Never use bare `python` — always `.venv/bin/python`.
- **Deploy**: Vercel serverless (`vercel.json` → `app/main.py`).

## Key Commands

```bash
# Start dev server (port 8321, auto-reload)
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8321 --reload

# Re-ingest Excel data into SQLite
.venv/bin/python scripts/run_ingest.py

# Kill server
pkill -f "uvicorn app.main"
```

## Architecture

- `app/db.py` — schema + `connect()`, `init_db()`. All migrations live in `init_db()` via `ALTER TABLE` with `IF NOT EXISTS` guards.
- `app/main.py` — all API endpoints + static file mount (`/`). Every GET/POST/PUT/DELETE lives here.
- `app/ingest.py` — Excel → SQLite. Idempotent (UNIQUE on `source_file, row_idx`).
- `app/static/` — `index.html`, `app.js`, `style.css`, `echarts.min.js` (vendored).
- `bk21.db` — SQLite database file (checked into git).

## Frontend Conventions

- `$` = `document.querySelector` shorthand (`app/static/app.js:1`).
- Pages are toggled via hash (`#kpi`, `#detail`, `#pemodal`, `#investasi`).
- Chart colors use CSS vars: `var(--pos)`, `var(--neg)`, `var(--brass)`.
- `fmtRp` for currency formatting, `fmtShort` for abbreviated values.
- UI style: Indonesian copy, "ledger & brass" theme.
- Static files are served from `app/static/` at root (`/app.js`, not `/static/app.js`).

## API Conventions

- All JSON, no auth.
- Filters: `from`, `to` (ISO dates), `outlet` (string) — optional on most endpoints.
- `POST /api/sync` re-ingests all Excel files without server restart.
- Investment CRUD: `GET/POST /api/investments`, `PUT/DELETE /api/investments/{id}`.
- Lokasi values: `GET /api/investments/lokasi-values`, `PUT /api/investments/lokasi-values/{lokasi}` (upsert, sets `updated_at`).

## DB Migration Pattern

Migrations run on every startup in `init_db()` — use `ALTER TABLE ... ADD COLUMN` only if the column doesn't exist (check with `PRAGMA table_info()`). Do not add `CREATE TABLE IF NOT EXISTS` to existing tables unless it's a brand-new table.

## Gotchas

- **Uvicorn without `--reload`**: code changes require manual restart. Users often hit 405/404 when stale.
- **Frontend paths**: `index.html` references `/app.js`, not `/static/app.js` — the mount at `/` means static files are at root.
- **bk21.db is in git**: schema changes alter the binary file — commit it with your changes.
- **No tests, no lint, no typecheck** — verify changes manually or via server + browser.
