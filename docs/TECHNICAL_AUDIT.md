# VoyageIQ — Technical Audit

- **Baseline:** GitHub `main` @ `5bd4dc0` (merge of PR #1, the security and redesign work). Audited on branch `audit/technical-baseline`.
- **Date:** 2026-11-26
- **Method:** static reading of the repository, plus `tsc --noEmit` and `vite build` on a clean `npm ci`. The backend was **not run** and there is no test suite to run.
- **Evidence:** findings cite `file:line` from the baseline. Anything not read is listed under "Not inspected" and must not be assumed fine.

Severity: **P0** critical security / data integrity · **P1** core product functionality · **P2** advanced intelligence · **P3** UX and optional.

---

## 1. Existing architecture

| Layer | Implementation |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5, Tailwind 3 (design tokens), Zustand, axios, Chart.js, Leaflet. Per-page code splitting. Deployed on Vercel. |
| Backend | Flask 3 app factory (`backend/app/__init__.py`), blueprints under `/api/{auth,vessels,voyages,reports,analytics,claims,optimization,copilot,weather,uploads}`, gunicorn. Deployed via nixpacks (Railway), Docker, `render.yaml`. |
| Data | SQLAlchemy 2 models (`models.py`, 10 tables + `token_blocklist`), UUID string PKs. PostgreSQL in compose/production; **SQLite fallback** (`backend/voyageiq_local.db`) when `DATABASE_URL` is unset (`config.py:41-47`). |
| Auth | Flask-JWT-Extended: 60-min access / 7-day refresh tokens, DB-backed revocation list, role read from DB per request (`security.py:roles_required`), Flask-Limiter. |
| External | Open-Meteo forecast + marine (`routes/weather.py`), OpenAI `gpt-4o-mini` via raw `requests` (`routes/copilot.py`). No AIS, no port data, no routing engine. |
| ML | `analytics/fuel_model.py`: Random Forest trained on **synthetic data**. `analytics/performance_engine.py`: rule-based scoring. |

## 2. Existing functional features (inspected)

- JWT login/refresh/logout/change-password; registration closed by default in production.
- Vessel / voyage / noon-report / claim CRUD; claim exposure uses an env-configurable bunker price and states it (`claims.py:26,132`).
- Report upload → parse → **preview → confirm** flow for CSV / XLSX / PDF with magic-byte checks and `secure_filename` (`uploads.py:411,455`); raw parse is stored on the `ReportUpload` row.
- Weather forecast (atmosphere + marine) with request timeouts (`weather.py:86,100`).
- Voyage calculator, route "alternatives", fuel simulator (`optimization.py`).
- Copilot chat with conversation history; OpenAI call with a rule-based fallback.
- PDF/CSV report export (`reports.py`).

## 3. P0 — critical security and data integrity

### P0-1. There is no tenant isolation at all  — RESOLVED in Milestone 2 (see docs/SECURITY.md)
Every route reads global tables. Any authenticated user, including a self-registered `operator`, can read and mutate every other user's data.

- Global reads: `vessels.py:128,169,252,283,318,361` (`Vessel.query…`, `Vessel.query.get(id)`), `voyages.py:40`, `claims.py:151,171,212,234`, `uploads.py:451,564`.
- `Vessel.owner_id` is written once (`vessels.py:235`) and **never checked**.
- Only `ReportUpload` get/confirm (`uploads.py:519,544`, by `uploaded_by`) and `CopilotConversation` (by `user_id`) are scoped, and per user, not per company.
- Object-reference attacks: `claims.py:186` creates a claim against any `voyage_id`; `uploads.py:451` attaches an upload to any `vessel_id`; `copilot.py:68-110` builds LLM context from client-supplied `vessel_id` / `voyage_id` (confirm: the context queries are global).
- Role checks exist on only 3 vessel routes and 4 claim routes; voyages, noon reports, optimization, uploads, reports and analytics have authentication but **no authorization**.
- `imo_number` is globally unique and checked globally (`vessels.py:213`): two companies cannot register the same ship, and the response reveals whether another tenant has it.

### P0-2. Schema is managed by `db.create_all()`; no migrations  — RESOLVED (Alembic; see docs/IMPLEMENTATION_PROGRESS.md)
`__init__.py:114-118` calls `create_all()` on every start and **swallows failures** with a warning. There is no Alembic. `database/schema.sql` has already drifted from the models (it has no `token_blocklist`). If `create_all` fails, the app boots without the revocation table and token checks then query a missing table.

### P0-3. Demo credentials and secrets history
- `utils/seed_data.py` hard-codes `password123` for three users. `DevelopmentConfig` seeds by default (`config.py:86`).
- Mitigation present: when `SEED_DEMO_DATA` is off, boot **deactivates** the three demo emails (`__init__.py:_bootstrap_accounts`). This is a patch over shared state, not a separation of demo and production.
- Earlier commits (before `797f7ba`) published the demo password and a default secret key. Anything that ever used those values must be rotated. Git history was not rewritten.

### P0-4. No automated tests, no CI  — tests added (53); CI still open
No `tests/`, no `pytest.ini`, no `.github/`. Nothing prevents a regression of P0-1 once fixed.

### P0-5. Missing data is converted to "good" data (weather)
`weather.py:135-141` and `344-354` use `… or 0.0`. If the marine API fails or returns null, `wave_height`, `swell_height` and `current_velocity` become **0**, which downstream code treats as calm seas. `or 0` also turns a real `0` and a missing value into the same thing. No freshness or availability status exists.

### P0-6. Fabricated weather inside the API
- `weather.py:649-668` `_interpolate_025_grid`: `random.seed(int(abs(lat*lon*100)))` then applies ±12% random variation and labels it a "0.25° enhancement".
- `weather.py:785-793` feeds it a **mock "1°" input** built from latitude (`15 + abs(lat/10)` knots) and returns the result as weather data.
This is reachable through an authenticated endpoint and must be removed or clearly disabled.

## 4. P1 — core product functionality

0. **Added during Milestone 2:** `voyages.py` replaces a missing noon-report time with the current clock time (`report_time=parse_time(...) or datetime.utcnow().time()`). That fabricates a value and must become `null` (Milestone 4). The claim list also summed open exposure across *all* companies; fixed with the tenant scoping.

1. **Org / RBAC model absent.** Roles are global strings (`admin`, `manager`, `analyst`, `operator`) on `User`; `company_name` is a free-text field. JWT identity is the user id only: no organisation claim, no switching.
2. **Provenance missing.** `ReportUpload` keeps the parse, but individual `NoonReport` rows carry no source, row/page, original value, unit or correction history. Imported and manual rows are indistinguishable.
3. **Ingestion gaps** (`uploads.py`): header matching uses a fixed dictionary (`_match_column`, no customer field mapping); unit normalisation not found; **no duplicate detection** found on import (`grep duplicate` finds none in `uploads.py`); PDF is regex over extracted text only, with no table extraction or OCR hook; no correction step before confirm; no per-record validation status.
4. **No data-quality service or dashboard.**
5. **Hard-coded commercial assumptions.** Bunker price defaults: `claims.py:26` (620, env), `optimization.py:175,515` (580), `optimization.py:400,408` (`* 580`), `weather.py:827` (`* 620`). Different numbers in different places; only claims discloses its assumption.
6. **Uploads on local disk.** `backend/uploads/` is ephemeral on Railway/Render and not segregated per tenant.
7. **Rate limiting is per process** (`memory://`, `security.py`); effective limit scales with worker count unless Redis is configured.
8. **JWT:** refresh tokens are not rotated or revoked on use; password change revokes only the presented access token (documented in code).

## 5. P2 — advanced intelligence

### Fuel model (`analytics/fuel_model.py`) — not a production model
- Trained on `_generate_training_data()`: uniform/exponential random inputs, targets from a **cubic formula plus noise**. It learns that formula; its printed `R²` says nothing about real vessels.
- Trains on first import if no pickle exists and writes `analytics/models/*.pkl` at runtime.
- `confidence_interval` is `mean ± 2σ` across tree predictions. That is tree disagreement, not a calibrated interval; `confidence_score = 1 - std/mean` is not a probability.
- `weather_impact_pct = wind*0.3 + wave*2` is an arbitrary constant formula.
- `predict()` silently defaults missing inputs (wind 0, wave 0.5, displacement 0.8, trim 0.3, distance 300).
- No vessel specifications, draft, power curve or fuel properties are used; one global model for all vessel types.

### ETA (`ETAPredictionModel`)
Heuristic penalties (`0.15 * (wind/40)²`, `0.025 * wave`, `0.8 * current`) with `max(4, speed)` floor and an invented uncertainty term. Single `distance_nm` input: no route, no position source, no great-circle vs navigable distinction.

### Performance engine
- Returns `performance_compliance=100` when there is no data (`performance_engine.py`, first return).
- `calculate_health_score`: `operational_score=85` default, `fuel_score=18.0` when no benchmark, fixed weather scores, a flat 2%-per-Beaufort speed adjustment, and recommendations chosen by array index. Components are weighted guesses, not derived from data.
- Verify which of these functions the rewritten `analytics.py` still calls.

### Optimization (`routes/optimization.py`)
- Distances and waypoints are **great-circle** (`_haversine`, "simplified great-circle"): straight lines that can cross land. No navigable routing, traffic separation schemes, canals or restricted areas.
- "Savings" are fixed percentages and multipliers (`0.88 ** 3`, `0.03`, `0.015`, `* 1.2`, `* 0.5`), not comparisons between computed scenarios.
- Route alternatives derive from the base distance (`generate_routes`), not from real route options. (Lines 498-545 skimmed, not fully traced.)

### Copilot (`routes/copilot.py`)
- Context stuffing, not tools: records are serialised into a system prompt; the model computes and interprets.
- Rule-based fallback returns canned generic maritime advice (e.g. current systems "ENSO, Gulf Stream, Kuroshio") with no data behind it.
- No citations; no tool layer; no tenant check on `vessel_id` / `voyage_id`.

## 6. External integration gaps

| Capability | State |
|---|---|
| Weather (Open-Meteo) | Works; timeouts only. **No** retry, cache, response validation, freshness timestamps, attribution, stale/partial status, or historical storage. |
| Marine / currents | Same client; failures become zeros (P0-5). |
| AIS | **Absent** (no model fields for MMSI/COG/heading/nav status, no adapter). `VesselPosition` exists but is fed from noon reports. |
| Port data | Absent. |
| Routing engine | Absent. |
| Background jobs | Absent (no Celery/Redis/scheduler). |

## 7. Database weaknesses

- No organisation table or FK on any operational model.
- `String(36)` UUID PKs everywhere (acceptable; needs consistent FK + index review on `organization_id`).
- No migration history; `schema.sql` and models can diverge silently.
- Soft-validity (CHECK constraints for lat/lon ranges, non-negative fuel, date ordering) not found in the models read; not exhaustively reviewed.
- `schema.sql` still seeds demo vessels.

## 8. Frontend (from the previous audit, summarised)

`tsc` and `vite build` pass. Design system, tokens and kit are good and should be preserved. Open items: clickable table rows are not keyboard-operable, form border contrast ~1.6:1, command-palette ARIA, dead legacy CSS/Tailwind palette, off-scale type sizes. Frontend pages that consume weather/optimization/copilot will need to render the new status, freshness and "unavailable" states once the backend stops returning zeros and invented values.

## 9. Not inspected (do not assume)

`reports.py` PDF layout internals; `voyages.py` bodies beyond the query at `:40`; `claims.py` detection thresholds; frontend `services/api.ts` and per-page data mapping; Dockerfiles/nginx beyond a skim; `.env.example` contents (not opened); production database contents.

## 10. Recommended changes (order of work)

1. **Tests first:** add a pytest harness and a *characterisation test* that demonstrates the cross-tenant leak (P0-1), so the fix is provable.
2. **Alembic** baseline + additive migrations; stop relying on `create_all` outside tests/dev.
3. **Organisations:** `organizations`, `organization_members`, `organization_id` on operational models; backfill migration; centralized `tenant` helpers; org claim in JWT validated against membership on every request; audit log.
4. **Stop fabricating:** remove the random "0.25° enhancement"; replace `or 0` with explicit `None` + availability status.
5. **Ingestion + provenance + data quality** on the same models.
6. **Provider interfaces**, retry/cache/freshness, AIS adapter interface.
7. **Fuel:** physics baseline, vessel calibration, ML only with real data and time-based validation.
8. ETA/routing, anomaly detection, maintenance, tool-based Copilot, frontend onboarding.

## 11. Open questions for the product owner

- Is there a **production database with real user data**? The org backfill migration must be designed against it (and run only with your approval).
- Is a **paid AIS / routing provider** available? Without credentials only the interface and a non-live test adapter can be built.
- Is there any **real historical noon-report data** for calibration and validation? Without it, only the physics baseline can be honestly shipped.
