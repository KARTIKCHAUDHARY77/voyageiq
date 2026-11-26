"""
Test harness.

Settings are exported *before* the app is imported because config.py reads the
environment at import time. Each test gets an empty database.
"""
import os
import tempfile

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
from app.models import User  # noqa: E402
from app.security import limiter  # noqa: E402

PASSWORD = "correct-horse-battery-1"


@pytest.fixture(scope="session")
def app():
    application = create_app("development")
    application.config["TESTING"] = True
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
    """Create a user belonging to `company` and return their id.

    This is the single place that knows how a user is attached to a company.
    When organizations are introduced, only this fixture has to change.
    """
    def _make(email, company, role="manager"):
        with app.app_context():
            user = User(email=email, full_name=email.split("@")[0],
                        company_name=company, role=role)
            user.set_password(PASSWORD)
            db.session.add(user)
            db.session.commit()
            return user.id
    return _make


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
