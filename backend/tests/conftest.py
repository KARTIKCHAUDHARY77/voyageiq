"""
Test harness.

Settings are exported *before* the app is imported because config.py reads the
environment at import time. Each test gets an empty database.
"""
import os
import tempfile
from datetime import datetime

_DB_DIR = tempfile.mkdtemp(prefix="voyageiq-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_DIR}/test.db"
os.environ["SECRET_KEY"] = "t" * 48
os.environ["JWT_SECRET_KEY"] = "j" * 48
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["ALLOW_REGISTRATION"] = "true"
os.environ["FLASK_ENV"] = "development"

import pytest  # noqa: E402

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import Organization, OrganizationMember, User  # noqa: E402
from app.tenancy import current_org_id, tenant_required  # noqa: E402
from flask import Blueprint, g, jsonify  # noqa: E402
from app.security import limiter  # noqa: E402

PASSWORD = "correct-horse-battery-1"


@pytest.fixture(scope="session")
def app():
    application = create_app("development")
    application.config["TESTING"] = True

    # Test-only routes that exercise the tenant decorator on its own.
    probe = Blueprint("probe", __name__)

    @probe.route("/_probe/read")
    @tenant_required("read")
    def probe_read():
        return jsonify({"org": current_org_id(), "role": g.tenant.role})

    @probe.route("/_probe/fleet-write", methods=["POST"])
    @tenant_required("fleet:write")
    def probe_write():
        return jsonify({"ok": True})

    application.register_blueprint(probe)
    limiter.enabled = False
    return application


@pytest.fixture(autouse=True)
def _clean_db(app):
    with app.app_context():
        db.drop_all()
        db.create_all()
    yield
    with app.app_context():
        db.session.remove()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    """Create a user who is a member of the organization named `company`.

    The organization is created on first use, so two users with the same company
    name share one organization and different names are different organizations.
    `role` is an organization role; the legacy name "manager" means fleet_manager.
    Returns the user id.
    """
    def _make(email, company, role="manager", status="active"):
        org_role = {"manager": "fleet_manager"}.get(role, role)
        with app.app_context():
            user = User(email=email, full_name=email.split("@")[0], company_name=company)
            user.set_password(PASSWORD)
            org = Organization.query.filter_by(name=company).first()
            if org is None:
                org = Organization(name=company)
                db.session.add(org)
            db.session.add(user)
            db.session.flush()
            db.session.add(OrganizationMember(
                organization_id=org.id, user_id=user.id, role=org_role, status=status,
                joined_at=datetime.utcnow()))
            db.session.commit()
            return user.id
    return _make


@pytest.fixture
def org_id(app):
    def _org_id(company):
        with app.app_context():
            return Organization.query.filter_by(name=company).first().id
    return _org_id


@pytest.fixture
def login(client):
    def _login(email):
        resp = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert resp.status_code == 200, resp.get_json()
        return {"Authorization": f"Bearer {resp.get_json()['access_token']}"}
    return _login


@pytest.fixture
def two_companies(make_user, login):
    """Company A and Company B, each with a fleet manager who is signed in."""
    make_user("manager@company-a.test", "Company A")
    make_user("manager@company-b.test", "Company B")
    return {"a": login("manager@company-a.test"), "b": login("manager@company-b.test")}
