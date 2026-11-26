# Security model

## Tenancy

VoyageIQ is multi-tenant. A **customer company is an `Organization`**; every piece of operational data
(vessels, voyages, noon reports, claims, fuel analytics, positions, routes, uploads, copilot
conversations) carries a required `organization_id`. Users reach an organization through an
`OrganizationMember` row that holds their role and status. A user may belong to several organizations.

### How a request is authorised (`backend/app/tenancy.py`)

1. The access token proves the user and names the organization they are working in (`org` claim).
2. The claim is **a hint, not proof.** On every request the membership is read from the database. It must
   exist and be `active`, and the organization must be `active`. Suspending a member or an organization
   cuts off their existing tokens immediately (tested).
3. The member's role must hold the permission the route asks for (table below).
4. Queries go through `scoped_query` / `get_scoped`, which add the organization filter. **A client-supplied
   organization id is never used**; new rows are stamped from the verified context or from their scoped parent.
5. A record of another organization is reported as **404, not 403**, so ids cannot be used to probe other companies.

Platform administrators (`User.role == 'admin'`) get no special access to customer data through the API.

### Roles and permissions

| Permission | owner | admin | fleet_manager | analyst | operator | viewer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| read (all data in the organization) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `fleet:write` (create / edit vessels) | ✔ | ✔ | ✔ |  |  |  |
| `voyage:write` (create / edit voyages) | ✔ | ✔ | ✔ |  |  |  |
| `report:write` (noon reports, imports) | ✔ | ✔ | ✔ | ✔ | ✔ |  |
| `claim:write` | ✔ | ✔ | ✔ | ✔ |  |  |
| `org:manage`, `audit:read` | ✔ | ✔ |  |  |  |  |

`org:manage` and `audit:read` are defined but no routes use them yet (members, settings and audit-log
screens are a later milestone).

### Registration and joining

Registering creates a **new, empty organization** with the registrant as `owner`. Registering with the name
of an existing company does **not** join it. Joining an existing organization will be by invitation only.
Registration is closed by default in production (`ALLOW_REGISTRATION`); a commercial sign-up flow needs it
enabled. This is a product decision, not yet made.

### Guardrails that keep this true

- `tests/test_tenant_routes.py::test_every_api_route_is_tenant_protected` fails if any API route is added
  without `@tenant_required`, and names it.
- `tests/test_tenant_isolation.py` and `tests/test_tenant_routes.py` check, for every route family, that
  Company B cannot read, change, attach to, export, or aggregate Company A's data.
- Database: `organization_id` is `NOT NULL` with a named foreign key on all nine data tables; IMO and voyage
  number are unique **per organization**, not globally.

### Audit log

`audit_logs` is append-only. Recorded: sign-in, organization creation and switching, vessel / voyage /
noon-report / claim / upload creation and changes, and report exports.

## Authentication

Access tokens last 60 minutes, refresh tokens 7 days. Logout and password change revoke tokens through a
database blocklist. Login is rate-limited and takes the same time for unknown emails and wrong passwords.

Known gaps: refresh tokens are not rotated on use; rate limiting is per process unless `RATELIMIT_STORAGE_URI`
points at Redis.

## Not yet covered

External-provider credentials storage, per-organization encryption, file storage isolation (uploads are
parsed in memory and stored as rows, not as files), SSO, and penetration testing.
