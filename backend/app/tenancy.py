"""
Tenant context and authorization.

Every route that touches company-owned data goes through `tenant_required`.

How a request is authorised:
  1. The access token proves who the user is and names the organization they are
     currently working in (the `org` claim).
  2. The claim is NOT trusted by itself. On every request the membership is read
     from the database: it must exist, be active, and the organization must be
     active. Removing or suspending a member therefore takes effect immediately.
  3. The member's role must allow the permission the route asks for.
  4. All queries then go through `scoped_query` / `get_scoped`, which add the
     organization filter. A client-supplied organization id is never used.

A record that belongs to another organization is reported as "not found" (404),
never "forbidden", so ids cannot be used to discover another company's data.

Platform administrators (`User.role == 'admin'`) get no special access to
customer data through the API.
"""
from dataclasses import dataclass
from functools import wraps

from flask import g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from .extensions import db

ALL_ROLES = frozenset({'owner', 'admin', 'fleet_manager', 'analyst', 'operator', 'viewer'})

# permission -> roles that have it
PERMISSIONS = {
    'read': ALL_ROLES,
    'fleet:write': frozenset({'owner', 'admin', 'fleet_manager'}),       # vessels
    'voyage:write': frozenset({'owner', 'admin', 'fleet_manager'}),      # voyages
    'report:write': frozenset({'owner', 'admin', 'fleet_manager', 'analyst', 'operator'}),  # noon reports, imports
    'claim:write': frozenset({'owner', 'admin', 'fleet_manager', 'analyst'}),
    'org:manage': frozenset({'owner', 'admin'}),                         # members, settings
    'audit:read': frozenset({'owner', 'admin'}),
}


@dataclass(frozen=True)
class TenantContext:
    user_id: str
    org_id: str
    role: str


def _deny(message, status):
    return jsonify({'error': message}), status


def resolve_context():
    """Return a TenantContext, or an error response tuple. Needs a verified JWT."""
    from .models import Organization, OrganizationMember, User

    user = db.session.get(User, get_jwt_identity())
    if not user or not user.is_active:
        return _deny('Account unavailable', 401)

    org_id = get_jwt().get('org')
    if not org_id:
        return _deny('No active organization. Sign in again or switch organization.', 403)

    member = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user.id, status='active').first()
    org = db.session.get(Organization, org_id)
    if member is None or org is None or org.status != 'active':
        return _deny('You do not have access to this organization', 403)

    return TenantContext(user_id=user.id, org_id=org_id, role=member.role)


def tenant_required(permission='read'):
    """Require a signed-in member of the token's organization who holds `permission`."""
    allowed = PERMISSIONS[permission]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            ctx = resolve_context()
            if not isinstance(ctx, TenantContext):
                return ctx
            if ctx.role not in allowed:
                return _deny('You do not have permission to do this', 403)
            g.tenant = ctx
            return fn(*args, **kwargs)
        # Lets tests (and reviewers) verify that every data route is protected.
        wrapper.tenant_permission = permission
        return wrapper
    return decorator


def current_org_id():
    return g.tenant.org_id


def scoped_query(model):
    """Query restricted to the current organization. Use instead of `Model.query`."""
    return model.query.filter(model.organization_id == g.tenant.org_id)


def get_scoped(model, record_id):
    """The record with this id in the current organization, or None."""
    if not record_id:
        return None
    return scoped_query(model).filter(model.id == record_id).first()


def audit(action, entity_type=None, entity_id=None, organization_id=None, user_id=None, **details):
    """Queue an audit-log row in the current transaction (the caller commits)."""
    from .models import AuditLog

    tenant = getattr(g, 'tenant', None)
    db.session.add(AuditLog(
        organization_id=organization_id or (tenant.org_id if tenant else None),
        user_id=user_id or (tenant.user_id if tenant else None),
        action=action, entity_type=entity_type, entity_id=entity_id,
        details=details or None,
        ip_address=(request.remote_addr or '')[:64] if request else None,
    ))
