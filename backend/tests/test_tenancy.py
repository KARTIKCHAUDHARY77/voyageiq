"""
Organization membership, the tenant context in the JWT, and role permissions.
These cover the mechanism; test_tenant_isolation.py covers the data routes.
"""
from datetime import datetime

from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import AuditLog, Organization, OrganizationMember

NEW_USER = {"email": "owner@acme.test", "password": "correct-horse-battery-1",
            "company_name": "Acme Shipping", "full_name": "Ann Owner"}


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Registration and login ---

def test_register_creates_an_organization_owned_by_the_registrant(client, app):
    resp = client.post("/api/auth/register", json=NEW_USER)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["organization"]["name"] == "Acme Shipping"
    assert body["organization"]["role"] == "owner"
    with app.app_context():
        member = OrganizationMember.query.one()
        assert member.role == "owner" and member.status == "active"
        assert AuditLog.query.filter_by(action="organization.created").count() == 1


def test_registering_with_an_existing_company_name_does_not_join_it(client, app):
    client.post("/api/auth/register", json=NEW_USER)
    other = {**NEW_USER, "email": "mallory@evil.test"}
    client.post("/api/auth/register", json=other)
    with app.app_context():
        assert Organization.query.count() == 2          # a second, separate organization
        owners = OrganizationMember.query.filter_by(role="owner").all()
        assert len({m.organization_id for m in owners}) == 2


def test_register_requires_a_company_name(client):
    resp = client.post("/api/auth/register", json={**NEW_USER, "company_name": "  "})
    assert resp.status_code == 400


def test_login_returns_the_active_organization(client, make_user):
    make_user("a@x.test", "Company A")
    body = client.post("/api/auth/login", json={"email": "a@x.test", "password": "correct-horse-battery-1"}).get_json()
    assert body["organization"]["name"] == "Company A"
    assert [o["name"] for o in body["organizations"]] == ["Company A"]


def test_login_into_an_organization_you_do_not_belong_to_is_refused(client, make_user, org_id):
    make_user("a@x.test", "Company A")
    make_user("b@x.test", "Company B")
    resp = client.post("/api/auth/login", json={
        "email": "a@x.test", "password": "correct-horse-battery-1", "organization_id": org_id("Company B")})
    assert resp.status_code == 403


# --- Switching organizations ---

def test_switching_to_a_second_membership(client, make_user, app, org_id, login):
    make_user("a@x.test", "Company A")
    make_user("b@x.test", "Company B")
    with app.app_context():                              # a@x.test also joins Company B as analyst
        from app.models import User
        uid = User.query.filter_by(email="a@x.test").first().id
        db.session.add(OrganizationMember(organization_id=org_id("Company B"), user_id=uid, role="analyst", joined_at=datetime.utcnow()))
        db.session.commit()
    headers = login("a@x.test")
    assert client.get("/_probe/read", headers=headers).get_json()["role"] == "fleet_manager"

    resp = client.post("/api/auth/switch-organization", headers=headers,
                       json={"organization_id": org_id("Company B")})
    assert resp.status_code == 200
    switched = _bearer(resp.get_json()["access_token"])
    probe = client.get("/_probe/read", headers=switched).get_json()
    assert probe == {"org": org_id("Company B"), "role": "analyst"}


def test_cannot_switch_into_a_foreign_organization(client, make_user, org_id, login):
    make_user("a@x.test", "Company A")
    make_user("b@x.test", "Company B")
    resp = client.post("/api/auth/switch-organization", headers=login("a@x.test"),
                       json={"organization_id": org_id("Company B")})
    assert resp.status_code == 403


# --- The membership is re-checked on every request ---

def test_suspending_a_member_cuts_off_their_existing_token_immediately(client, make_user, app, login):
    make_user("a@x.test", "Company A")
    headers = login("a@x.test")
    assert client.get("/_probe/read", headers=headers).status_code == 200
    with app.app_context():
        OrganizationMember.query.one().status = "suspended"
        db.session.commit()
    assert client.get("/_probe/read", headers=headers).status_code == 403


def test_a_suspended_organization_cuts_off_its_members(client, make_user, app, login):
    make_user("a@x.test", "Company A")
    headers = login("a@x.test")
    with app.app_context():
        Organization.query.one().status = "suspended"
        db.session.commit()
    assert client.get("/_probe/read", headers=headers).status_code == 403


def test_org_claim_for_an_organization_the_user_is_not_in_is_rejected(client, make_user, app, org_id):
    """The claim is a hint, not proof: membership is verified against the database."""
    uid = make_user("a@x.test", "Company A")
    make_user("b@x.test", "Company B")
    with app.app_context():
        forged = create_access_token(identity=uid, additional_claims={"org": org_id("Company B")})
    assert client.get("/_probe/read", headers=_bearer(forged)).status_code == 403


def test_token_without_an_organization_is_rejected(client, make_user, app):
    uid = make_user("a@x.test", "Company A")
    with app.app_context():
        bare = create_access_token(identity=uid)
    assert client.get("/_probe/read", headers=_bearer(bare)).status_code == 403


# --- Roles ---

def test_viewer_can_read_but_not_write(client, make_user, login):
    make_user("v@x.test", "Company A", role="viewer")
    headers = login("v@x.test")
    assert client.get("/_probe/read", headers=headers).status_code == 200
    assert client.post("/_probe/fleet-write", headers=headers).status_code == 403


def test_fleet_manager_can_write_fleet_data(client, make_user, login):
    make_user("m@x.test", "Company A", role="fleet_manager")
    assert client.post("/_probe/fleet-write", headers=login("m@x.test")).status_code == 200


def test_every_role_has_a_defined_permission_set():
    from app.models import ORG_ROLES
    from app.tenancy import ALL_ROLES, PERMISSIONS
    assert set(ORG_ROLES) == set(ALL_ROLES)
    assert all(roles <= ALL_ROLES for roles in PERMISSIONS.values())
