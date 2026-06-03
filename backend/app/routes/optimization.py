"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
"""
VoyageIQ AI - Voyage Calculation Engine
Computes voyage performance: ETA, fuel, speed, weather-adjusted output.
Uses 0.25-degree weather grid sampling along route.
"""
import math
import requests
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import Route, Vessel, Voyage

optimization_bp = Blueprint('optimization', __name__)

# ---------------------------------------------------------------------------
# World Port Database (44 major ports)
# ---------------------------------------------------------------------------
WORLD_PORTS = {
    "Singapore":            {"lat": 1.2897,   "lon": 103.8501, "region": "Asia Pacific",   "country": "Singapore"},
    "Shanghai":             {"lat": 31.2304,  "lon": 121.4737, "region": "Asia Pacific",   "country": "China"},
    "Busan":                {"lat": 35.0996,  "lon": 129.0403, "region": "Asia Pacific",   "country": "South Korea"},
    "Hong Kong":            {"lat": 22.2793,  "lon": 114.1628, "region": "Asia Pacific",   "country": "China"},
    "Tokyo Bay":            {"lat": 35.6295,  "lon": 139.7711, "region": "Asia Pacific",   "country": "Japan"},
    "Port Klang":           {"lat": 2.9937,   "lon": 101.3765, "region": "Asia Pacific",   "country": "Malaysia"},
    "Jakarta":              {"lat": -6.1087,  "lon": 106.8801, "region": "Asia Pacific",   "country": "Indonesia"},
    "Manila":               {"lat": 14.5794,  "lon": 120.9645, "region": "Asia Pacific",   "country": "Philippines"},
    "Sydney":               {"lat": -33.8523, "lon": 151.2108, "region": "Asia Pacific",   "country": "Australia"},
    "Melbourne":            {"lat": -37.8418, "lon": 144.9286, "region": "Asia Pacific",   "country": "Australia"},
    "Mumbai":               {"lat": 18.9322,  "lon": 72.8374,  "region": "South Asia",     "country": "India"},
    "Colombo":              {"lat": 6.9271,   "lon": 79.8612,  "region": "South Asia",     "country": "Sri Lanka"},
    "Chittagong":           {"lat": 22.3569,  "lon": 91.8235,  "region": "South Asia",     "country": "Bangladesh"},
    "Dubai (Jebel Ali)":    {"lat": 24.9857,  "lon": 55.0648,  "region": "Middle East",    "country": "UAE"},
    "Ras Tanura":           {"lat": 26.6467,  "lon": 50.1600,  "region": "Middle East",    "country": "Saudi Arabia"},
    "Fujairah":             {"lat": 25.1288,  "lon": 56.3264,  "region": "Middle East",    "country": "UAE"},
    "Durban":               {"lat": -29.8587, "lon": 31.0218,  "region": "Africa",         "country": "South Africa"},
    "Cape Town":            {"lat": -33.9249, "lon": 18.4241,  "region": "Africa",         "country": "South Africa"},
    "Mombasa":              {"lat": -4.0435,  "lon": 39.6682,  "region": "Africa",         "country": "Kenya"},
    "Lagos":                {"lat": 6.4530,   "lon": 3.3841,   "region": "Africa",         "country": "Nigeria"},
    "Rotterdam":            {"lat": 51.9244,  "lon": 4.4777,   "region": "Europe",         "country": "Netherlands"},
    "Antwerp":              {"lat": 51.2194,  "lon": 4.4025,   "region": "Europe",         "country": "Belgium"},
    "Hamburg":              {"lat": 53.5488,  "lon": 9.9872,   "region": "Europe",         "country": "Germany"},
    "Felixstowe":           {"lat": 51.9603,  "lon": 1.3513,   "region": "Europe",         "country": "UK"},
    "Barcelona":            {"lat": 41.3515,  "lon": 2.1734,   "region": "Europe",         "country": "Spain"},
    "Piraeus":              {"lat": 37.9480,  "lon": 23.6441,  "region": "Europe",         "country": "Greece"},
    "Genoa":                {"lat": 44.4056,  "lon": 8.9463,   "region": "Europe",         "country": "Italy"},
    "Los Angeles":          {"lat": 33.7322,  "lon": -118.2595,"region": "North America",  "country": "USA"},
    "New York":             {"lat": 40.6892,  "lon": -74.0445, "region": "North America",  "country": "USA"},
    "Houston":              {"lat": 29.7604,  "lon": -94.9747, "region": "North America",  "country": "USA"},
    "Vancouver":            {"lat": 49.2827,  "lon": -123.1207,"region": "North America",  "country": "Canada"},
    "Santos":               {"lat": -23.9535, "lon": -46.3333, "region": "South America",  "country": "Brazil"},
    "Colon (Panama)":       {"lat": 9.3548,   "lon": -79.9002, "region": "Central America","country": "Panama"},
    "Tianjin":              {"lat": 38.9906,  "lon": 117.7229, "region": "Asia Pacific",   "country": "China"},
    "Qingdao":              {"lat": 36.0671,  "lon": 120.3826, "region": "Asia Pacific",   "country": "China"},
    "Ningbo":               {"lat": 29.8683,  "lon": 121.5440, "region": "Asia Pacific",   "country": "China"},
    "Kaohsiung":            {"lat": 22.6237,  "lon": 120.3014, "region": "Asia Pacific",   "country": "Taiwan"},
    "Laem Chabang":         {"lat": 13.0825,  "lon": 100.8823, "region": "Asia Pacific",   "country": "Thailand"},
    "Aden":                 {"lat": 12.7797,  "lon": 45.0367,  "region": "Middle East",    "country": "Yemen"},
    "Suez":                 {"lat": 29.9668,  "lon": 32.5498,  "region": "Middle East",    "country": "Egypt"},
    "Alexandria":           {"lat": 31.2001,  "lon": 29.9187,  "region": "Middle East",    "country": "Egypt"},
    "Karachi":              {"lat": 24.8607,  "lon": 67.0011,  "region": "South Asia",     "country": "Pakistan"},
    "Dar es Salaam":        {"lat": -6.7924,  "lon": 39.2083,  "region": "Africa",         "country": "Tanzania"},
    "Abidjan":              {"lat": 5.3600,   "lon": -4.0083,  "region": "Africa",         "country": "Ivory Coast"},
}

# ---------------------------------------------------------------------------
# Haversine distance
# ---------------------------------------------------------------------------
def _haversine(lat1, lon1, lat2, lon2):
    R = 3440.065  # Earth radius in nautical miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(d_lam/2)**2
    return 2 * R * math.asin(math.sqrt(a))

# ---------------------------------------------------------------------------
# 0.25° Weather Grid Sampling along route
# ---------------------------------------------------------------------------
def _sample_weather_025deg(lat1, lon1, lat2, lon2, n_points=8):
    """
    Sample weather data along route at 0.25° grid resolution.
    Returns list of weather observations at equally-spaced route points.
    """
    OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
    MARINE_API = "https://marine-api.open-meteo.com/v1/marine"
    samples = []

    for i in range(n_points):
        frac = i / max(n_points - 1, 1)
        # Snap to nearest 0.25° grid point
        raw_lat = lat1 + frac * (lat2 - lat1)
        raw_lon = lon1 + frac * (lon2 - lon1)
        lat = round(raw_lat * 4) / 4   # snap to 0.25°
        lon = round(raw_lon * 4) / 4

        obs = {"lat": lat, "lon": lon, "frac": round(frac, 2)}
        try:
            # Atmospheric weather
            atm = requests.get(OPEN_METEO, params={
                "latitude": lat, "longitude": lon,
                "current": "wind_speed_10m,wind_direction_10m,precipitation,weather_code",
                "wind_speed_unit": "kn",
            }, timeout=5).json()
            curr = atm.get("current", {})
            obs["wind_speed_kn"] = round(curr.get("wind_speed_10m", 10), 1)
            obs["wind_dir"]      = round(curr.get("wind_direction_10m", 0))
            obs["precip"]        = curr.get("precipitation", 0)
        except Exception:
            obs["wind_speed_kn"] = 12.0
            obs["wind_dir"]      = 225
            obs["precip"]        = 0

        try:
            # Marine weather
            mar = requests.get(MARINE_API, params={
                "latitude": lat, "longitude": lon,
                "current": "wave_height,swell_wave_height,ocean_current_velocity,ocean_current_direction",
            }, timeout=5).json()
            curr_m = mar.get("current", {})
            obs["wave_height"]    = round(curr_m.get("wave_height", 1.0), 2)
            obs["swell_height"]   = round(curr_m.get("swell_wave_height", 0.8), 2)
            obs["current_speed"]  = round(curr_m.get("ocean_current_velocity", 0.3), 2)
            obs["current_dir"]    = round(curr_m.get("ocean_current_direction", 180))
        except Exception:
            obs["wave_height"]   = 1.2
            obs["swell_height"]  = 0.8
            obs["current_speed"] = 0.3
            obs["current_dir"]   = 180

        # Beaufort scale
        ws = obs["wind_speed_kn"]
        if ws < 1: obs["beaufort"] = 0
        elif ws < 4: obs["beaufort"] = 1
        elif ws < 7: obs["beaufort"] = 2
        elif ws < 11: obs["beaufort"] = 3
        elif ws < 17: obs["beaufort"] = 4
        elif ws < 22: obs["beaufort"] = 5
        elif ws < 28: obs["beaufort"] = 6
        elif ws < 34: obs["beaufort"] = 7
        elif ws < 41: obs["beaufort"] = 8
        else: obs["beaufort"] = 9

        samples.append(obs)

    return samples

# ---------------------------------------------------------------------------
# Vessel type fuel coefficients
# ---------------------------------------------------------------------------
VESSEL_COEFFICIENTS = {
    "Bulk Carrier":        {"k": 0.0022, "base_cons": 28.5,  "design_speed": 14.0, "lwt_factor": 0.40},
    "VLCC Tanker":         {"k": 0.0035, "base_cons": 78.0,  "design_speed": 15.5, "lwt_factor": 0.45},
    "Suezmax Tanker":      {"k": 0.0028, "base_cons": 52.0,  "design_speed": 15.0, "lwt_factor": 0.44},
    "Aframax Tanker":      {"k": 0.0024, "base_cons": 38.0,  "design_speed": 14.8, "lwt_factor": 0.43},
    "Container (Large)":   {"k": 0.0045, "base_cons": 185.0, "design_speed": 22.0, "lwt_factor": 0.38},
    "Container (Medium)":  {"k": 0.0038, "base_cons": 95.0,  "design_speed": 20.0, "lwt_factor": 0.38},
    "Container (Feeder)":  {"k": 0.0028, "base_cons": 32.0,  "design_speed": 18.0, "lwt_factor": 0.38},
    "Chemical Tanker":     {"k": 0.0020, "base_cons": 22.0,  "design_speed": 14.0, "lwt_factor": 0.42},
    "LNG Carrier":         {"k": 0.0030, "base_cons": 120.0, "design_speed": 19.5, "lwt_factor": 0.40},
    "LPG Carrier":         {"k": 0.0025, "base_cons": 45.0,  "design_speed": 17.0, "lwt_factor": 0.40},
    "General Cargo":       {"k": 0.0018, "base_cons": 18.0,  "design_speed": 13.0, "lwt_factor": 0.42},
    "RoRo":                {"k": 0.0032, "base_cons": 55.0,  "design_speed": 20.0, "lwt_factor": 0.35},
}

# ---------------------------------------------------------------------------
# Main Voyage Calculator
# ---------------------------------------------------------------------------
def _calculate_voyage(data, weather_samples):
    """
    Full physics-based voyage calculation with weather integration.
    Returns detailed performance breakdown.
    """
    vessel_type   = data.get("vessel_type", "Bulk Carrier")
    dwt           = float(data.get("dwt", 75000))
    draft         = float(data.get("draft", 13.5))
    cargo_weight  = float(data.get("cargo_weight", 0))
    target_speed  = float(data.get("target_speed", 14.0))
    distance_nm   = float(data.get("distance_nm", 1000))
    fuel_price    = float(data.get("fuel_price_usd", 580))
    fuel_type     = data.get("fuel_type", "VLSFO")

    # Manual weather override (if user provided)
    manual_wind_speed  = data.get("wind_speed_kn")
    manual_wave_height = data.get("wave_height_m")
    manual_current_spd = data.get("current_speed_kn", 0.0)
    manual_current_dir = data.get("current_direction", "Following")

    coeff = VESSEL_COEFFICIENTS.get(vessel_type, VESSEL_COEFFICIENTS["Bulk Carrier"])

    # ---- Displacement / loading factor ----
    loading_ratio  = cargo_weight / max(dwt, 1)
    loading_factor = 0.85 + 0.20 * loading_ratio  # 0.85 (ballast) → 1.05 (full load)

    # ---- Average weather from 0.25° samples ----
    if weather_samples:
        avg_wind  = sum(s.get("wind_speed_kn", 10) for s in weather_samples) / len(weather_samples)
        avg_wave  = sum(s.get("wave_height", 1.0) for s in weather_samples) / len(weather_samples)
        avg_curr  = sum(s.get("current_speed", 0.3) for s in weather_samples) / len(weather_samples)
        avg_bf    = sum(s.get("beaufort", 3) for s in weather_samples) / len(weather_samples)
    else:
        avg_wind, avg_wave, avg_curr, avg_bf = 10.0, 1.0, 0.3, 3.0

    # Override with manual values if provided
    if manual_wind_speed is not None:
        avg_wind = float(manual_wind_speed)
    if manual_wave_height is not None:
        avg_wave = float(manual_wave_height)
    if manual_current_spd is not None:
        avg_curr = float(manual_current_spd)

    # Beaufort from manual wind
    ws = avg_wind
    if ws < 1: avg_bf = 0
    elif ws < 7: avg_bf = 2
    elif ws < 17: avg_bf = 4
    elif ws < 28: avg_bf = 6
    elif ws < 41: avg_bf = 8
    else: avg_bf = 10

    # ---- Weather resistance factor (speed reduction) ----
    # Wind resistance: +0.8% per Beaufort above BF4
    wind_penalty = max(0, (avg_bf - 4) * 0.008)
    # Wave resistance: +2% per meter of wave above 1.5m
    wave_penalty = max(0, (avg_wave - 1.5) * 0.02)
    # Current effect on effective speed
    if manual_current_dir in ("Following", "Stern"):
        current_assist = avg_curr * 0.7  # following current helps
        current_penalty = 0.0
    elif manual_current_dir in ("Head", "Bow"):
        current_assist = 0.0
        current_penalty = avg_curr * 0.85  # head current hurts
    else:  # Beam
        current_assist = avg_curr * 0.2
        current_penalty = avg_curr * 0.2

    weather_factor = 1.0 - wind_penalty - wave_penalty
    effective_speed = target_speed * weather_factor - current_penalty + current_assist
    effective_speed = max(effective_speed, 4.0)  # min steerage speed

    # ---- Fuel consumption (admiralty coefficient model) ----
    # Base: proportional to speed^3 × displacement^(2/3)
    displacement = dwt * loading_factor * 1.25  # rough tonne displacement
    k = coeff["k"]
    base_daily = k * (target_speed ** 3) * (displacement ** (2/3)) / 1000
    # Weather overhead: each BF adds ~3% ME load
    weather_overhead = 1.0 + max(0, avg_bf - 2) * 0.028
    me_consumption = base_daily * weather_overhead * loading_factor
    ae_consumption = me_consumption * 0.08   # AE = ~8% of ME
    total_daily    = me_consumption + ae_consumption

    # ---- Duration & totals ----
    duration_hrs  = distance_nm / effective_speed
    duration_days = duration_hrs / 24
    total_fuel    = total_daily * duration_days
    fuel_cost     = total_fuel * fuel_price
    fuel_per_nm   = total_fuel / distance_nm if distance_nm > 0 else 0

    # ---- Eco speed recommendation ----
    # Cube law: reducing speed 10% → reduces consumption ~27%
    eco_speed     = target_speed * 0.88
    eco_daily     = total_daily * (0.88 ** 3)
    eco_duration  = (distance_nm / eco_speed) / 24
    eco_fuel      = eco_daily * eco_duration
    eco_savings_fuel = total_fuel - eco_fuel
    eco_savings_usd  = eco_savings_fuel * fuel_price
    eco_time_penalty = (eco_duration - duration_days) * 24  # hours extra

    # ---- CII / Carbon intensity ----
    # CII (gCO2/capacity-mile) for 2024: target = 5.0 for bulk carrier
    co2_factor = {"VLSFO": 3.114, "MGO": 3.206, "LSMGO": 3.212, "LNG": 2.75}.get(fuel_type, 3.114)
    co2_total  = total_fuel * co2_factor
    cii_attained = (co2_total * 1_000_000) / (dwt * distance_nm) if dwt and distance_nm else 0
    cii_targets = {"A": 4.5, "B": 5.0, "C": 5.5, "D": 6.0}
    cii_rating = "E"
    for grade, threshold in cii_targets.items():
        if cii_attained <= threshold:
            cii_rating = grade
            break

    # ---- Performance Score ----
    score = 100
    if avg_bf > 5: score -= (avg_bf - 5) * 5
    if loading_ratio > 0.95: score -= 5
    if target_speed > coeff["design_speed"]: score -= 10
    score = max(40, min(100, score))

    return {
        # Route
        "distance_nm":       round(distance_nm, 1),
        "effective_speed":   round(effective_speed, 2),
        "duration_hrs":      round(duration_hrs, 1),
        "duration_days":     round(duration_days, 2),
        "eta_offset_hrs":    round(duration_hrs, 1),
        # Fuel
        "me_consumption_day": round(me_consumption, 2),
        "ae_consumption_day": round(ae_consumption, 2),
        "total_daily_fuel":  round(total_daily, 2),
        "total_fuel_mt":     round(total_fuel, 1),
        "fuel_per_nm":       round(fuel_per_nm, 4),
        "fuel_cost_usd":     round(fuel_cost, 0),
        "fuel_type":         fuel_type,
        # Weather
        "avg_wind_kn":       round(avg_wind, 1),
        "avg_wave_m":        round(avg_wave, 2),
        "avg_current_kn":    round(avg_curr, 2),
        "beaufort_avg":      round(avg_bf, 1),
        "weather_factor":    round(weather_factor, 4),
        "weather_penalty_pct": round((1 - weather_factor) * 100, 1),
        # Eco
        "eco_speed":         round(eco_speed, 1),
        "eco_fuel_mt":       round(eco_fuel, 1),
        "eco_savings_fuel":  round(eco_savings_fuel, 1),
        "eco_savings_usd":   round(eco_savings_usd, 0),
        "eco_time_penalty_hrs": round(eco_time_penalty, 1),
        # Carbon
        "co2_total_mt":      round(co2_total, 1),
        "cii_attained":      round(cii_attained, 3),
        "cii_rating":        cii_rating,
        # Score
        "performance_score": score,
        "loading_ratio":     round(loading_ratio * 100, 1),
    }

# ---------------------------------------------------------------------------
# AI Suggestions Engine
# ---------------------------------------------------------------------------
def _generate_ai_suggestions(calc, data, weather_samples):
    tips = []
    bf = calc["beaufort_avg"]
    speed = float(data.get("target_speed", 14))
    vessel_type = data.get("vessel_type", "Bulk Carrier")
    coeff = VESSEL_COEFFICIENTS.get(vessel_type, VESSEL_COEFFICIENTS["Bulk Carrier"])

    # Speed optimization
    if speed > coeff["design_speed"]:
        tips.append({
            "type": "warning",
            "title": "Speed Exceeds Design Limit",
            "detail": f"Running at {speed} kn above design speed {coeff['design_speed']} kn increases fuel by ~{round((speed/coeff['design_speed'])**3 * 100 - 100, 0):.0f}%. Reduce to design speed.",
            "saving_usd": round(calc["eco_savings_usd"] * 1.2, 0),
        })
    elif calc["eco_savings_usd"] > 5000:
        tips.append({
            "type": "opportunity",
            "title": "Slow Steaming Opportunity",
            "detail": f"Reducing speed to {calc['eco_speed']} kn saves {calc['eco_savings_fuel']} MT of fuel (${calc['eco_savings_usd']:,.0f}) at the cost of {calc['eco_time_penalty_hrs']:.1f} extra hours.",
            "saving_usd": round(calc["eco_savings_usd"], 0),
        })

    # Weather routing
    if bf >= 6:
        tips.append({
            "type": "warning",
            "title": "Adverse Weather on Route",
            "detail": f"Average Beaufort {bf:.1f} along route causing {calc['weather_penalty_pct']}% speed reduction. Consider alternative routing north/south of weather system.",
            "saving_usd": round(calc["fuel_cost_usd"] * 0.05, 0),
        })
    elif bf >= 4:
        tips.append({
            "type": "info",
            "title": "Moderate Weather Conditions",
            "detail": f"Beaufort {bf:.1f} causing {calc['weather_penalty_pct']}% speed loss. Monitor GRIB data for next 48h window.",
            "saving_usd": 0,
        })

    # CII
    if calc["cii_rating"] in ("D", "E"):
        tips.append({
            "type": "critical",
            "title": f"CII Rating: {calc['cii_rating']} — Regulatory Risk",
            "detail": f"Attained CII {calc['cii_attained']:.3f} exceeds acceptable limits. Reduce speed or optimise trim to improve rating.",
            "saving_usd": round(calc["eco_savings_usd"] * 0.5, 0),
        })
    elif calc["cii_rating"] == "A":
        tips.append({
            "type": "success",
            "title": "Excellent CII Rating — Carbon Compliant",
            "detail": f"CII {calc['cii_attained']:.3f} achieves Grade A. This voyage qualifies for green shipping incentives.",
            "saving_usd": 0,
        })

    # Loading
    if calc["loading_ratio"] < 30:
        tips.append({
            "type": "info",
            "title": "Ballast Voyage — Trim Optimisation",
            "detail": "Vessel in near-ballast condition. Optimise trim: 0.5–1.0m stern trim can reduce fuel by 1.5–2%. Consider ballasting to improve propulsion.",
            "saving_usd": round(calc["total_fuel_mt"] * 580 * 0.02, 0),
        })
    elif calc["loading_ratio"] > 92:
        tips.append({
            "type": "warning",
            "title": "Near Full Load — Monitor Squat Effect",
            "detail": "High loading ratio may cause squat in shallow channels. Reduce speed to design draft limits near ports.",
            "saving_usd": 0,
        })

    # Current
    if data.get("current_direction") in ("Head", "Bow"):
        tips.append({
            "type": "opportunity",
            "title": "Head Current Detected — Route Deviation",
            "detail": f"Head current of {calc['avg_current_kn']} kn opposing vessel. Deviating ±30nm may find favourable current, saving ~{round(calc['total_fuel_mt']*0.03*580,0):,.0f} USD.",
            "saving_usd": round(calc["total_fuel_mt"] * 0.03 * 580, 0),
        })

    # RPM optimisation (generic)
    tips.append({
        "type": "info",
        "title": "Engine RPM Optimisation",
        "detail": "Ensure ME is operating at MCR 75–85% for optimal SFOC. Verify turbocharger efficiency and scavenge pressures at next noon report.",
        "saving_usd": round(calc["total_fuel_mt"] * 0.015 * 580, 0),
    })

    return tips[:6]  # max 6 suggestions

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@optimization_bp.route('/calculate', methods=['POST'])
@jwt_required()
def calculate_voyage():
    """
    POST /api/optimization/calculate
    Full voyage calculation with 0.25° weather grid sampling.
    Input JSON:
      origin_port, destination_port, vessel_type, dwt, draft,
      cargo_weight, target_speed, fuel_type, fuel_price_usd,
      wind_speed_kn (optional manual), wave_height_m (optional),
      current_speed_kn, current_direction, departure_datetime
    """
    data = request.get_json() or {}

    origin      = data.get("origin_port", "")
    destination = data.get("destination_port", "")

    # Resolve coordinates
    orig_info = WORLD_PORTS.get(origin)
    dest_info = WORLD_PORTS.get(destination)

    if not orig_info or not dest_info:
        return jsonify({"success": False, "error": f"Unknown port: {origin!r} or {destination!r}"}), 400

    lat1, lon1 = orig_info["lat"], orig_info["lon"]
    lat2, lon2 = dest_info["lat"], dest_info["lon"]

    # Calculate great-circle distance
    distance_nm = _haversine(lat1, lon1, lat2, lon2)
    data["distance_nm"] = distance_nm

    # 0.25° weather grid sampling along route
    use_live_weather = data.get("use_live_weather", True)
    weather_samples  = []
    if use_live_weather:
        try:
            weather_samples = _sample_weather_025deg(lat1, lon1, lat2, lon2, n_points=8)
        except Exception as e:
            current_app.logger.warning(f"Weather sampling failed: {e}")

    # Calculate voyage performance
    calc = _calculate_voyage(data, weather_samples)

    # AI Suggestions
    suggestions = _generate_ai_suggestions(calc, data, weather_samples)

    # ETA calculation
    depart_str = data.get("departure_datetime", datetime.utcnow().isoformat())
    try:
        depart_dt = datetime.fromisoformat(depart_str.replace("Z", ""))
    except Exception:
        depart_dt = datetime.utcnow()
    eta_dt = depart_dt + timedelta(hours=calc["duration_hrs"])

    # Route waypoints (simplified great-circle)
    waypoints = []
    n_wp = 12
    for i in range(n_wp + 1):
        f = i / n_wp
        waypoints.append({
            "lat": round(lat1 + f * (lat2 - lat1), 4),
            "lon": round(lon1 + f * (lon2 - lon1), 4),
            "order": i,
        })

    return jsonify({
        "success": True,
        "origin": {"name": origin, **orig_info},
        "destination": {"name": destination, **dest_info},
        "distance_nm": round(distance_nm, 1),
        "calculation": calc,
        "suggestions": suggestions,
        "weather_samples": weather_samples,
        "waypoints": waypoints,
        "eta": eta_dt.isoformat(),
        "departure": depart_dt.isoformat(),
        "weather_grid_resolution": "0.25°",
        "weather_sample_points": len(weather_samples),
    }), 200


@optimization_bp.route('/route', methods=['POST'])
@jwt_required()
def generate_routes():
    """POST /api/optimization/route - Generate 4 route options."""
    data = request.get_json() or {}
    origin      = data.get("origin_port", data.get("origin", ""))
    destination = data.get("destination_port", data.get("destination", ""))

    orig_info = WORLD_PORTS.get(origin)
    dest_info = WORLD_PORTS.get(destination)
    if not orig_info or not dest_info:
        return jsonify({"success": False, "error": "Unknown port"}), 400

    lat1, lon1 = orig_info["lat"], orig_info["lon"]
    lat2, lon2 = dest_info["lat"], dest_info["lon"]
    base_dist  = _haversine(lat1, lon1, lat2, lon2)
    base_speed = float(data.get("speed_knots", 14.0))
    fuel_price = float(data.get("fuel_price", 580))
    k_fuel     = 0.0022

    routes = []
    configs = [
        {"id": "optimal",  "label": "Optimal Route",  "dist_factor": 1.00, "speed_factor": 1.00, "risk": 2.5},
        {"id": "fastest",  "label": "Fastest Route",  "dist_factor": 0.97, "speed_factor": 1.10, "risk": 4.0},
        {"id": "eco",      "label": "Eco Route",      "dist_factor": 1.03, "speed_factor": 0.88, "risk": 1.5},
        {"id": "safest",   "label": "Safest Route",   "dist_factor": 1.06, "speed_factor": 0.94, "risk": 0.8},
    ]
    for cfg in configs:
        dist  = base_dist * cfg["dist_factor"]
        spd   = base_speed * cfg["speed_factor"]
        dur   = dist / spd
        fuel  = k_fuel * (spd**3) * dur / 24
        cost  = fuel * fuel_price
        n_wp  = 10
        wps   = [{"lat": round(lat1 + i/n_wp*(lat2-lat1), 4),
                   "lon": round(lon1 + i/n_wp*(lon2-lon1), 4)}
                 for i in range(n_wp+1)]
        routes.append({
            "id": cfg["id"], "label": cfg["label"],
            "distance_nm": round(dist, 1),
            "duration_hrs": round(dur, 1),
            "speed_kn": round(spd, 1),
            "fuel_mt": round(fuel, 1),
            "cost_usd": round(cost, 0),
            "risk_score": cfg["risk"],
            "waypoints": wps,
        })

    return jsonify({"success": True, "routes": routes,
                    "origin": orig_info, "destination": dest_info,
                    "base_distance_nm": round(base_dist, 1)}), 200


@optimization_bp.route('/fuel-simulator', methods=['POST'])
@jwt_required()
def fuel_simulator():
    data = request.get_json() or {}
    speed    = float(data.get("speed_knots", 14))
    dist     = float(data.get("distance_nm", 1000))
    vtype    = data.get("vessel_type", "Bulk Carrier")
    price    = float(data.get("fuel_price", 580))
    coeff    = VESSEL_COEFFICIENTS.get(vtype, VESSEL_COEFFICIENTS["Bulk Carrier"])
    k        = coeff["k"]
    dwt      = float(data.get("dwt", 75000))
    duration = dist / speed
    fuel     = k * (speed**3) * (dwt**0.667) / 1000 * (duration/24)
    base_fuel = k * (14**3) * (dwt**0.667) / 1000 * ((dist/14)/24)
    return jsonify({
        "speed_kn": speed, "distance_nm": dist,
        "duration_hrs": round(duration, 1),
        "fuel_mt": round(fuel, 1),
        "cost_usd": round(fuel * price, 0),
        "savings_vs_baseline": round(base_fuel - fuel, 1),
        "eta": (datetime.utcnow() + timedelta(hours=duration)).isoformat(),
    })


@optimization_bp.route('/ports', methods=['GET'])
@jwt_required()
def get_ports():
    ports = [{"name": k, **v} for k, v in WORLD_PORTS.items()]
    ports.sort(key=lambda x: x["name"])
    return jsonify({"success": True, "ports": ports, "count": len(ports)}), 200
