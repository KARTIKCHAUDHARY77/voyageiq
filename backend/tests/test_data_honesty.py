"""
Routes must not turn missing information into a value: weather failures, missing report
times, genuine zeros, and what-if calculators that used to assume inputs.
"""
from datetime import datetime, timedelta

import pytest
import requests

from app.models import NoonReport
from app.routes import weather as weather_routes


def _now_stamp():
    return datetime.utcnow().replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


def good_atmosphere(*_a, **_k):
    return {"hourly": {"time": [_now_stamp()], "wind_speed_10m": [30.0],
                       "wind_direction_10m": [250], "precipitation": [0.0]}}


def good_marine(*_a, **_k):
    return {"hourly": {"time": [_now_stamp()], "wave_height": [2.5],
                       "swell_wave_height": [1.1], "ocean_current_velocity": [0.3]}}


def down(*_a, **_k):
    raise requests.ConnectionError("provider unreachable")


@pytest.fixture
def providers(monkeypatch):
    def set_(atmosphere, marine):
        monkeypatch.setattr(weather_routes, "_fetch_atmosphere", atmosphere)
        monkeypatch.setattr(weather_routes, "_fetch_marine", marine)
    return set_


@pytest.fixture
def h(two_companies):
    return two_companies["a"]


# --- Current weather ---

def test_current_weather_with_both_providers_up(client, h, providers):
    providers(good_atmosphere, good_marine)
    body = client.get("/api/weather/current?lat=1.5&lon=103.8", headers=h).get_json()
    assert body["data_status"]["overall"] == "available"
    assert body["beaufort_scale"] == 5 and body["wave_height_m"] == 2.5
    assert body["provider"] == "Open-Meteo"


def test_both_providers_down_is_not_reported_as_favourable_weather(client, h, providers):
    providers(down, down)
    body = client.get("/api/weather/current?lat=1.5&lon=103.8", headers=h).get_json()
    assert body["data_status"]["overall"] == "unavailable"
    assert body["wind_speed_knots"] is None and body["wave_height_m"] is None
    assert body["beaufort_scale"] is None and body["risk_level"] is None
    assert "favourable" not in " ".join(body["recommendations"]).lower()


def test_marine_provider_down_leaves_waves_unknown_not_zero(client, h, providers):
    providers(good_atmosphere, down)
    body = client.get("/api/weather/current?lat=1.5&lon=103.8", headers=h).get_json()
    assert body["data_status"]["overall"] == "partial"
    assert body["wave_height_m"] is None and body["swell_height_m"] is None
    assert body["beaufort_scale"] == 5


def test_provider_returning_garbage_is_unavailable_not_a_server_error(client, h, providers):
    providers(lambda *a, **k: {"unexpected": True}, lambda *a, **k: None)
    resp = client.get("/api/weather/current?lat=1.5&lon=103.8", headers=h)
    assert resp.status_code == 200 and resp.get_json()["data_status"]["overall"] == "unavailable"


# --- Route risk ---

def test_route_risk_with_providers_down_has_no_overall_risk(client, h, providers):
    providers(down, down)
    body = client.get("/api/weather/route-risk?origin_lat=1&origin_lon=103&dest_lat=51&dest_lon=4", headers=h).get_json()
    assert body["data_status"] == "unavailable" and body["points_assessed"] == 0
    assert body["overall_risk_level"] is None and body["max_beaufort"] is None and body["avg_beaufort"] is None
    assert all(z["risk_level"] is None for z in body["risk_zones"])


def test_route_risk_states_it_is_not_a_navigable_route(client, h, providers):
    providers(good_atmosphere, good_marine)
    body = client.get("/api/weather/route-risk?origin_lat=1&origin_lon=103&dest_lat=51&dest_lon=4", headers=h).get_json()
    assert body["route_basis"] == "great_circle_sample" and "not a navigable route" in body["limitations"]
    assert body["points_assessed"] == 5 and body["data_status"] == "available"


# --- Forecast ---

def test_forecast_requires_a_position_instead_of_defaulting_to_0_0(client, h):
    assert client.post("/api/weather/forecast", json={}, headers=h).status_code == 400
    assert client.post("/api/weather/forecast", json={"lat": 10}, headers=h).status_code == 400


def test_forecast_with_providers_down_is_unavailable_and_empty(client, h, monkeypatch):
    monkeypatch.setattr(weather_routes.requests, "get", down)
    body = client.post("/api/weather/forecast", json={"lat": 10, "lon": 20}, headers=h).get_json()
    assert body["forecast"] == [] and body["data_status"]["overall"] == "unavailable"


def test_forecast_days_without_marine_data_have_null_waves(client, h, monkeypatch):
    class Resp:
        def __init__(self, payload): self.payload = payload
        def raise_for_status(self): pass
        def json(self): return self.payload

    def fake_get(url, **_):
        if "marine" in url:
            raise requests.Timeout("marine timed out")
        return Resp({"daily": {"time": ["2026-11-26", "2026-11-27"], "wind_speed_10m_max": [18.0, None],
                               "wind_direction_10m_dominant": [90, 90], "precipitation_sum": [0.0, 1.5]}})

    monkeypatch.setattr(weather_routes.requests, "get", fake_get)
    body = client.post("/api/weather/forecast", json={"lat": 10, "lon": 20}, headers=h).get_json()
    first, second = body["forecast"]
    assert first["wave_height_m"] is None and first["beaufort_scale"] == 3
    assert second["wind_speed_knots"] is None and second["beaufort_scale"] is None   # unknown, not Beaufort 0
    assert body["data_status"] == {"overall": "partial", "atmosphere": "available", "marine": "unavailable"}


# --- What-if calculators no longer assume inputs ---

FULL = {"wind_speed_knots": 20, "wind_direction": "head", "wave_height_m": 2, "swell_height_m": 1,
        "base_speed": 14, "base_fuel_mt_day": 28}


def test_wind_impact_works_with_explicit_inputs(client, h):
    assert client.post("/api/weather/wind-impact", json=FULL, headers=h).status_code == 200


@pytest.mark.parametrize("missing", ["wind_speed_knots", "wave_height_m", "swell_height_m", "base_speed", "base_fuel_mt_day"])
def test_wind_impact_refuses_to_assume_a_missing_input(client, h, missing):
    body = {k: v for k, v in FULL.items() if k != missing}
    resp = client.post("/api/weather/wind-impact", json=body, headers=h)
    assert resp.status_code == 400 and missing in resp.get_json()["error"]


def test_wind_impact_rejects_unknown_direction_and_non_numbers(client, h):
    assert client.post("/api/weather/wind-impact", json={**FULL, "wind_direction": "sideways"}, headers=h).status_code == 400
    assert client.post("/api/weather/wind-impact", json={**FULL, "wind_speed_knots": "fast"}, headers=h).status_code == 400
    assert client.post("/api/weather/wind-impact", json={**FULL, "base_speed": 0}, headers=h).status_code == 400


def test_attribution_refuses_to_assume_inputs(client, h):
    assert client.post("/api/weather/attribution", json={}, headers=h).status_code == 400
    ok = {"wind_speed_knots": 20, "wave_height_m": 2, "swell_height_m": 1, "base_fuel_mt_day": 28}
    assert client.post("/api/weather/attribution", json=ok, headers=h).status_code == 200


def test_the_random_grid_enhancement_endpoint_is_gone(client, h):
    assert client.post("/api/weather/grid-enhance", json={"waypoints": [{"lat": 1, "lon": 2}]}, headers=h).status_code == 404


# --- Noon reports: unknown is NULL ---

@pytest.fixture
def voyage(client, h):
    vessel = client.post("/api/vessels", headers=h, json={"name": "MV Alpha", "imo_number": "9000001"}).get_json()["id"]
    return client.post("/api/voyages", headers=h, json={
        "vessel_id": vessel, "voyage_number": "V-1", "departure_port": "A", "arrival_port": "B"}).get_json()["id"]


NOON = {"report_date": "2026-03-01", "latitude": 1.5, "longitude": 103.8}


def test_noon_report_without_a_time_stores_null_not_the_current_time(client, h, voyage, app):
    resp = client.post(f"/api/voyages/{voyage}/noon-reports", json=NOON, headers=h)
    assert resp.status_code == 201, resp.get_json()
    with app.app_context():
        assert NoonReport.query.one().report_time is None


def test_noon_report_keeps_a_supplied_time_in_either_format(client, h, voyage, app):
    for day, stamp in (("2026-03-01", "12:00"), ("2026-03-02", "06:30:15")):
        assert client.post(f"/api/voyages/{voyage}/noon-reports", json={**NOON, "report_date": day, "report_time": stamp},
                           headers=h).status_code == 201
    with app.app_context():
        times = sorted(str(r.report_time) for r in NoonReport.query.all())
    assert times == ["06:30:15", "12:00:00"]


def test_noon_report_with_an_unreadable_time_is_rejected(client, h, voyage):
    resp = client.post(f"/api/voyages/{voyage}/noon-reports", json={**NOON, "report_time": "noonish"}, headers=h)
    assert resp.status_code == 400 and "report_time" in resp.get_json()["fields"]


def test_imported_rows_without_a_time_store_null(client, h, voyage, app):
    import io
    vessel = client.get(f"/api/voyages/{voyage}", headers=h).get_json()["vessel_id"]
    csv = b"date,lat,lon\n2026-03-01,1.5,103.8\n"
    up = client.post("/api/uploads/report", headers=h, content_type="multipart/form-data", data={
        "file": (io.BytesIO(csv), "r.csv"), "vessel_id": vessel, "voyage_id": voyage}).get_json()
    assert client.post(f"/api/uploads/{up['upload_id']}/confirm", json={}, headers=h).status_code == 200
    with app.app_context():
        assert NoonReport.query.one().report_time is None


# --- A real zero is not "missing" ---

def test_zero_values_are_reported_as_zero_not_as_unknown(client, h, voyage):
    created = client.post(f"/api/voyages/{voyage}/noon-reports", headers=h, json={
        **NOON, "latitude": 0, "longitude": 0, "speed_over_ground": 0, "me_lsfo": 0, "wind_force_bft": 0})
    assert created.status_code == 201, created.get_json()
    body = client.get(f"/api/voyages/{voyage}/noon-reports", headers=h).get_json()
    report = body["reports"][0] if "reports" in body else body["noon_reports"][0]
    assert report["speed_over_ground"] == 0.0
    assert report["me_lsfo"] == 0.0
    assert report["latitude"] == 0.0 and report["longitude"] == 0.0    # the equator / prime meridian are real places
    assert report["wind_force_bft"] == 0
