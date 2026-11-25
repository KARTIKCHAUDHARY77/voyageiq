"""
Shared security helpers: rate limiting, role checks, input validation,
and the JWT revocation list.
"""
import re
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .extensions import db

# Rate limiting. Storage is per-process memory unless RATELIMIT_STORAGE_URI
# points at Redis, so with several workers the effective limit is per worker.
limiter = Limiter(key_func=get_remote_address, default_limits=["300 per minute"])

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")

# Roles a user may pick at self-registration. Privileged roles are never
# assignable through the public API.
SELF_REGISTER_ROLE = "operator"

# Which roles may change fleet master data and claims.
FLEET_WRITE_ROLES = {"admin", "manager"}
CLAIM_WRITE_ROLES = {"admin", "manager", "analyst"}


def normalize_email(value):
    return (value or "").strip().lower()


def is_valid_email(value):
    return bool(value) and len(value) <= 254 and bool(EMAIL_RE.match(value))


def password_problem(password, email=""):
    """Return a human-readable problem with the password, or None if it is OK."""
    if not isinstance(password, str) or len(password) < 10:
        return "Password must be at least 10 characters."
    if len(password) > 128:
        return "Password must be at most 128 characters."
    if not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
        return "Password must contain at least one letter and one number."
    local = (email or "").split("@")[0]
    if local and len(local) >= 4 and local.lower() in password.lower():
        return "Password must not contain your email name."
    return None


def roles_required(*roles):
    """Allow the request only if the signed-in user has one of the given roles.

    The role is read from the database on every request, not from the token,
    so demoting or deactivating a user takes effect immediately.
    """
    allowed = set(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            from .models import User
            user = db.session.get(User, get_jwt_identity())
            if not user or not user.is_active:
                return jsonify({"error": "Account unavailable"}), 401
            if user.role not in allowed:
                return jsonify({"error": "You do not have permission to do this"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def csv_safe(value):
    """Neutralise spreadsheet formula injection in exported cells."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value
