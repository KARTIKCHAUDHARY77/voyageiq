"""
Cross-tenant isolation (audit finding P0-1).

Every test asserts the SECURE behaviour: Company B must not see or change
Company A's data. They were written first, as strict xfails that failed for the
right reasons (foreign vessel read 200, foreign voyage created 201, ...), and the
markers were removed when routes were scoped by organization.

A record that belongs to another organization must look like it does not exist
(404), never "forbidden", so ids cannot be used to probe another company.
"""

VESSEL = {"name": "MV Alpha", "imo_number": "9000001", "vessel_type": "Bulk Carrier"}


def _vessel(client, headers, **overrides):
    resp = client.post("/api/vessels", json={**VESSEL, **overrides}, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["id"]


def _voyage(client, headers, vessel_id, number="V-001"):
    resp = client.post("/api/voyages", headers=headers, json={
        "vessel_id": vessel_id, "voyage_number": number,
        "departure_port": "Singapore", "arrival_port": "Rotterdam"})
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["id"]


# --- Control: proves the harness works, so the xfails below fail for the right reason ---

def test_owner_can_read_own_data(client, two_companies):
    vessel_id = _vessel(client, two_companies["a"])
    voyage_id = _voyage(client, two_companies["a"], vessel_id)
    assert client.get(f"/api/vessels/{vessel_id}", headers=two_companies["a"]).status_code == 200
    assert client.get(f"/api/voyages/{voyage_id}", headers=two_companies["a"]).status_code == 200


def test_unauthenticated_requests_are_rejected(client):
    assert client.get("/api/vessels").status_code == 401
    assert client.get("/api/voyages").status_code == 401


# --- Isolation requirements ---

def test_other_company_cannot_read_vessel(client, two_companies):
    vessel_id = _vessel(client, two_companies["a"])
    assert client.get(f"/api/vessels/{vessel_id}", headers=two_companies["b"]).status_code == 404


def test_vessel_list_excludes_other_companies(client, two_companies):
    _vessel(client, two_companies["a"])
    resp = client.get("/api/vessels", headers=two_companies["b"])
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["vessels"] == [] and body["total"] == 0


def test_other_company_cannot_modify_vessel(client, two_companies):
    vessel_id = _vessel(client, two_companies["a"])
    resp = client.put(f"/api/vessels/{vessel_id}", json={"name": "Hijacked"}, headers=two_companies["b"])
    assert resp.status_code in (403, 404)
    assert client.get(f"/api/vessels/{vessel_id}", headers=two_companies["a"]).get_json()["name"] == "MV Alpha"


def test_other_company_cannot_create_voyage_on_foreign_vessel(client, two_companies):
    vessel_id = _vessel(client, two_companies["a"])
    resp = client.post("/api/voyages", headers=two_companies["b"], json={
        "vessel_id": vessel_id, "voyage_number": "B-001",
        "departure_port": "X", "arrival_port": "Y"})
    assert resp.status_code in (403, 404)


def test_other_company_cannot_read_voyage(client, two_companies):
    voyage_id = _voyage(client, two_companies["a"], _vessel(client, two_companies["a"]))
    assert client.get(f"/api/voyages/{voyage_id}", headers=two_companies["b"]).status_code == 404


def test_other_company_cannot_read_noon_reports(client, two_companies):
    voyage_id = _voyage(client, two_companies["a"], _vessel(client, two_companies["a"]))
    resp = client.get(f"/api/voyages/{voyage_id}/noon-reports", headers=two_companies["b"])
    assert resp.status_code == 404


def test_other_company_cannot_file_claim_on_foreign_voyage(client, two_companies):
    voyage_id = _voyage(client, two_companies["a"], _vessel(client, two_companies["a"]))
    resp = client.post("/api/claims", headers=two_companies["b"], json={
        "voyage_id": voyage_id, "claim_type": "speed",
        "description": "Speed below charter party", "estimated_impact_usd": 1})
    assert resp.status_code in (403, 404)


def test_voyage_numbers_do_not_collide_across_companies(client, two_companies):
    """Company B must be able to use a voyage number Company A already used."""
    _voyage(client, two_companies["a"], _vessel(client, two_companies["a"]), number="2026-01")
    own_vessel = _vessel(client, two_companies["b"], imo_number="9000002", name="MV Beta")
    resp = client.post("/api/voyages", headers=two_companies["b"], json={
        "vessel_id": own_vessel, "voyage_number": "2026-01",
        "departure_port": "X", "arrival_port": "Y"})
    assert resp.status_code == 201
