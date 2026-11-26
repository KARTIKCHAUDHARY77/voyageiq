# Deploy checklist for the security-hardening release

The backend now fails closed. Complete steps 1-3 on the backend host (Railway or Render, whichever serves your API) **before** merging to `main`, or the first deploy will exit at startup.

## 0. Production database (new in this release)

The schema is now created by Alembic migrations, not by the app at startup. `start.sh` runs `flask db upgrade`, then `flask bootstrap`, then gunicorn, so an **empty** PostgreSQL database becomes a working one on first start.

**You provision the database** (this needs your hosting account; it cannot be done from the repository):

- **Render:** `render.yaml` already declares `voyageiq-db` and wires `DATABASE_URL` to it. Deploying the Blueprint creates it.
- **Railway (or any host):** add a PostgreSQL service and set the backend's `DATABASE_URL` to its connection string.

Then deploy. Check the logs for `Running upgrade -> aa5b766d45f7, baseline schema`, then call `/api/health`.

Notes:

- Run **one** backend instance for the first deploy, so two replicas do not migrate at the same time.
- A database created by the old `create_all()` already has the tables, so `flask db upgrade` would fail with "relation already exists". If (and only if) it has **every** table the models define, including `token_blocklist`, mark it as migrated with `flask db stamp head` (once, from `backend/`, with `FLASK_APP=app:create_app`). If any table is missing, stamping would hide that. Do not stamp a database with real data without checking it first.
- Never use `SQLite` in production. It is only the fallback when `DATABASE_URL` is unset.
- To change the schema: edit `models.py`, run `flask db migrate -m "what changed"`, **read the generated file**, commit it. `tests/test_migrations.py` fails if models and migrations disagree.

## 1. Set backend environment variables

| Variable | Value |
| --- | --- |
| `FLASK_ENV` | `production` |
| `SECRET_KEY` | new random string (see below) |
| `JWT_SECRET_KEY` | a different new random string |
| `DATABASE_URL` | your existing Postgres URL (unchanged) |
| `CORS_ORIGINS` | your Vercel production URL(s), comma separated, no trailing slash |
| `ADMIN_EMAIL` | your login email |
| `ADMIN_PASSWORD` | a strong one-time password: 10+ chars, letters and numbers |
| `OPENAI_API_KEY` | optional |

Generate each secret on your own machine and paste it straight into the host dashboard. Do not paste secrets into chat or commit them.

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Leave `SEED_DEMO_DATA` and `ALLOW_REGISTRATION` unset (both default to off in production).

## 2. Check the start command

Use `sh start.sh` (gunicorn) from the `backend/` folder. `python run.py` is for local development only and binds to 127.0.0.1.

## 3. Test the branch before merging

Deploy this branch to a staging service or a copy of your database if you can. The checks below cover the main behaviours.

```bash
API=https://YOUR-BACKEND-URL
curl -s $API/api/health                                   # {"status":"healthy"}
curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@voyageiq.com","password":"password123"}'   # must be 401
curl -s -o /dev/null -w '%{http_code}\n' $API/api/vessels # must be 401
```

Then sign in on the site with `ADMIN_EMAIL` / `ADMIN_PASSWORD` and open the dashboard, a vessel and a noon-report upload.

## 4. Merge and verify

1. Merge the branch to `main`. Vercel and the backend host redeploy.
2. Sign in, then remove `ADMIN_PASSWORD` from the backend environment.
3. Create accounts for your team from the admin side. Public signup is closed.
4. Change the admin password via `PUT /api/auth/change-password` if you want one that never sat in an environment variable.

## 5. Rollback

If the backend will not start, read its logs. A `RuntimeError: SECRET_KEY must be set` means step 1 is incomplete. To roll back, redeploy the previous commit (`257fca5`); data is untouched. The only schema change is a new `token_blocklist` table, which is created automatically and is harmless to old code.

## 6. Afterwards

- Rotate the OpenAI key if there is any chance it was ever committed.
- Run `pip-audit -r backend/requirements.txt` and `npm audit` in `frontend/`.
- The remaining known gaps (no per-company data isolation, tokens in localStorage) are listed in the README.
