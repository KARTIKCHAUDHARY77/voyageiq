"""
Weather values must be honest: unknown is None, "current" is the nearest hour, stale data
is flagged and not used, and a failed request is never reported as good weather.
"""
from datetime import datetime, timedelta

import pytest

from app.services import weather_data as w

NOW = datetime(2026, 11, 26, 14, 20)


def hours(*offsets):
    return [(NOW.replace(minute=0) + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in offsets]


def atmosphere(wind=30.0, offset=0):
    return {"hourly": {"time": hours(offset), "wind_speed_10m": [wind],
                       "wind_direction_10m": [270], "precipitation": [0.2]}}


def marine(wave=2.0, swell=1.0, stream=0.4, offset=0):
    return {"hourly": {"time": hours(offset), "wave_height": [wave],
                       "swell_wave_height": [swell], "ocean_current_velocity": [stream]}}


# --- Beaufort (WMO): the old code capped at force 9 ---

@pytest.mark.parametrize("kmh, force", [
    (0, 0), (1, 0), (3, 1), (10, 2), (18, 3), (25, 4), (35, 5), (45, 6), (55, 7), (70, 8),
    (80, 9), (95, 10), (110, 11), (118, 12), (200, 12),
])
def test_beaufort_covers_the_whole_scale(kmh, force):
    assert w.beaufort_from_kmh(kmh) == force


def test_unknown_wind_has_no_beaufort_force_and_no_risk():
    assert w.beaufort_from_kmh(None) is None
    assert w.risk_level(None) is None


def test_hurricane_force_wind_is_extreme():
    assert w.risk_level(w.beaufort_from_kmh(130)) == "EXTREME"


# --- Choosing the hour ---

def test_the_nearest_hour_is_used_not_the_first_one():
    payload = {"hourly": {"time": hours(-14, -1, 0, 5), "wave_height": [9.9, 2.5, 3.0, 4.0]}}
    reading = w.hourly_reading(payload, "wave_height", NOW)
    assert reading.value == 3.0 and reading.status == w.AVAILABLE


def test_empty_hours_are_skipped_not_read_as_zero():
    payload = {"hourly": {"time": hours(0, 1), "wave_height": [None, 1.8]}}
    assert w.hourly_reading(payload, "wave_height", NOW).value == 1.8


def test_a_reading_far_from_now_is_stale():
    reading = w.hourly_reading(atmosphere(offset=-9), "wind_speed_10m", NOW)
    assert reading.status == w.STALE and not reading.usable


def test_a_genuine_zero_is_a_real_reading():
    reading = w.hourly_reading(marine(wave=0.0), "wave_height", NOW)
    assert reading.value == 0.0 and reading.usable


def test_the_providers_current_block_wins_over_hourly():
    payload = {"current": {"time": NOW.strftime("%Y-%m-%dT%H:%M"), "wind_speed_10m": 42.0},
               "hourly": {"time": hours(0), "wind_speed_10m": [5.0]}}
    assert w.current_reading(payload, "wind_speed_10m", NOW).value == 42.0


def test_malformed_payloads_are_unavailable_not_errors():
    for bad in ({}, None, {"hourly": {}}, {"hourly": {"time": ["not-a-time"], "wave_height": [1]}}):
        assert w.hourly_reading(bad, "wave_height", NOW).status == w.UNAVAILABLE


# --- Summaries ---

def test_full_data_is_available():
    s = w.summarize(atmosphere(), marine(), NOW)
    assert s["data_status"] == {"overall": "available", "atmosphere": "available", "marine": "available"}
    assert s["beaufort_scale"] == 5 and s["risk_level"] == "MODERATE"
    assert s["wave_height_m"] == 2.0 and s["provider"] == "Open-Meteo"


def test_both_sources_down_is_unavailable_with_no_numbers_and_no_risk():
    s = w.summarize({}, {}, NOW)
    assert s["data_status"]["overall"] == "unavailable"
    for field in ("wind_speed_kmh", "wave_height_m", "swell_height_m", "ocean_current_velocity_ms",
                  "beaufort_scale", "risk_level"):
        assert s[field] is None


def test_marine_down_is_partial_and_waves_are_unknown_not_calm():
    s = w.summarize(atmosphere(), {}, NOW)
    assert s["data_status"]["overall"] == "partial"
    assert s["data_status"]["marine"] == "unavailable"
    assert s["wave_height_m"] is None
    assert s["beaufort_scale"] == 5            # wind is still known


def test_stale_wind_is_not_used_to_assess_risk():
    s = w.summarize(atmosphere(offset=-10), marine(), NOW)
    assert s["data_status"]["atmosphere"] == "stale"
    assert s["beaufort_scale"] is None and s["risk_level"] is None


# --- Advice ---

def test_unknown_conditions_never_produce_favourable_advice():
    text = " ".join(w.recommendations(None, None)).lower()
    assert "favourable" not in text and "unavailable" in text


def test_missing_waves_are_called_out_not_assumed_calm():
    assert any("Wave data is unavailable" in r for r in w.recommendations(2, None))


def test_heavy_weather_advice_still_fires_when_known():
    recs = w.recommendations(8, 7.0)
    assert any("heavy weather" in r for r in recs) and any("Extreme swell" in r for r in recs)


def test_daily_value_missing_series_is_none():
    assert w.daily_value({"a": [1]}, "a", 0) == 1
    assert w.daily_value({"a": [1]}, "a", 5) is None
    assert w.daily_value({}, "a", 0) is None
    assert w.daily_value(None, "a", 0) is None
