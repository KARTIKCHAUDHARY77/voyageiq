# VoyageIQ

Vessel performance monitoring and voyage analytics for shipping operators. VoyageIQ turns noon reports into fuel-efficiency, weather-impact and charter-claim insights, and gives operators a way to compare route options before a voyage.

> Proprietary software. All rights reserved. See [LICENSE](LICENSE).

## What problem it solves

Operators receive daily noon reports (position, speed, fuel burned, weather) as PDFs, spreadsheets and emails. Judging whether a ship is performing to its charter warranty, and whether poor weather explains a shortfall, is manual and slow. VoyageIQ ingests those reports, scores performance against warranted speed and consumption, separates weather effects from hull and engine effects, and flags potential claims.

## Features

| Area | What it does |
| --- | --- |
| Fleet dashboard | Fleet-level KPIs: distance, average speed, fuel consumed, efficiency, estimated savings, open claims |
| Vessels and voyages | Vessel master data, voyage records, noon-report history, per-vessel health score |
| Noon report ingestion | Manual entry, or upload of CSV, Excel and PDF with a parse-preview-confirm step |
| Fuel analytics | Consumption and efficiency trends against the vessel's warranted figures |
| Weather intelligence | Open-Meteo forecasts and marine data, route risk, and a wind/wave/current speed-loss model |
| Claim detector | Rule-based detection of speed and consumption shortfalls, with weather attribution |
| Voyage optimizer | Route and speed scenarios with a fuel simulator |
| AI Copilot | Chat over fleet data. Uses OpenAI (`gpt-4o-mini`) when a key is set, otherwise a rule-based responder |
| Reports | Voyage reports as PDF, Excel or CSV |

**Data integrity.** Every figure on screen is computed from stored noon reports. When there is no data, the API returns `data_source: "none"` and null values, and the UI shows an en dash or an empty state. Nothing is simulated, randomised or hardcoded. Two figures rest on assumptions that the API returns with the result: the bunker price (`BUNKER_PRICE_USD_MT`, default 620) and the hire rate used to price lost time (`DEFAULT_HIRE_RATE_USD_DAY`, default 15000). Analysis windows end at the latest report, not at today's date.

Claim detection compares good-weather days (Beaufort 4 or below, at least 3 of them) with the warranted speed and consumption, and stores the basis and calculation with each claim. The models are simple heuristics and are not validated against real fleet data. Treat them as decision support, not as evidence in a charter dispute.

## Architecture

```
frontend/   React 18 + TypeScript + Vite + Tailwind, Leaflet, Chart.js/Recharts
backend/    Flask 3, SQLAlchemy, Flask-JWT-Extended, Flask-Limiter, gunicorn
database/   schema.sql for Postgres (Docker init)
```

- Browser calls `/api/*`. On Vercel, `frontend/vercel.json` proxies that path to the backend, so the browser sees a single origin.
- SQLite is used locally when `DATABASE_URL` is empty. PostgreSQL is used in production.
- Weather comes from Open-Meteo (no key needed). The OpenAI key is optional.

## Run locally

Requirements: Python 3.11 or 3.13, Node 20.

```bash
cp .env.example .env        # then fill in values; see "Configuration"
```

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py               # http://127.0.0.1:5000
```

Frontend:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev                 # http://localhost:5173
```

With `SEED_DEMO_DATA=true` (the development default) the first start creates demo users, vessels, voyages and noon reports. The demo accounts are listed in `backend/app/utils/seed_data.py` and are only for local use.

Docker (Postgres + API + nginx-served frontend):

```bash
# .env must define SECRET_KEY, JWT_SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build
```

## Configuration

All settings are environment variables. `.env` is git-ignored; `.env.example` documents every key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET_KEY`, `JWT_SECRET_KEY` | Production | Random strings, 32+ characters. The app refuses to start in production without them |
| `DATABASE_URL` | Production | Postgres connection string. Empty uses local SQLite |
| `CORS_ORIGINS` | Production | Comma-separated exact origins allowed to call the API |
| `OPENAI_API_KEY` | No | Enables GPT-backed Copilot answers |
| `SEED_DEMO_DATA` | No | `true` creates demo users with a published password. Keep `false` in production |
| `ALLOW_REGISTRATION` | No | Public self-signup. Defaults to `false` in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First deploy | Creates the first admin when none exists. Remove `ADMIN_PASSWORD` afterwards |
| `RATELIMIT_STORAGE_URI` | No | Redis URL for rate limits shared across workers. Defaults to per-process memory |

Generate a secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Deploying

Backend (Render, see `render.yaml`): set `FLASK_ENV=production`, `DATABASE_URL`, `CORS_ORIGINS`, the two secrets, and `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first boot. Frontend (Vercel): `frontend/vercel.json` sets the API proxy and security headers; update its rewrite destination if your backend URL changes.

On the first production start after upgrading from an older version, accounts seeded with the old published password (`admin@voyageiq.com`, `captain@oceancargo.com`, `analyst@oceancargo.com`) are deactivated automatically. Rotate `SECRET_KEY` and `JWT_SECRET_KEY` as well, because earlier versions fell back to values that were public in the repository.

## Security model

What the backend enforces:

- **Secrets**: no hardcoded fallbacks. Production fails to start without strong keys.
- **Passwords**: 10+ characters with a letter and a digit, hashed with Werkzeug (scrypt). Login does a dummy hash check for unknown emails so timing does not reveal which accounts exist.
- **Tokens**: 60-minute access token, 7-day refresh token. Logout and password change revoke tokens through a database blocklist. The frontend renews access tokens automatically.
- **Roles**: users are `operator` by default. Role is never accepted from a request body. Fleet master-data writes require `admin` or `manager`; claim writes require `admin`, `manager` or `analyst`. Roles are read from the database on each request, so demoting a user takes effect at once.
- **Rate limits**: login 10/min, registration 5/hour, password change 5/hour, Copilot 20/min, 300/min default.
- **CORS**: exact-origin allowlist. Earlier versions echoed back any origin with credentials enabled.
- **Errors**: internal exception text is logged, not returned to clients.
- **Uploads**: 10 MB cap, extension allowlist and magic-byte check, filenames sanitised.
- **Exports**: CSV cells beginning with `=`, `+`, `-` or `@` are neutralised against spreadsheet formula injection.
- **Headers**: nosniff, frame denial, HSTS, `Cache-Control: no-store` on API responses, and a Content-Security-Policy on the frontend.
- **Containers**: backend runs as a non-root user; Postgres is not published to the host.

Known limitations (open work):

1. **No per-company data isolation.** Vessels, voyages, claims and analytics are shared by every authenticated user. `Vessel.owner_id` is now set on creation but not yet used to filter reads. Do not host two unrelated customers on one deployment until this is done.
2. **Tokens live in `localStorage`**, so an XSS bug would expose them. The CSP reduces that risk; httpOnly cookies with CSRF protection would remove it.
3. **Rate limiting is per process** unless `RATELIMIT_STORAGE_URI` points at Redis.
4. **Access tokens stay valid until expiry** after a password change on another device (up to 60 minutes). Only the token used for the change is revoked.
5. **No automated tests, no dependency scanning in CI.** Run `pip-audit` and `npm audit` before releases.
6. **Schema changes** use `db.create_all()` with no migrations. The new `token_blocklist` table is created automatically; later changes need Alembic.

Report vulnerabilities privately to the repository owner rather than opening a public issue.

## API overview

All routes are under `/api` and need a bearer token except `/auth/login`, `/auth/register` and `/health`.

| Prefix | Routes |
| --- | --- |
| `/auth` | `login`, `register`, `me`, `refresh`, `logout`, `change-password` |
| `/vessels` | list, get, create*, update*, `positions`, `performance`, `health` |
| `/voyages` | list, get, create, update, `noon-reports`, `performance`, `claims` |
| `/claims` | list, get, create†, `status`†, `detect/<voyage_id>` |
| `/uploads` | `report` (upload), get, `confirm` |
| `/analytics` | `dashboard`, `fuel`, `performance`, `weather-impact` |
| `/weather` | `current`, `route-risk`, `forecast`, `wind-impact`, `attribution`, `grid-enhance` |
| `/optimization` | `calculate`, `route`, `fuel-simulator`, `ports` |
| `/copilot` | `chat`, `conversations` |
| `/reports` | `generate/<voyage_id>?format=pdf\|excel\|csv`, `templates` |

\* admin or manager only. † admin, manager or analyst.

## Component kit

Reusable primitives live in `frontend/src/components/kit/` (Button, Field/Input/Select, Panel, PageHeader, Stat, Badge, DataTable, Tabs, EmptyState/ErrorState/Skeleton). Design tokens are CSS variables in `frontend/src/index.css` and are exposed to Tailwind and to charts (`frontend/src/design/chartTheme.ts`). Run `npm run dev` and open `/ui` for a live reference. Every screen now uses the kit. Maps (`TrackMap`) draw reported noon positions on OpenStreetMap tiles, darkened with a CSS filter; for heavy production use, switch the tile URL to a provider you have an agreement with.

## App shell

`frontend/src/layout/` holds the signed-in layout: a fixed sidebar with grouped navigation (Operate, Analyse, Plan) on large screens; a drawer and bottom bar below 1024px; a top bar with breadcrumb, a Ctrl/Cmd+K page switcher and the account menu. Navigation items are defined once in `layout/nav.ts`. Route changes are instant, focus moves to the page content, and there is a skip link. Each page's browser-tab title comes from the navigation, or from its `PageHeader`.

## Design notes

The interface uses flat surfaces with hairline borders, one teal accent, IBM Plex type, and motion only where it explains a change (press feedback on buttons, short enter transitions). Decorative effects such as glass blur, glows, gradient text and looping animations were removed. Global styles live in `frontend/src/index.css` under "Refinement layer"; colour tokens are in `frontend/tailwind.config.js`.

## Project layout

```
backend/app/
  routes/        one blueprint per area (auth, vessels, voyages, ...)
  analytics/     fuel model and performance engine
  security.py    rate limiter, role checks, validation helpers
  models.py      SQLAlchemy models
frontend/src/
  pages/         route-level screens
  components/ui/ shared widgets (KPI card, map, charts)
  services/api.ts  axios client with token refresh
  store/         auth state (zustand)
```
