# Implementation progress

Baseline: GitHub `main` @ `5bd4dc0`. Working branch: `audit/technical-baseline` (not yet committed).

## Milestone 1 — Repository audit and technical baseline: done
- `docs/TECHNICAL_AUDIT.md` written (P0–P3 findings with `file:line` evidence).
- Test harness added and verified (below). Acceptance: tests run reproducibly on Python 3.11 with the pinned requirements.

## Milestone 2 — Multi-tenancy: in progress (step 1 of ~6 done)

| Step | State |
|---|---|
| 1. pytest harness + failing isolation tests (proof of P0-1) | **done** |
| 2. Alembic baseline migration (no schema change); `create_all()`/bootstrap off outside dev and tests; all deploy paths run `start.sh` | **done**, verified on Postgres 16 and in CI-style tests |
| 3. `organizations`, `organization_members`, `organization_id` on operational models + backfill migration | todo (needs production-data answer, see audit §11) |
| 4. Central tenant helpers; org claim in JWT checked against membership on every request | todo |
| 5. Scope every route and nested reference; per-org uniqueness for IMO and voyage number | todo |
| 6. Audit log; remove `xfail` markers; extend tests to uploads, copilot, analytics, reports | todo |

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

### Current result
`5 passed, 8 xfailed` (3 migration tests, 2 controls, 8 isolation tests marked xfail). With `--runxfail`: 8 failed, each for the intended reason:
foreign vessel read 200, vessel list shows other company's fleet, foreign vessel modified 200,
voyage created on foreign vessel 201, foreign voyage read 200, foreign noon reports 200,
claim filed on foreign voyage 201, voyage number collides across companies 409.

### Test-env note
`backend/requirements-dev.txt` adds only `pytest==8.2.2`. Application dependencies are unchanged.
