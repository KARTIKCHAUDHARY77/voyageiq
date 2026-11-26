"""
Tenant isolation across every route family, roles on the real routes, per-organization
uniqueness, audit logging, and a guard that fails if a route forgets tenant protection.
"""
import io

import pytest

from app.models import AuditLog, Vessel

VESSEL = {"name": "MV Alpha", "imo_number": "9000001", "vessel_type": "Bulk Carrier",
          "warranted_speed": 14, "warranted_consumption": 28}
NOON = {"report_date": "2026-03-01", "latitude": 1.5, "longitude": 103.8,
        "speed_over_ground": 13.5, "me_lsfo": 27.0, "distance_noon_to_noon": 320, "wind_force_bft": 3}
CSV = b"date,lat,lon,sog,dist\n2026-03-01,1.5,103.8,13.5,320\n2026-03-02,2.5,104.8,13.1,314\n"


def _vessel(client, headers, **kw):
    resp = client.post("/api/vessels", json={**VESSEL, **kw}, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["id"]


def _voyage(client, headers, vessel_id, number="V-1"):
    resp = client.post("/api/voyages", headers=headers, json={
        "vessel_id": vessel_id, "voyage_number": number,
        "departure_port": "Singapore", "arrival_port": "Rotterdam"})
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["id"]


def _noon(client, headers, voyage_id, **kw):
    return client.post(f"/api/voyages/{voyage_id}/noon-reports", json={**NOON, **kw}, headers=headers)


def _upload(client, headers, vessel_id, voyage_id=None):
    data = {"file": (io.BytesIO(CSV), "report.csv"), "vessel_id": vessel_id}
    if voyage_id:
        data["voyage_id"] = voyage_id
    return client.post("/api/uploads/report", data=data, headers=headers, content_type="multipart/form-data")


@pytest.fixture
def fleet(client, two_companies):
    """Company A with a vessel, a voyage and one noon report."""
    vessel_id = _vessel(client, two_companies["a"])
    voyage_id = _voyage(client, two_companies["a"], vessel_id)
    assert _noon(client, two_companies["a"], voyage_id).status_code == 201
    return {"vessel": vessel_id, "voyage": voyage_id, **two_companies}


# --- Guard: no data route may exist without tenant protection ---

PUBLIC_OR_USER_LEVEL = {
    "auth.login", "auth.register", "auth.refresh", "auth.logout", "auth.get_me",
    "auth.change_password", "auth.switch_organization", "health", "static",
}


def test_every_api_route_is_tenant_protected(app):
    """Adding a route without @tenant_required fails here instead of leaking data."""
    unprotected = []
    for rule in app.url_map.iter_rules():
        endpoint = rule.endpoint
        if endpoint in PUBLIC_OR_USER_LEVEL or endpoint.startswith("probe."):
            continue
        view = app.view_functions[endpoint]
        if getattr(view, "tenant_permission", None) is None:
            unprotected.append(f"{rule.rule} ({endpoint})")
    assert unprotected == [], f"Routes without @tenant_required: {unprotected}"


# --- Isolation: noon reports, uploads, analytics, reports, claims, copilot ---

def test_other_company_cannot_add_noon_reports(client, fleet):
    assert _noon(client, fleet["b"], fleet["voyage"]).status_code == 404


def test_other_company_cannot_upload_to_foreign_vessel(client, fleet):
    assert _upload(client, fleet["b"], fleet["vessel"]).status_code == 404


def test_other_company_cannot_attach_upload_to_foreign_voyage(client, fleet):
    own_vessel = _vessel(client, fleet["b"], imo_number="9000002", name="MV Beta")
    assert _upload(client, fleet["b"], own_vessel, fleet["voyage"]).status_code == 404


def test_upload_voyage_must_belong_to_the_chosen_vessel(client, fleet):
    other_vessel = _vessel(client, fleet["a"], imo_number="9000003", name="MV Gamma")
    assert _upload(client, fleet["a"], other_vessel, fleet["voyage"]).status_code == 400


def test_other_company_cannot_read_or_confirm_foreign_upload(client, fleet):
    resp = _upload(client, fleet["a"], fleet["vessel"], fleet["voyage"])
    assert resp.status_code == 200, resp.get_json()
    upload_id = resp.get_json()["upload_id"]
    assert client.get(f"/api/uploads/{upload_id}", headers=fleet["b"]).status_code == 404
    assert client.post(f"/api/uploads/{upload_id}/confirm", json={}, headers=fleet["b"]).status_code == 404


def test_colleague_in_same_company_can_read_the_upload_and_confirm_it(client, fleet, make_user, login):
    """Uploads belong to the organization, not just to the person who made them."""
    make_user("second@company-a.test", "Company A", role="analyst")
    resp = _upload(client, fleet["a"], fleet["vessel"], fleet["voyage"])
    upload_id = resp.get_json()["upload_id"]
    colleague = login("second@company-a.test")
    assert client.get(f"/api/uploads/{upload_id}", headers=colleague).status_code == 200
    confirm = client.post(f"/api/uploads/{upload_id}/confirm", json={}, headers=colleague)
    assert confirm.status_code == 200, confirm.get_json()
    assert confirm.get_json()["saved_records"] == 2


def test_imported_noon_reports_belong_to_the_importing_organization(client, fleet, app):
    upload_id = _upload(client, fleet["a"], fleet["vessel"], fleet["voyage"]).get_json()["upload_id"]
    assert client.post(f"/api/uploads/{upload_id}/confirm", json={}, headers=fleet["a"]).status_code == 200
    reports = client.get(f"/api/voyages/{fleet['voyage']}/noon-reports", headers=fleet["a"]).get_json()
    assert reports["total"] == 3                      # 1 entered by hand + 2 imported
    assert client.get(f"/api/voyages/{fleet['voyage']}/noon-reports", headers=fleet["b"]).status_code == 404


def test_dashboard_only_counts_own_data(client, fleet):
    own = client.get("/api/analytics/dashboard", headers=fleet["a"]).get_json()
    other = client.get("/api/analytics/dashboard", headers=fleet["b"]).get_json()
    assert own["active_vessels"] == 1 and own["report_count"] == 1
    assert other["active_vessels"] == 0 and other["report_count"] == 0
    assert other["total_distance_nm"] is None          # absent, not zero


def test_fuel_analytics_for_a_foreign_vessel_is_not_found(client, fleet):
    assert client.get(f"/api/analytics/fuel?vessel_id={fleet['vessel']}", headers=fleet["b"]).status_code == 404
    assert client.get(f"/api/analytics/fuel?vessel_id={fleet['vessel']}", headers=fleet["a"]).status_code == 200


def test_report_export_for_a_foreign_voyage_is_not_found(client, fleet):
    url = f"/api/reports/generate/{fleet['voyage']}?format=csv"
    assert client.get(url, headers=fleet["b"]).status_code == 404
    assert client.get(url, headers=fleet["a"]).status_code == 200


def test_claim_totals_do_not_include_other_companies(client, fleet):
    created = client.post("/api/claims", headers=fleet["a"], json={
        "voyage_id": fleet["voyage"], "claim_type": "speed",
        "description": "Below warranted speed", "estimated_impact_usd": 12345})
    assert created.status_code == 201
    claim_id = created.get_json()["id"]
    assert client.get("/api/claims", headers=fleet["a"]).get_json()["open_exposure_usd"] == 12345
    other = client.get("/api/claims", headers=fleet["b"]).get_json()
    assert other["open_exposure_usd"] == 0 and other["claims"] == []
    assert client.get(f"/api/claims/{claim_id}", headers=fleet["b"]).status_code == 404
    assert client.put(f"/api/claims/{claim_id}/status", json={"status": "closed"}, headers=fleet["b"]).status_code == 404


def test_claim_detection_on_a_foreign_voyage_is_not_found(client, fleet):
    assert client.post(f"/api/claims/detect/{fleet['voyage']}", headers=fleet["b"]).status_code == 404


def test_copilot_will_not_use_a_foreign_vessel_as_context(client, fleet):
    resp = client.post("/api/copilot/chat", headers=fleet["b"],
                       json={"message": "Summarise this vessel", "vessel_id": fleet["vessel"]})
    assert resp.status_code == 404


def test_copilot_conversations_are_private_to_their_organization(client, fleet):
    resp = client.post("/api/copilot/chat", headers=fleet["a"],
                       json={"message": "Hello", "vessel_id": fleet["vessel"]})
    assert resp.status_code == 200, resp.get_json()
    conversation_id = resp.get_json().get("conversation_id") or resp.get_json()["conversation"]["id"]
    assert client.get(f"/api/copilot/conversations/{conversation_id}", headers=fleet["b"]).status_code == 404
    assert client.get("/api/copilot/conversations", headers=fleet["b"]).get_json()["count"] == 0


# --- Same ship / voyage number in two companies ---

def test_two_companies_can_track_the_same_imo(client, two_companies):
    _vessel(client, two_companies["a"])
    assert client.post("/api/vessels", json=VESSEL, headers=two_companies["b"]).status_code == 201


def test_imo_is_still_unique_within_one_company(client, two_companies):
    _vessel(client, two_companies["a"])
    assert client.post("/api/vessels", json=VESSEL, headers=two_companies["a"]).status_code == 409


def test_voyage_number_is_unique_within_one_company(client, two_companies):
    vessel_id = _vessel(client, two_companies["a"])
    _voyage(client, two_companies["a"], vessel_id, number="2026-01")
    again = client.post("/api/voyages", headers=two_companies["a"], json={
        "vessel_id": vessel_id, "voyage_number": "2026-01", "departure_port": "X", "arrival_port": "Y"})
    assert again.status_code == 409


# --- Roles on the real routes ---

@pytest.mark.parametrize("role, can_create_vessel, can_create_voyage, can_add_noon, can_file_claim", [
    ("owner",         True,  True,  True,  True),
    ("admin",         True,  True,  True,  True),
    ("fleet_manager", True,  True,  True,  True),
    ("analyst",       False, False, True,  True),
    ("operator",      False, False, True,  False),
    ("viewer",        False, False, False, False),
])
def test_role_permissions_on_data_routes(client, make_user, login, fleet, role,
                                         can_create_vessel, can_create_voyage, can_add_noon, can_file_claim):
    make_user(f"{role}@company-a.test", "Company A", role=role)
    h = login(f"{role}@company-a.test")

    def allowed(resp):
        return resp.status_code != 403

    assert allowed(client.post("/api/vessels", json={**VESSEL, "imo_number": "9111111"}, headers=h)) is can_create_vessel
    assert allowed(client.post("/api/voyages", headers=h, json={
        "vessel_id": fleet["vessel"], "voyage_number": f"R-{role}",
        "departure_port": "X", "arrival_port": "Y"})) is can_create_voyage
    assert allowed(_noon(client, h, fleet["voyage"], report_date="2026-04-01")) is can_add_noon
    assert allowed(client.post("/api/claims", headers=h, json={
        "voyage_id": fleet["voyage"], "claim_type": "speed", "description": "x"})) is can_file_claim
    # everyone in the organization may read
    assert client.get(f"/api/vessels/{fleet['vessel']}", headers=h).status_code == 200


# --- Audit trail ---

def test_writes_are_audited_with_organization_and_user(client, fleet, app, org_id):
    with app.app_context():
        actions = {(a.action, a.organization_id) for a in AuditLog.query.all()}
    org_a = org_id("Company A")
    assert ("vessel.created", org_a) in actions
    assert ("voyage.created", org_a) in actions
    assert ("noon_report.created", org_a) in actions
    # Company B only logged in; none of A's data changes may be attributed to B.
    assert not any(org == org_id("Company B") for action, org in actions if not action.startswith("auth."))
    assert ("auth.login", org_id("Company B")) in actions


def test_new_vessel_is_stamped_with_the_callers_organization_not_a_client_value(client, two_companies, app, org_id):
    resp = client.post("/api/vessels", headers=two_companies["a"],
                       json={**VESSEL, "organization_id": org_id("Company B")})
    assert resp.status_code == 201
    with app.app_context():
        assert Vessel.query.one().organization_id == org_id("Company A")
