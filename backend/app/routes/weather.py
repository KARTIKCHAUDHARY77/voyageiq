"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ AI - Weather Blueprint
Real-time and forecast weather data via Open-Meteo (free, no key required).
"""
import math
import requests
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from app.services.weather_data import (
    PROVIDER, UNAVAILABLE, beaufort_from_kmh, daily_value, kmh_to_knots, recommendations,
    risk_level, summarize,
)
from app.tenancy import tenant_required

weather_bp = Blueprint('weather', __name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OPEN_METEO_BASE = "https://api.open-meteo.com/v1"
MARINE_API_BASE = "https://marine-api.open-meteo.com/v1"
REQUEST_TIMEOUT = 10  # seconds

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _beaufort_from_kmh(wind_speed_kmh):
    return beaufort_from_kmh(wind_speed_kmh)


def _kmh_to_knots(kmh):
    return kmh_to_knots(kmh)


def _risk_level_from_beaufort(bf):
    return risk_level(bf)


def _risk_color(risk_level: str) -> str:
    return {"LOW": "#22c55e", "MODERATE": "#f59e0b", "HIGH": "#ef4444", "EXTREME": "#7c3aed"}.get(risk_level, "#6b7280")


def _recommendations_from_bf(bf, wave_height):
    return recommendations(bf, wave_height)


def _fetch_atmosphere(lat: float, lon: float) -> dict:
    """Fetch atmospheric weather from Open-Meteo."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "wind_speed_10m,wind_direction_10m,precipitation",
        "hourly": "wind_speed_10m,wind_direction_10m,precipitation",
        "forecast_days": 7,
        "wind_speed_unit": "kmh",
        "timezone": "UTC",
    }
    resp = requests.get(f"{OPEN_METEO_BASE}/forecast", params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _fetch_marine(lat: float, lon: float) -> dict:
    """Fetch marine weather from Open-Meteo marine API."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "wave_height,swell_wave_height,ocean_current_velocity",
        "forecast_days": 7,
        "timezone": "UTC",
    }
    resp = requests.get(f"{MARINE_API_BASE}/marine", params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _intermediate_point(lat1, lon1, lat2, lon2, fraction):
    phi1, lam1 = math.radians(lat1), math.radians(lon1)
    phi2, lam2 = math.radians(lat2), math.radians(lon2)
    dphi = phi2 - phi1
    dlam = lam2 - lam1
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    d = 2 * math.asin(math.sqrt(a))
    if d < 1e-10:
        return lat1, lon1
    A = math.sin((1 - fraction) * d) / math.sin(d)
    B = math.sin(fraction * d) / math.sin(d)
    x = A * math.cos(phi1) * math.cos(lam1) + B * math.cos(phi2) * math.cos(lam2)
    y = A * math.cos(phi1) * math.sin(lam1) + B * math.cos(phi2) * math.sin(lam2)
    z = A * math.sin(phi1) + B * math.sin(phi2)
    phi_i = math.atan2(z, math.sqrt(x ** 2 + y ** 2))
    lam_i = math.atan2(y, x)
    return math.degrees(phi_i), math.degrees(lam_i)


def _build_weather_summary(atmo: dict, marine: dict, lat: float, lon: float) -> dict:
    """Current conditions at a position. Values the provider did not give are None."""
    summary = summarize(atmo, marine, datetime.utcnow())
    level = summary["risk_level"]
    return {
        "latitude": lat,
        "longitude": lon,
        **summary,
        "risk_color": _risk_color(level),
        "recommendations": recommendations(summary["beaufort_scale"], summary["wave_height_m"]),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@weather_bp.route('/current', methods=['GET'])
@tenant_required('read')
def current_weather():
    """
    GET /api/weather/current?lat=&lon=
    Return current weather + marine conditions for a position.
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)

        if lat is None or lon is None:
            return jsonify({'success': False, 'error': 'Query params lat and lon are required.'}), 400
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return jsonify({'success': False, 'error': 'lat must be -90..90 and lon -180..180.'}), 400

        # Fetch both APIs
        try:
            atmo = _fetch_atmosphere(lat, lon)
        except requests.RequestException as exc:
            current_app.logger.warning(f'Atmosphere API error: {exc}')
            atmo = {}

        try:
            marine = _fetch_marine(lat, lon)
        except requests.RequestException as exc:
            current_app.logger.warning(f'Marine API error: {exc}')
            marine = {}

        summary = _build_weather_summary(atmo, marine, lat, lon)

        return jsonify({'success': True, **summary}), 200

    except Exception as exc:
        current_app.logger.error(f'Current weather error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to retrieve weather data.'}), 500


@weather_bp.route('/route-risk', methods=['GET'])
@tenant_required('read')
def route_risk():
    """
    GET /api/weather/route-risk?origin_lat=&origin_lon=&dest_lat=&dest_lon=
    Weather at 5 points along the great-circle line between two positions.

    This is a sample of a straight line, NOT a navigable route: the line can cross land and
    ignores traffic separation schemes, canals and restricted areas.
    """
    try:
        origin_lat = request.args.get('origin_lat', type=float)
        origin_lon = request.args.get('origin_lon', type=float)
        dest_lat = request.args.get('dest_lat', type=float)
        dest_lon = request.args.get('dest_lon', type=float)

        for name, val in [('origin_lat', origin_lat), ('origin_lon', origin_lon),
                           ('dest_lat', dest_lat), ('dest_lon', dest_lon)]:
            if val is None:
                return jsonify({'success': False, 'error': f'Query param {name} is required.'}), 400

        sample_fractions = [0.0, 0.25, 0.50, 0.75, 1.0]
        risk_zones = []
        scores = []

        for frac in sample_fractions:
            lat_s, lon_s = _intermediate_point(origin_lat, origin_lon, dest_lat, dest_lon, frac)

            try:
                atmo = _fetch_atmosphere(lat_s, lon_s)
            except (requests.RequestException, ValueError):
                atmo = {}
            try:
                marine = _fetch_marine(lat_s, lon_s)
            except (requests.RequestException, ValueError):
                marine = {}

            summary = _build_weather_summary(atmo, marine, lat_s, lon_s)

            label = {0.0: "Origin", 0.25: "25% Along Route", 0.50: "Midpoint",
                     0.75: "75% Along Route", 1.0: "Destination"}.get(frac, f"{int(frac*100)}%")

            risk_zones.append({
                "label": label,
                "fraction": frac,
                "lat": round(lat_s, 4),
                "lon": round(lon_s, 4),
                "risk_level": summary["risk_level"],
                "risk_color": summary["risk_color"],
                "beaufort_scale": summary["beaufort_scale"],
                "wind_speed_knots": summary["wind_speed_knots"],
                "wave_height_m": summary["wave_height_m"],
                "swell_height_m": summary["swell_height_m"],
                "data_status": summary["data_status"]["overall"],
                "recommendations": summary["recommendations"],
            })
            if summary["beaufort_scale"] is not None:
                scores.append(summary["beaufort_scale"])

        # Only points with a usable wind reading take part. With none, the overall risk is unknown.
        overall_risk = risk_level(max(scores)) if scores else None
        if len(scores) == len(risk_zones):
            coverage = 'available'
        elif scores:
            coverage = 'partial'
        else:
            coverage = UNAVAILABLE

        return jsonify({
            'success': True,
            'risk_zones': risk_zones,
            'overall_risk_level': overall_risk,
            'overall_risk_color': _risk_color(overall_risk),
            'avg_beaufort': round(sum(scores) / len(scores), 1) if scores else None,
            'max_beaufort': max(scores) if scores else None,
            'sample_points': len(risk_zones),
            'points_assessed': len(scores),
            'data_status': coverage,
            'route_basis': 'great_circle_sample',
            'limitations': 'Samples a straight great-circle line, not a navigable route.',
            'provider': PROVIDER,
            'assessed_at': datetime.utcnow().isoformat(),
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Route risk error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to assess route weather risk.'}), 500


@weather_bp.route('/forecast', methods=['POST'])
@tenant_required('read')
def weather_forecast():
    """
    POST /api/weather/forecast
    Body: {lat, lon, days?}  returns a daily forecast. Days the provider gave no value for
    carry null, never zero.
    """
    try:
        data = request.get_json(force=True) or {}
        if data.get('lat') is None or data.get('lon') is None:
            return jsonify({'success': False, 'error': 'lat and lon are required.'}), 400
        lat = float(data['lat'])
        lon = float(data['lon'])
        days = min(max(int(data.get('days', 7)), 1), 7)

        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return jsonify({'success': False, 'error': 'lat must be -90..90 and lon -180..180.'}), 400

        atmo_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "wind_speed_10m_max,wind_direction_10m_dominant,precipitation_sum",
            "forecast_days": days,
            "wind_speed_unit": "kmh",
            "timezone": "UTC",
        }
        marine_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "wave_height_max,swell_wave_height_max",
            "forecast_days": days,
            "timezone": "UTC",
        }

        try:
            atmo_resp = requests.get(f"{OPEN_METEO_BASE}/forecast", params=atmo_params, timeout=REQUEST_TIMEOUT)
            atmo_resp.raise_for_status()
            atmo_daily = atmo_resp.json().get('daily', {})
        except (requests.RequestException, ValueError) as exc:
            current_app.logger.warning(f'Forecast atmosphere error: {exc}')
            atmo_daily = {}

        try:
            marine_resp = requests.get(f"{MARINE_API_BASE}/marine", params=marine_params, timeout=REQUEST_TIMEOUT)
            marine_resp.raise_for_status()
            marine_daily = marine_resp.json().get('daily', {})
        except (requests.RequestException, ValueError) as exc:
            current_app.logger.warning(f'Forecast marine error: {exc}')
            marine_daily = {}

        def round_or_none(value, digits):
            return None if value is None else round(value, digits)

        forecast = []
        for i, date_str in enumerate(atmo_daily.get('time', [])):
            ws_kmh = daily_value(atmo_daily, 'wind_speed_10m_max', i)
            bf = beaufort_from_kmh(ws_kmh)
            level = risk_level(bf)
            forecast.append({
                "date": date_str,
                "wind_speed_kmh": round_or_none(ws_kmh, 1),
                "wind_speed_knots": kmh_to_knots(ws_kmh),
                "wind_direction_deg": daily_value(atmo_daily, 'wind_direction_10m_dominant', i),
                "precipitation_mm": round_or_none(daily_value(atmo_daily, 'precipitation_sum', i), 2),
                "wave_height_m": round_or_none(daily_value(marine_daily, 'wave_height_max', i), 2),
                "swell_height_m": round_or_none(daily_value(marine_daily, 'swell_wave_height_max', i), 2),
                "beaufort_scale": bf,
                "risk_level": level,
                "risk_color": _risk_color(level),
            })

        atmosphere_status = 'available' if forecast else UNAVAILABLE
        marine_status = 'available' if marine_daily.get('time') else UNAVAILABLE
        overall = ('available' if atmosphere_status == marine_status == 'available'
                   else UNAVAILABLE if atmosphere_status == marine_status == UNAVAILABLE else 'partial')

        return jsonify({
            'success': True,
            'lat': lat,
            'lon': lon,
            'forecast_days': days,
            'forecast': forecast,
            'data_status': {'overall': overall, 'atmosphere': atmosphere_status, 'marine': marine_status},
            'provider': PROVIDER,
            'generated_at': datetime.utcnow().isoformat(),
        }), 200

    except (ValueError, TypeError) as exc:
        return jsonify({'success': False, 'error': f'Invalid value: {exc}'}), 400
    except Exception as exc:
        current_app.logger.error(f'Forecast error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to retrieve forecast.'}), 500


# ---------------------------------------------------------------------------
# NEW: Advanced Weather Impact Analysis Endpoints
# ---------------------------------------------------------------------------

def _calculate_beaufort_from_knots(wind_knots: float) -> int:
    """Convert wind speed in knots to Beaufort scale."""
    thresholds = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63]
    for i, t in enumerate(thresholds):
        if wind_knots < t:
            return i
    return 12


def _headwind_analysis(wind_speed_knots: float, base_speed: float, base_fuel_mt_day: float, distance_nm: float = 0) -> dict:
    """
    Calculate performance impact of headwind on vessel.
    Formula: wind resistance ≈ k * wind_speed^2 — speed loss follows parabolic relationship.
    """
    bf = _calculate_beaufort_from_knots(wind_speed_knots)
    # Speed loss: approximately 0-15% depending on wind intensity
    speed_loss_pct = min(0.18, (wind_speed_knots / 40) ** 2 * 0.18)
    speed_loss_knots = round(base_speed * speed_loss_pct, 3)
    adjusted_speed = round(max(3.0, base_speed - speed_loss_knots), 2)

    # Fuel penalty: cubic relationship with effective speed increase needed
    fuel_penalty_pct = min(0.30, (wind_speed_knots / 50) ** 2 * 0.28)
    fuel_penalty_mt = round(base_fuel_mt_day * fuel_penalty_pct, 3)
    total_fuel = round(base_fuel_mt_day + fuel_penalty_mt, 3)

    # ETA impact
    if distance_nm > 0 and adjusted_speed > 0:
        base_duration_hrs = distance_nm / base_speed
        adjusted_duration_hrs = distance_nm / adjusted_speed
        eta_delay_hrs = round(adjusted_duration_hrs - base_duration_hrs, 2)
    else:
        eta_delay_hrs = None

    return {
        'analysis_type': 'headwind',
        'wind_speed_knots': round(wind_speed_knots, 1),
        'beaufort_scale': bf,
        'severity': _risk_level_from_beaufort(bf),
        'base_speed_knots': base_speed,
        'adjusted_speed_knots': adjusted_speed,
        'speed_loss_knots': round(speed_loss_knots, 3),
        'speed_loss_pct': round(speed_loss_pct * 100, 2),
        'base_fuel_mt_day': base_fuel_mt_day,
        'fuel_penalty_mt_day': fuel_penalty_mt,
        'total_fuel_mt_day': total_fuel,
        'fuel_penalty_pct': round(fuel_penalty_pct * 100, 2),
        'eta_delay_hours': eta_delay_hrs,
        'recommendations': [
            f'Headwind of {wind_speed_knots:.1f} kts (Beaufort {bf}) is causing {speed_loss_knots:.2f} knot speed loss.',
            f'Fuel penalty: +{fuel_penalty_mt:.2f} MT/day ({fuel_penalty_pct*100:.1f}% above normal).',
            'Consider reducing RPM by 5-8% to maintain fuel budget.' if bf >= 5 else 'Monitor fuel consumption for any deviation from plan.',
            'Review alternative routing to reduce headwind exposure.' if bf >= 7 else 'Continue on planned route with increased fuel monitoring.'
        ]
    }


def _tailwind_analysis(wind_speed_knots: float, base_speed: float, base_fuel_mt_day: float, distance_nm: float = 0) -> dict:
    """Calculate performance benefit of tailwind assistance."""
    bf = _calculate_beaufort_from_knots(wind_speed_knots)
    # Speed gain: approximately 0-8% — smaller than headwind loss due to vessel design
    speed_gain_pct = min(0.09, (wind_speed_knots / 60) * 0.09)
    speed_gain_knots = round(base_speed * speed_gain_pct, 3)
    adjusted_speed = round(base_speed + speed_gain_knots, 2)

    # Fuel savings — can reduce engine output while maintaining speed
    fuel_savings_pct = min(0.12, (wind_speed_knots / 70) * 0.12)
    fuel_savings_mt = round(base_fuel_mt_day * fuel_savings_pct, 3)
    total_fuel = round(base_fuel_mt_day - fuel_savings_mt, 3)

    if distance_nm > 0:
        time_saving_hrs = round(distance_nm / base_speed - distance_nm / adjusted_speed, 2)
    else:
        time_saving_hrs = None

    return {
        'analysis_type': 'tailwind',
        'wind_speed_knots': round(wind_speed_knots, 1),
        'beaufort_scale': bf,
        'base_speed_knots': base_speed,
        'adjusted_speed_knots': adjusted_speed,
        'speed_gain_knots': round(speed_gain_knots, 3),
        'speed_gain_pct': round(speed_gain_pct * 100, 2),
        'base_fuel_mt_day': base_fuel_mt_day,
        'fuel_savings_mt_day': fuel_savings_mt,
        'total_fuel_mt_day': total_fuel,
        'fuel_savings_pct': round(fuel_savings_pct * 100, 2),
        'time_saving_hours': time_saving_hrs,
        'recommendations': [
            f'Tailwind of {wind_speed_knots:.1f} kts is providing a {speed_gain_knots:.2f} knot speed assistance.',
            f'Fuel savings opportunity: -{fuel_savings_mt:.2f} MT/day by reducing RPM to maintain warranted speed.',
            'Recommend reducing engine output to capture fuel savings while maintaining ETA.',
            f'Estimated savings: ${fuel_savings_mt * 620:.0f}/day at current bunker prices.'
        ]
    }


def _crosswind_analysis(wind_speed_knots: float, base_speed: float, base_fuel_mt_day: float) -> dict:
    """Calculate crosswind (beam wind) steering and resistance impact."""
    bf = _calculate_beaufort_from_knots(wind_speed_knots)
    # Crosswind causes leeway and increased resistance — smaller than headwind but significant
    resistance_increase_pct = min(0.08, (wind_speed_knots / 50) ** 2 * 0.08)
    fuel_penalty_mt = round(base_fuel_mt_day * resistance_increase_pct, 3)
    # Speed loss due to leeway correction (rudder drag)
    speed_loss_knots = round(base_speed * resistance_increase_pct * 0.6, 3)
    leeway_deg = round(min(5.0, (wind_speed_knots / 20) * 2.5), 2)

    return {
        'analysis_type': 'crosswind',
        'wind_speed_knots': round(wind_speed_knots, 1),
        'beaufort_scale': bf,
        'base_speed_knots': base_speed,
        'adjusted_speed_knots': round(max(3, base_speed - speed_loss_knots), 2),
        'speed_loss_knots': round(speed_loss_knots, 3),
        'leeway_degrees': leeway_deg,
        'fuel_penalty_mt_day': fuel_penalty_mt,
        'resistance_increase_pct': round(resistance_increase_pct * 100, 2),
        'base_fuel_mt_day': base_fuel_mt_day,
        'total_fuel_mt_day': round(base_fuel_mt_day + fuel_penalty_mt, 3),
        'recommendations': [
            f'Beam wind of {wind_speed_knots:.1f} kts causing {leeway_deg}° leeway drift.',
            f'Steering correction increasing fuel consumption by +{fuel_penalty_mt:.2f} MT/day.',
            'Consider taking wind 20-30° on the bow to reduce crosswind exposure.' if bf >= 5 else 'Crosswind impact is manageable. Continue monitoring.',
            'Monitor cargo lashing and securing — beam seas increase rolling motion.'
        ]
    }


def _current_impact_analysis(current_speed_knots: float, current_favorable: bool,
                              base_speed: float, base_fuel_mt_day: float, distance_nm: float = 0) -> dict:
    """Calculate ocean current impact on effective speed and fuel consumption."""
    direction = 'favorable' if current_favorable else 'adverse'
    effective_current = current_speed_knots * 0.85  # ~85% efficiency factor

    if current_favorable:
        effective_speed = round(base_speed + effective_current, 2)
        fuel_savings_mt = round(base_fuel_mt_day * (effective_current / (base_speed + effective_current)), 3)
        total_fuel = round(base_fuel_mt_day - fuel_savings_mt, 3)
        fuel_impact = -fuel_savings_mt
    else:
        effective_speed = round(max(3, base_speed - effective_current), 2)
        extra_power_needed = effective_current / base_speed
        fuel_penalty_mt = round(base_fuel_mt_day * extra_power_needed * 0.7, 3)
        total_fuel = round(base_fuel_mt_day + fuel_penalty_mt, 3)
        fuel_impact = fuel_penalty_mt

    if distance_nm > 0 and effective_speed > 0:
        base_duration_hrs = distance_nm / base_speed
        adj_duration_hrs = distance_nm / effective_speed
        eta_impact_hrs = round(adj_duration_hrs - base_duration_hrs, 2)
    else:
        eta_impact_hrs = None

    return {
        'analysis_type': 'current',
        'current_speed_knots': round(current_speed_knots, 2),
        'current_direction': direction,
        'effective_current_knots': round(effective_current, 2),
        'base_speed_knots': base_speed,
        'effective_speed_knots': effective_speed,
        'speed_impact_knots': round(effective_speed - base_speed, 3),
        'base_fuel_mt_day': base_fuel_mt_day,
        'fuel_impact_mt_day': round(fuel_impact, 3),
        'total_fuel_mt_day': round(total_fuel, 3),
        'eta_impact_hours': eta_impact_hrs,
        'is_favorable': current_favorable,
        'recommendations': [
            f'Ocean current of {current_speed_knots} kts ({direction}) — effective speed: {effective_speed} kts.',
            f'{"Fuel saving" if current_favorable else "Fuel penalty"}: {abs(fuel_impact):.2f} MT/day.',
            ('Reduce engine output to capitalize on favorable current.' if current_favorable
             else 'Adverse current is increasing fuel consumption. Monitor ROB carefully.'),
            (f'ETA improved by {abs(eta_impact_hrs):.1f} hrs.' if current_favorable and eta_impact_hrs
             else f'ETA delayed by {abs(eta_impact_hrs):.1f} hrs due to adverse current.' if eta_impact_hrs else '')
        ]
    }


def _wave_swell_analysis(wave_height_m: float, swell_height_m: float, base_speed: float, base_fuel_mt_day: float) -> dict:
    """Calculate wave and swell resistance impact."""
    # Wave resistance (significant wave height)
    if wave_height_m <= 0.5:
        wave_resistance_pct = 0
        classification = 'low'
    elif wave_height_m <= 1.5:
        wave_resistance_pct = wave_height_m * 0.02
        classification = 'low'
    elif wave_height_m <= 3.0:
        wave_resistance_pct = 0.03 + (wave_height_m - 1.5) * 0.025
        classification = 'moderate'
    elif wave_height_m <= 5.0:
        wave_resistance_pct = 0.068 + (wave_height_m - 3.0) * 0.03
        classification = 'high'
    else:
        wave_resistance_pct = min(0.20, 0.128 + (wave_height_m - 5.0) * 0.025)
        classification = 'critical'

    # Swell impact (adds to motion but less resistance than wind waves)
    swell_resistance_pct = min(0.06, swell_height_m * 0.012)

    total_resistance_pct = wave_resistance_pct + swell_resistance_pct
    speed_loss_knots = round(base_speed * total_resistance_pct, 3)
    fuel_penalty_mt = round(base_fuel_mt_day * (wave_resistance_pct * 0.9 + swell_resistance_pct * 0.5), 3)

    return {
        'wave_height_m': round(wave_height_m, 2),
        'swell_height_m': round(swell_height_m, 2),
        'classification': classification,
        'wave_resistance_pct': round(wave_resistance_pct * 100, 2),
        'swell_resistance_pct': round(swell_resistance_pct * 100, 2),
        'total_resistance_pct': round(total_resistance_pct * 100, 2),
        'speed_loss_knots': round(speed_loss_knots, 3),
        'adjusted_speed_knots': round(max(3, base_speed - speed_loss_knots), 2),
        'fuel_penalty_mt_day': fuel_penalty_mt,
        'total_fuel_mt_day': round(base_fuel_mt_day + fuel_penalty_mt, 3),
        'base_fuel_mt_day': base_fuel_mt_day,
    }


def _weather_attribution(wind_knots: float, wave_height: float, swell_height: float,
                         current_knots: float, current_favorable: bool,
                         base_fuel_mt_day: float) -> dict:
    """
    Break total fuel consumption into attributable components.
    Returns: normal fuel, wind penalty, wave penalty, current penalty, swell penalty.
    """
    head_res = _headwind_analysis(wind_knots, 14, base_fuel_mt_day)
    wave_res = _wave_swell_analysis(wave_height, swell_height, 14, base_fuel_mt_day)
    cur_res = _current_impact_analysis(current_knots, current_favorable, 14, base_fuel_mt_day)

    wind_penalty = head_res['fuel_penalty_mt_day']
    wave_penalty = wave_res['fuel_penalty_mt_day'] * 0.7
    swell_penalty = wave_res['fuel_penalty_mt_day'] * 0.3
    current_penalty = cur_res['fuel_impact_mt_day'] if not current_favorable else -abs(cur_res['fuel_impact_mt_day'])

    total_penalty = wind_penalty + wave_penalty + swell_penalty + max(0, current_penalty)
    normal_fuel = base_fuel_mt_day
    total_fuel = normal_fuel + total_penalty

    return {
        'total_fuel_mt_day': round(total_fuel, 3),
        'attribution': {
            'normal_consumption': {
                'mt_day': round(normal_fuel, 3),
                'pct': round(normal_fuel / total_fuel * 100, 1) if total_fuel > 0 else 100
            },
            'wind_impact': {
                'mt_day': round(wind_penalty, 3),
                'pct': round(wind_penalty / total_fuel * 100, 1) if total_fuel > 0 else 0,
                'beaufort': _calculate_beaufort_from_knots(wind_knots)
            },
            'wave_impact': {
                'mt_day': round(wave_penalty, 3),
                'pct': round(wave_penalty / total_fuel * 100, 1) if total_fuel > 0 else 0,
                'wave_height_m': wave_height
            },
            'current_impact': {
                'mt_day': round(abs(current_penalty), 3),
                'pct': round(abs(current_penalty) / total_fuel * 100, 1) if total_fuel > 0 else 0,
                'is_penalty': not current_favorable
            },
            'swell_impact': {
                'mt_day': round(swell_penalty, 3),
                'pct': round(swell_penalty / total_fuel * 100, 1) if total_fuel > 0 else 0,
                'swell_height_m': swell_height
            }
        },
        'weather_excess_pct': round(total_penalty / base_fuel_mt_day * 100, 2) if base_fuel_mt_day > 0 else 0
    }


@weather_bp.route('/wind-impact', methods=['POST'])
@tenant_required('read')
def wind_impact():
    """
    POST /api/weather/wind-impact
    Body: {wind_speed_knots, wind_direction: head|tail|cross,
           base_speed, base_fuel_mt_day, distance_nm?, wave_height_m?, swell_height_m?,
           current_speed_knots?, current_favorable?}
    Returns: comprehensive wind/current/wave impact analysis.
    """
    try:
        data = request.get_json(force=True) or {}
        missing = [k for k in ('wind_speed_knots', 'base_speed', 'base_fuel_mt_day', 'wave_height_m', 'swell_height_m')
                   if data.get(k) in (None, '')]
        if missing:
            return jsonify({'success': False, 'error': f"Missing required inputs: {', '.join(missing)}. "
                            "This is a what-if calculator; it does not assume values."}), 400
        if data.get('wind_direction') not in ('head', 'tail', 'cross'):
            return jsonify({'success': False, 'error': "wind_direction must be 'head', 'tail' or 'cross'."}), 400
        wind_speed = float(data['wind_speed_knots'])
        wind_dir = data['wind_direction']
        base_speed = float(data['base_speed'])
        base_fuel = float(data['base_fuel_mt_day'])
        distance_nm = float(data.get('distance_nm') or 0)   # 0 = no voyage-level totals requested
        wave_height = float(data['wave_height_m'])
        swell_height = float(data['swell_height_m'])
        current_speed = float(data.get('current_speed_knots') or 0)   # 0 = no current
        current_favorable = bool(data.get('current_favorable', False))
        if base_speed <= 0 or min(wind_speed, base_fuel, wave_height, swell_height, current_speed) < 0:
            return jsonify({'success': False, 'error': 'Inputs must be non-negative and base_speed must be positive.'}), 400

        result = {}
        if wind_dir == 'head':
            result['wind'] = _headwind_analysis(wind_speed, base_speed, base_fuel, distance_nm)
        elif wind_dir == 'tail':
            result['wind'] = _tailwind_analysis(wind_speed, base_speed, base_fuel, distance_nm)
        elif wind_dir == 'cross':
            result['wind'] = _crosswind_analysis(wind_speed, base_speed, base_fuel)

        result['wave'] = _wave_swell_analysis(wave_height, swell_height, base_speed, base_fuel)

        if current_speed > 0:
            result['current'] = _current_impact_analysis(current_speed, current_favorable, base_speed, base_fuel, distance_nm)

        result['attribution'] = _weather_attribution(
            wind_speed, wave_height, swell_height,
            current_speed, current_favorable, base_fuel
        )

        return jsonify({'success': True, **result}), 200

    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Inputs must be numbers.'}), 400
    except Exception as exc:
        current_app.logger.error(f'Wind impact error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Request failed'}), 500


@weather_bp.route('/attribution', methods=['POST'])
@tenant_required('read')
def fuel_attribution():
    """
    POST /api/weather/attribution
    Returns fuel consumption breakdown by weather cause.
    """
    try:
        data = request.get_json(force=True) or {}
        missing = [k for k in ('wind_speed_knots', 'wave_height_m', 'swell_height_m', 'base_fuel_mt_day')
                   if data.get(k) in (None, '')]
        if missing:
            return jsonify({'success': False, 'error': f"Missing required inputs: {', '.join(missing)}. "
                            "This is a what-if calculator; it does not assume values."}), 400
        wind_knots = float(data['wind_speed_knots'])
        wave_m = float(data['wave_height_m'])
        swell_m = float(data['swell_height_m'])
        current_kts = float(data.get('current_speed_knots') or 0)   # 0 = no current
        current_fav = bool(data.get('current_favorable', False))
        base_fuel = float(data['base_fuel_mt_day'])
        if min(wind_knots, wave_m, swell_m, current_kts, base_fuel) < 0:
            return jsonify({'success': False, 'error': 'Inputs must be non-negative.'}), 400

        result = _weather_attribution(wind_knots, wave_m, swell_m, current_kts, current_fav, base_fuel)
        return jsonify({'success': True, **result}), 200

    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Inputs must be numbers.'}), 400
    except Exception as exc:
        current_app.logger.error(f'Attribution error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Request failed'}), 500
