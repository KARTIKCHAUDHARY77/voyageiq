# Implementation progress

Baseline: GitHub `main` @ `5bd4dc0`. Working branch: `audit/technical-baseline` (not yet committed).

## Milestone 1 — Repository audit and technical baseline: done
- `docs/TECHNICAL_AUDIT.md` written (P0–P3 findings with `file:line` evidence).
- Test harness added and verified (below). Acceptance: tests run reproducibly on Python 3.11 with the pinned requirements.

## Milestone 2 — Multi-tenancy: done (acceptance: two organizations are isolated end to end)

| Step | State |
|---|---|
| 1. pytest harness + failing isolation tests (proof of P0-1) | done |
| 2. Alembic baseline; `create_all()` off outside dev/tests; all deploy paths run `start.sh` | done, verified on Postgres 16 |
| 3. `organizations`, `organization_members`, `audit_logs`, `organization_id` columns (migration `c0e6cdc3a6e2`) | done, verified on Postgres 16 (up, no drift, down, up) |
| 4. Tenant context: org claim in the JWT re-checked against the database each request, roles, org switching, registration creates an organization (`app/tenancy.py`) | done |
| 5. Every data route scoped by organization; nested references validated; IMO and voyage number unique per organization; `organization_id NOT NULL` (migration `dfb40a137b82`) | done, verified on Postgres 16 |
| 6. Audit log on writes; xfail markers removed; guard test for unprotected routes | done |

Remaining for the *milestone's wider exit condition* ("onboard users"): organization member management
(invite, change role, suspend) and organization settings endpoints and screens. They use `org:manage`, which
is defined but unused. They are scheduled with the frontend administration work (Milestone 10).

## Data honesty (first part of Milestones 4-5): done on `feature/data-honesty`

Scope: stop turning missing information into values. This is groundwork, not the full ingestion
and data-quality milestones (those are still to do: provenance, field mapping, duplicate and outlier
detection, quality dashboard, provider interfaces, retries and caching, AIS).

| Change | Where |
|---|---|
| Weather values are `None` when the provider gave none; `data_status` (available / partial / stale / unavailable) and `provider` on every response; "current" = nearest hour, stale readings not used | `app/services/weather_data.py`, `routes/weather.py` |
| Failed provider requests never produce "favourable" advice or a risk level | same |
| Route risk states it samples a great-circle line, not a navigable route; overall risk is `null` when no point could be assessed | `routes/weather.py` |
| Random "0.25° enhancement" and `/grid-enhance` removed | `routes/weather.py`, `frontend/src/services/api.ts` |
| Beaufort scale covers force 0-12 | `weather_data.py` |
| What-if calculators and forecast require their inputs | `routes/weather.py` |
| `noon_reports.report_time` nullable; missing time stored as NULL (migration `b7e2c91a40d3`) | `models.py`, `routes/voyages.py`, `routes/uploads.py` |
| A real 0 is no longer reported as unknown (61 serializer fields) | `models.py` |
| Weather page shows "No assessment" / data status instead of a blank badge | `WeatherIntelligencePage.tsx` |

Verification: 107 backend tests (54 new: 20 weather-service unit tests, 24 route tests with simulated
provider failures); migration `b7e2c91a40d3` verified on PostgreSQL 16 (upgrade, no drift, downgrade,
re-upgrade); frontend `tsc --noEmit` and `vite build` pass. The frontend was not run in a browser.

### How to run the tests (matches production, Python 3.11.9)
```
cd backend
docker run --rm -v "$PWD":/app -v voyageiq-pipcache:/root/.cache/pip -w /app python:3.11-slim \
  sh -c "pip install -q -r requirements-dev.txt && python -m pytest"
```
`pytest --runxfail` shows the isolation leaks as real failures.

### Step 2 verification (Postgres 16, empty database)
`flask db upgrade` created 12 tables; `flask db check` reported no drift; `flask db downgrade base`
left only `alembic_version`; re-upgrade worked. The production Dockerfile booted from an empty database
(`start.sh`: migrate, bootstrap, gunicorn), created the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, and
`/api/health` answered. Decision: no production database exists yet, so no backfill is needed for organizations.

### Result at end of Milestone 2
`53 passed`: 3 migration, 14 tenancy, 10 core isolation (2 of them controls) and 26 route-level tests.
The route guard was mutation-checked: removing one decorator makes it fail and name the route.

### Earlier result (before routes were scoped)
`5 passed, 8 xfailed` (3 migration tests, 2 controls, 8 isolation tests marked xfail). With `--runxfail`: 8 failed, each for the intended reason:
foreign vessel read 200, vessel list shows other company's fleet, foreign vessel modified 200,
voyage created on foreign vessel 201, foreign voyage read 200, foreign noon reports 200,
claim filed on foreign voyage 201, voyage number collides across companies 409.

### Test-env note
`backend/requirements-dev.txt` adds only `pytest==8.2.2`. Application dependencies are unchanged.
