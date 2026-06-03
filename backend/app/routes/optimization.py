"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ AI - Route Optimization Blueprint
Handles route generation, fuel simulation, and port listings.
"""
import math
import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import Route, Vessel, Voyage

optimization_bp = Blueprint('optimization', __name__)

# ---------------------------------------------------------------------------
# World Port Database  (44 major ports)
# ---------------------------------------------------------------------------
WORLD_PORTS = {
    # Asia Pacific
    "Singapore": {"lat": 1.2897, "lon": 103.8501, "region": "Asia Pacific", "country": "Singapore"},
    "Shanghai": {"lat": 31.2304, "lon": 121.4737, "region": "Asia Pacific", "country": "China"},
    "Busan": {"lat": 35.0996, "lon": 129.0403, "region": "Asia Pacific", "country": "South Korea"},
    "Hong Kong": {"lat": 22.2793, "lon": 114.1628, "region": "Asia Pacific", "country": "China"},
    "Tokyo Bay (Tokyo)": {"lat": 35.6295, "lon": 139.7711, "region": "Asia Pacific", "country": "Japan"},
    "Yokohama": {"lat": 35.4437, "lon": 139.6380, "region": "Asia Pacific", "country": "Japan"},
    "Kaohsiung": {"lat": 22.6237, "lon": 120.3014, "region": "Asia Pacific", "country": "Taiwan"},
    "Port Klang": {"lat": 2.9937, "lon": 101.3765, "region": "Asia Pacific", "country": "Malaysia"},
    "Tanjung Pelepas": {"lat": 1.3644, "lon": 103.5530, "region": "Asia Pacific", "country": "Malaysia"},
    "Guangzhou (Nansha)": {"lat": 22.7784, "lon": 113.5671, "region": "Asia Pacific", "country": "China"},
    "Tianjin": {"lat": 38.9906, "lon": 117.7229, "region": "Asia Pacific", "country": "China"},
    "Qingdao": {"lat": 36.0671, "lon": 120.3826, "region": "Asia Pacific", "country": "China"},
    "Ningbo-Zhoushan": {"lat": 29.8683, "lon": 121.5440, "region": "Asia Pacific", "country": "China"},
    "Jakarta (Tanjung Priok)": {"lat": -6.1087, "lon": 106.8801, "region": "Asia Pacific", "country": "Indonesia"},
    "Manila": {"lat": 14.5794, "lon": 120.9645, "region": "Asia Pacific", "country": "Philippines"},
    "Bangkok (Laem Chabang)": {"lat": 13.0825, "lon": 100.8823, "region": "Asia Pacific", "country": "Thailand"},
    "Ho Chi Minh City": {"lat": 10.7769, "lon": 106.7009, "region": "Asia Pacific", "country": "Vietnam"},
    "Sydney": {"lat": -33.8523, "lon": 151.2108, "region": "Asia Pacific", "country": "Australia"},
    "Melbourne": {"lat": -37.8418, "lon": 144.9286, "region": "Asia Pacific", "country": "Australia"},
    # South Asia / Middle East
    "Mumbai": {"lat": 18.9322, "lon": 72.8374, "region": "South Asia", "country": "India"},
    "Jawaharlal Nehru (JNPT)": {"lat": 18.9440, "lon": 72.9428, "region": "South Asia", "country": "India"},
    "Colombo": {"lat": 6.9271, "lon": 79.8612, "region": "South Asia", "country": "Sri Lanka"},
    "Dubai (Jebel Ali)": {"lat": 24.9857, "lon": 55.0648, "region": "Middle East", "country": "UAE"},
    "Abu Dhabi": {"lat": 24.4667, "lon": 54.3667, "region": "Middle East", "country": "UAE"},
    "Oman (Sohar)": {"lat": 24.3586, "lon": 56.6267, "region": "Middle East", "country": "Oman"},
    "Saudi Arabia (Dammam)": {"lat": 26.4207, "lon": 50.1033, "region": "Middle East", "country": "Saudi Arabia"},
    # Africa
    "Durban": {"lat": -29.8587, "lon": 31.0218, "region": "Africa", "country": "South Africa"},
    "Cape Town": {"lat": -33.9249, "lon": 18.4241, "region": "Africa", "country": "South Africa"},
    "Mombasa": {"lat": -4.0435, "lon": 39.6682, "region": "Africa", "country": "Kenya"},
    "Dar es Salaam": {"lat": -6.7924, "lon": 39.2083, "region": "Africa", "country": "Tanzania"},
    "Lagos (Apapa)": {"lat": 6.4530, "lon": 3.3841, "region": "Africa", "country": "Nigeria"},
    # Europe
    "Rotterdam": {"lat": 51.9244, "lon": 4.4777, "region": "Europe", "country": "Netherlands"},
    "Antwerp": {"lat": 51.2194, "lon": 4.4025, "region": "Europe", "country": "Belgium"},
    "Hamburg": {"lat": 53.5488, "lon": 9.9872, "region": "Europe", "country": "Germany"},
    "Felixstowe": {"lat": 51.9603, "lon": 1.3513, "region": "Europe", "country": "UK"},
    "Bremerhaven": {"lat": 53.5386, "lon": 8.5802, "region": "Europe", "country": "Germany"},
    "Barcelona": {"lat": 41.3515, "lon": 2.1734, "region": "Europe", "country": "Spain"},
    "Piraeus": {"lat": 37.9480, "lon": 23.6441, "region": "Europe", "country": "Greece"},
    "Genoa": {"lat": 44.4056, "lon": 8.9463, "region": "Europe", "country": "Italy"},
    # Americas
    "Los Angeles": {"lat": 33.7322, "lon": -118.2595, "region": "North America", "country": "USA"},
    "Long Beach": {"lat": 33.7548, "lon": -118.2164, "region": "North America", "country": "USA"},
    "New York/New Jersey": {"lat": 40.6892, "lon": -74.0445, "region": "North America", "country": "USA"},
    "Houston (Barbours Cut)": {"lat": 29.7604, "lon": -94.9747, "region": "North America", "country": "USA"},
    "Vancouver": {"lat": 49.2827, "lon": -123.1207, "region": "North America", "country": "Canada"},
    "Santos": {"lat": -23.9535, "lon": -46.3333, "region": "South America", "country": "Brazil"},
    "Colon (Panama)": {"lat": 9.3548, "lon": -79.9002, "region": "Central America", "country": "Panama"},
    "Cartagena": {"lat": 10.3910, "lon": -75.4794, "region": "South America", "country": "Colombia"},
}

# ---------------------------------------------------------------------------
# Vessel fuel constants  (k-factor per vessel type)
# ---------------------------------------------------------------------------
VESSEL_FUEL_CONSTANTS = {
    "container":     {"k": 0.00028, "base_consumption_mt_day": 85,  "fuel_price_usd": 650},
    "bulk carrier":  {"k": 0.00018, "base_consumption_mt_day": 45,  "fuel_price_usd": 620},
    "tanker":        {"k": 0.00022, "base_consumption_mt_day": 60,  "fuel_price_usd": 630},
    "vlcc":          {"k": 0.00032, "base_consumption_mt_day": 110, "fuel_price_usd": 620},
    "lng carrier":   {"k": 0.00020, "base_consumption_mt_day": 140, "fuel_price_usd": 900},
    "roro":          {"k": 0.00015, "base_consumption_mt_day": 50,  "fuel_price_usd": 650},
    "general cargo": {"k": 0.00012, "base_consumption_mt_day": 30,  "fuel_price_usd": 640},
    "default":       {"k": 0.00020, "base_consumption_mt_day": 55,  "fuel_price_usd": 640},
}

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in nautical miles between two coordinates."""
    R_NM = 3440.065  # Earth radius in nautical miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R_NM * math.asin(math.sqrt(a))


def _intermediate_point(lat1, lon1, lat2, lon2, fraction):
    """Return (lat, lon) at a given fraction along the great-circle between two points."""
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


def _build_waypoints(origin_lat, origin_lon, dest_lat, dest_lon, distance_nm, offset_factor=0.0):
    """
    Generate a list of waypoint dicts along (or slightly offset from) the great-circle route.
    Adds intermediate waypoints for routes longer than 1 000 nm.
    offset_factor shifts the mid-point perpendicular to the route for route variants.
    """
    waypoints = [{"lat": round(origin_lat, 4), "lon": round(origin_lon, 4)}]

    num_intermediates = max(1, int(distance_nm // 1000))  # one per ~1 000 nm
    num_intermediates = min(num_intermediates, 6)           # cap at 6

    for i in range(1, num_intermediates + 1):
        frac = i / (num_intermediates + 1)
        lat_i, lon_i = _intermediate_point(origin_lat, origin_lon, dest_lat, dest_lon, frac)
        # Apply perpendicular offset for route variants
        if offset_factor != 0:
            perp_lat = lat_i + offset_factor * math.cos(math.radians(lon_i))
            perp_lon = lon_i + offset_factor * math.sin(math.radians(lat_i))
            lat_i = max(-89.0, min(89.0, perp_lat))
            lon_i = max(-179.9, min(179.9, perp_lon))
        waypoints.append({"lat": round(lat_i, 4), "lon": round(lon_i, 4)})

    waypoints.append({"lat": round(dest_lat, 4), "lon": round(dest_lon, 4)})
    return waypoints


def _fuel_consumption(speed_knots, distance_nm, vessel_type):
    """
    Estimate fuel consumption (MT) using the cubic admiralty formula.
    consumption = k * speed^3 * (distance / speed) = k * speed^2 * distance
    """
    vt = vessel_type.lower() if vessel_type else "default"
    params = VESSEL_FUEL_CONSTANTS.get(vt, VESSEL_FUEL_CONSTANTS["default"])
    k = params["k"]
    return k * (speed_knots ** 2) * distance_nm


def _build_weather_risk_zones(origin_lat, origin_lon, dest_lat, dest_lon):
    """Generate illustrative weather risk zones along a route."""
    zones = []
    risk_configs = [
        {"severity": "low",    "color": "#22c55e", "radius_nm": 80},
        {"severity": "medium", "color": "#f59e0b", "radius_nm": 100},
        {"severity": "high",   "color": "#ef4444", "radius_nm": 60},
    ]
    for i, cfg in enumerate(risk_configs):
        frac = 0.25 + i * 0.25
        lat_z, lon_z = _intermediate_point(origin_lat, origin_lon, dest_lat, dest_lon, frac)
        # slight random shift so zones don't all fall on the route centreline
        lat_z += random.uniform(-1.5, 1.5)
        lon_z += random.uniform(-2.0, 2.0)
        zones.append({
            "center": {"lat": round(lat_z, 4), "lon": round(lon_z, 4)},
            "radius_nm": cfg["radius_nm"],
            "severity": cfg["severity"],
            "color": cfg["color"],
            "description": f"{cfg['severity'].capitalize()} weather risk area",
        })
    return zones


def _get_vessel_params(vessel_type: str):
    vt = (vessel_type or "").lower()
    return VESSEL_FUEL_CONSTANTS.get(vt, VESSEL_FUEL_CONSTANTS["default"])


def _beaufort_from_speed(wind_speed_kmh: float) -> int:
    thresholds = [1, 5, 11, 19, 28, 38, 49, 61, 74]
    for bf, thr in enumerate(thresholds):
        if wind_speed_kmh <= thr:
            return bf
    return 9

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@optimization_bp.route('/route', methods=['POST'])
@jwt_required()
def generate_route():
    """
    POST /api/optimization/route
    Generate 4 optimised route variants between two ports.
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json(force=True) or {}

        origin_name = data.get('origin_port', '').strip()
        dest_name = data.get('destination_port', '').strip()
        vessel_type = data.get('vessel_type', 'container')
        speed_knots = float(data.get('speed_knots', 14.0))
        vessel_id = data.get('vessel_id')

        # Validate ports
        if origin_name not in WORLD_PORTS:
            return jsonify({
                'success': False,
                'error': f"Origin port '{origin_name}' not found. Use GET /api/optimization/ports for valid options."
            }), 400
        if dest_name not in WORLD_PORTS:
            return jsonify({
                'success': False,
                'error': f"Destination port '{dest_name}' not found. Use GET /api/optimization/ports for valid options."
            }), 400
        if origin_name == dest_name:
            return jsonify({'success': False, 'error': 'Origin and destination must be different ports.'}), 400
        if not (1.0 <= speed_knots <= 30.0):
            return jsonify({'success': False, 'error': 'speed_knots must be between 1 and 30.'}), 400

        origin = WORLD_PORTS[origin_name]
        dest = WORLD_PORTS[dest_name]
        base_distance = _haversine_nm(origin['lat'], origin['lon'], dest['lat'], dest['lon'])
        vessel_params = _get_vessel_params(vessel_type)
        fuel_price = vessel_params['fuel_price_usd']

        weather_zones = _build_weather_risk_zones(origin['lat'], origin['lon'], dest['lat'], dest['lon'])

        # ------------------------------------------------------------------ #
        #  4 Route Variants
        # ------------------------------------------------------------------ #
        route_specs = [
            {
                "route_type":    "optimal",
                "label":         "Optimal Route",
                "description":   "Best balance of fuel efficiency, time, and safety.",
                "speed_factor":  1.00,
                "dist_factor":   1.00,
                "offset":        0.0,
                "risk_modifier": 1.0,
                "color":         "#3b82f6",
            },
            {
                "route_type":    "fastest",
                "label":         "Fastest Route",
                "description":   "Minimum transit time, higher fuel burn.",
                "speed_factor":  1.20,
                "dist_factor":   0.98,
                "offset":        0.5,
                "risk_modifier": 1.2,
                "color":         "#f59e0b",
            },
            {
                "route_type":    "eco",
                "label":         "Eco Route",
                "description":   "Minimum fuel burn via slow steaming.",
                "speed_factor":  0.78,
                "dist_factor":   1.03,
                "offset":        -0.8,
                "risk_modifier": 0.8,
                "color":         "#22c55e",
            },
            {
                "route_type":    "safest",
                "label":         "Safest Route",
                "description":   "Routes away from high-risk weather zones.",
                "speed_factor":  0.90,
                "dist_factor":   1.08,
                "offset":        1.5,
                "risk_modifier": 0.5,
                "color":         "#a855f7",
            },
        ]

        routes = []
        saved_route_ids = []

        for spec in route_specs:
            eff_speed = round(speed_knots * spec['speed_factor'], 2)
            eff_distance = round(base_distance * spec['dist_factor'], 1)
            duration_hrs = round(eff_distance / eff_speed, 1) if eff_speed > 0 else 0
            fuel_mt = round(_fuel_consumption(eff_speed, eff_distance, vessel_type), 2)
            cost_usd = round(fuel_mt * fuel_price, 0)
            risk_score = round(min(10.0, (random.uniform(2.5, 5.5) * spec['risk_modifier'])), 1)
            waypoints = _build_waypoints(
                origin['lat'], origin['lon'],
                dest['lat'], dest['lon'],
                eff_distance,
                offset_factor=spec['offset'],
            )

            route_obj = {
                "route_type":    spec['route_type'],
                "label":         spec['label'],
                "description":   spec['description'],
                "color":         spec['color'],
                "waypoints":     waypoints,
                "distance_nm":   eff_distance,
                "duration_hrs":  duration_hrs,
                "fuel_mt":       fuel_mt,
                "cost_usd":      int(cost_usd),
                "risk_score":    risk_score,
                "speed_knots":   eff_speed,
            }
            routes.append(route_obj)

            # Persist to DB
            try:
                db_route = Route(
                    origin_port=origin_name,
                    destination_port=dest_name,
                    route_type=spec['route_type'],
                    waypoints=waypoints,
                    total_distance_nm=eff_distance,
                    estimated_duration_hrs=duration_hrs,
                    estimated_fuel_mt=fuel_mt,
                    estimated_cost_usd=int(cost_usd),
                    weather_risk_score=risk_score,
                    risk_zones=weather_zones,
                    created_by=user_id,
                )
                db.session.add(db_route)
                db.session.flush()
                saved_route_ids.append(db_route.id)
            except Exception:
                pass  # Non-fatal — continue even if DB save fails

        db.session.commit()

        return jsonify({
            'success': True,
            'routes': routes,
            'route_ids': saved_route_ids,
            'origin': {
                'name': origin_name,
                'lat': origin['lat'],
                'lon': origin['lon'],
                'country': origin['country'],
            },
            'destination': {
                'name': dest_name,
                'lat': dest['lat'],
                'lon': dest['lon'],
                'country': dest['country'],
            },
            'weather_risk_zones': weather_zones,
            'base_distance_nm': round(base_distance, 1),
            'vessel_type': vessel_type,
            'generated_at': datetime.utcnow().isoformat(),
        }), 200

    except ValueError as exc:
        return jsonify({'success': False, 'error': f'Invalid numeric value: {exc}'}), 400
    except Exception as exc:
        current_app.logger.error(f'Route generation error: {exc}', exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Internal server error during route generation.'}), 500


@optimization_bp.route('/fuel-simulator', methods=['POST'])
@jwt_required()
def fuel_simulator():
    """
    POST /api/optimization/fuel-simulator
    Simulate fuel consumption for given speed, distance, vessel type, and weather.
    """
    try:
        data = request.get_json(force=True) or {}

        speed_knots = float(data.get('speed_knots', 14.0))
        distance_nm = float(data.get('distance_nm', 1000.0))
        vessel_type = data.get('vessel_type', 'container')
        weather_condition = data.get('weather_condition', 'calm')  # calm | moderate | rough | storm

        if not (1.0 <= speed_knots <= 30.0):
            return jsonify({'success': False, 'error': 'speed_knots must be between 1 and 30.'}), 400
        if distance_nm <= 0:
            return jsonify({'success': False, 'error': 'distance_nm must be positive.'}), 400

        vessel_params = _get_vessel_params(vessel_type)
        fuel_price = vessel_params['fuel_price_usd']

        # Weather multiplier on fuel
        weather_multipliers = {"calm": 1.00, "moderate": 1.12, "rough": 1.28, "storm": 1.55}
        weather_mult = weather_multipliers.get(weather_condition.lower(), 1.0)

        # Baseline: same distance at 14 knots calm
        baseline_speed = 14.0
        baseline_fuel = _fuel_consumption(baseline_speed, distance_nm, vessel_type)

        # Simulated fuel
        raw_fuel = _fuel_consumption(speed_knots, distance_nm, vessel_type)
        fuel_mt = round(raw_fuel * weather_mult, 2)
        cost_usd = round(fuel_mt * fuel_price, 0)
        duration_hrs = round(distance_nm / speed_knots, 2) if speed_knots > 0 else 0
        eta_dt = (datetime.utcnow() + timedelta(hours=duration_hrs)).strftime('%Y-%m-%dT%H:%M:%SZ')

        savings_vs_baseline = round(baseline_fuel - fuel_mt, 2)
        savings_pct = round((savings_vs_baseline / baseline_fuel) * 100, 1) if baseline_fuel > 0 else 0.0

        # Speed comparison table
        comparison = []
        for s in [10, 12, 14, 16, 18, 20]:
            f = round(_fuel_consumption(s, distance_nm, vessel_type) * weather_mult, 2)
            comparison.append({
                "speed_knots": s,
                "fuel_mt": f,
                "cost_usd": int(f * fuel_price),
                "duration_hrs": round(distance_nm / s, 1),
            })

        return jsonify({
            'success': True,
            'fuel_mt': fuel_mt,
            'duration_hrs': duration_hrs,
            'cost_usd': int(cost_usd),
            'eta_datetime': eta_dt,
            'savings_vs_baseline': savings_vs_baseline,
            'savings_pct': savings_pct,
            'weather_condition': weather_condition,
            'weather_fuel_multiplier': weather_mult,
            'baseline_fuel_mt': round(baseline_fuel, 2),
            'fuel_price_usd_per_mt': fuel_price,
            'speed_comparison': comparison,
            'vessel_type': vessel_type,
        }), 200

    except ValueError as exc:
        return jsonify({'success': False, 'error': f'Invalid numeric value: {exc}'}), 400
    except Exception as exc:
        current_app.logger.error(f'Fuel simulator error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error during fuel simulation.'}), 500


@optimization_bp.route('/ports', methods=['GET'])
@jwt_required()
def get_ports():
    """
    GET /api/optimization/ports
    Return the full list of world ports with coordinates.
    """
    try:
        region_filter = request.args.get('region', '').strip()
        search = request.args.get('search', '').strip().lower()

        ports_list = []
        for name, info in WORLD_PORTS.items():
            if region_filter and info['region'].lower() != region_filter.lower():
                continue
            if search and search not in name.lower() and search not in info['country'].lower():
                continue
            ports_list.append({
                'name': name,
                'lat': info['lat'],
                'lon': info['lon'],
                'region': info['region'],
                'country': info['country'],
            })

        # Group by region for frontend convenience
        regions = {}
        for p in ports_list:
            regions.setdefault(p['region'], []).append(p)

        return jsonify({
            'success': True,
            'count': len(ports_list),
            'ports': ports_list,
            'by_region': regions,
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Ports listing error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error.'}), 500
