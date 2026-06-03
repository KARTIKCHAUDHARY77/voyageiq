"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta
import random

from ..models import Vessel, Voyage, NoonReport, VesselPosition
from ..extensions import db

vessels_bp = Blueprint('vessels', __name__)


# ---------------------------------------------------------------------------
# Helper: Health-score calculation
# ---------------------------------------------------------------------------

def _compute_health_score(vessel: Vessel, reports: list) -> dict:
    """
    Calculate a 0-100 AI health score from the latest noon reports.
    Each of the four dimensions contributes up to 25 points.
    """
    if not reports:
        # Demo / seed values when no real reports exist
        fuel_score = round(random.uniform(14, 22), 1)
        speed_score = round(random.uniform(16, 24), 1)
        weather_score = round(random.uniform(17, 23), 1)
        ops_score = round(random.uniform(15, 22), 1)
    else:
        # --- Fuel efficiency (actual nm per MT vs benchmark) ---
        nm_mt_values = [
            r.distance_nm / r.me_consumption
            for r in reports
            if r.me_consumption and r.me_consumption > 0 and r.distance_nm
        ]
        benchmark_nm_mt = getattr(vessel, 'benchmark_nm_mt', 28.0) or 28.0
        if nm_mt_values:
            avg_nm_mt = sum(nm_mt_values) / len(nm_mt_values)
            ratio = min(avg_nm_mt / benchmark_nm_mt, 1.0)
            fuel_score = round(ratio * 25, 1)
        else:
            fuel_score = 18.0

        # --- Speed compliance (actual vs charter party) ---
        speed_variances = [
            abs(r.actual_speed - r.charter_party_speed)
            for r in reports
            if r.actual_speed and r.charter_party_speed
        ]
        if speed_variances:
            avg_variance = sum(speed_variances) / len(speed_variances)
            # Penalty: >1.5 kn variance → 0 pts; 0 kn → 25 pts
            speed_score = round(max(0, 25 * (1 - avg_variance / 1.5)), 1)
        else:
            speed_score = 20.0

        # --- Weather handling (avg weather factor closer to 1.0 is best) ---
        wf_values = [
            r.weather_factor for r in reports
            if r.weather_factor is not None
        ]
        if wf_values:
            avg_wf = sum(wf_values) / len(wf_values)
            # weather_factor > 1 means adverse; ideal = 1.0
            weather_score = round(min(25, 25 / avg_wf), 1)
        else:
            weather_score = 20.0

        # --- Operational score (no missed reports, valid data completeness) ---
        complete = sum(
            1 for r in reports
            if r.distance_nm and r.me_consumption and r.actual_speed
        )
        ops_score = round((complete / len(reports)) * 25, 1) if reports else 18.0

    total = round(fuel_score + speed_score + weather_score + ops_score, 1)

    if total >= 85:
        grade = 'Excellent'
    elif total >= 70:
        grade = 'Good'
    elif total >= 50:
        grade = 'Average'
    else:
        grade = 'Poor'

    # AI-generated recommendations based on weakest dimensions
    scores = {
        'fuel_efficiency': fuel_score,
        'speed_compliance': speed_score,
        'weather_handling': weather_score,
        'operational': ops_score,
    }
    sorted_dims = sorted(scores.items(), key=lambda x: x[1])

    recommendations_map = {
        'fuel_efficiency': (
            'Optimise main-engine RPM and trim settings to improve fuel consumption '
            'efficiency. Consider slow-steaming on legs with schedule slack.'
        ),
        'speed_compliance': (
            'Review charter-party speed compliance – persistent under/over-speed events '
            'may expose the vessel to performance claims. Adjust passage plan accordingly.'
        ),
        'weather_handling': (
            'Utilise weather-routing services proactively. Deviating earlier to avoid '
            'heavy weather improves safety and reduces fuel burn.'
        ),
        'operational': (
            'Improve noon-report data quality and completeness. Accurate data is essential '
            'for performance benchmarking and claims defence.'
        ),
    }

    recommendations = [recommendations_map[dim] for dim, _ in sorted_dims[:3]]

    return {
        'total_score': total,
        'grade': grade,
        'dimensions': {
            'fuel_efficiency': fuel_score,
            'speed_compliance': speed_score,
            'weather_handling': weather_score,
            'operational': ops_score,
        },
        'recommendations': recommendations,
        'report_count': len(reports),
        'calculated_at': datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Helper: Performance metrics
# ---------------------------------------------------------------------------

def _compute_performance(vessel: Vessel, reports: list) -> dict:
    """Compute aggregate performance KPIs from noon reports."""
    if not reports:
        # Realistic demo data
        return {
            'avg_speed': round(random.uniform(11.5, 13.8), 2),
            'speed_variance': round(random.uniform(-0.3, 0.4), 2),
            'avg_consumption': round(random.uniform(28.0, 35.0), 2),
            'consumption_variance_pct': round(random.uniform(-2.0, 6.0), 2),
            'fuel_efficiency_nm_mt': round(random.uniform(26.0, 31.0), 2),
            'compliance_pct': round(random.uniform(78.0, 96.0), 1),
            'total_distance_nm': round(random.uniform(5000, 18000), 0),
            'total_fuel_mt': round(random.uniform(400, 1200), 1),
            'report_count': 0,
            'data_source': 'demo',
        }

    speeds = [r.actual_speed for r in reports if r.actual_speed]
    cp_speeds = [r.charter_party_speed for r in reports if r.charter_party_speed]
    consumptions = [r.me_consumption for r in reports if r.me_consumption]
    cp_consumptions = [r.charter_party_consumption for r in reports if r.charter_party_consumption]
    distances = [r.distance_nm for r in reports if r.distance_nm]

    avg_speed = round(sum(speeds) / len(speeds), 2) if speeds else 0
    avg_cp_speed = round(sum(cp_speeds) / len(cp_speeds), 2) if cp_speeds else avg_speed
    speed_variance = round(avg_speed - avg_cp_speed, 2)

    avg_consumption = round(sum(consumptions) / len(consumptions), 2) if consumptions else 0
    avg_cp_consumption = round(sum(cp_consumptions) / len(cp_consumptions), 2) if cp_consumptions else avg_consumption
    consumption_variance_pct = (
        round(((avg_consumption - avg_cp_consumption) / avg_cp_consumption) * 100, 2)
        if avg_cp_consumption else 0
    )

    total_distance = sum(distances)
    total_fuel = sum(consumptions)
    fuel_efficiency = round(total_distance / total_fuel, 2) if total_fuel else 0

    # Compliance: reports within ±0.5 kn of CP speed
    compliant = sum(
        1 for r in reports
        if r.actual_speed and r.charter_party_speed
        and abs(r.actual_speed - r.charter_party_speed) <= 0.5
    )
    total_with_cp = sum(1 for r in reports if r.actual_speed and r.charter_party_speed)
    compliance_pct = round((compliant / total_with_cp) * 100, 1) if total_with_cp else 0

    return {
        'avg_speed': avg_speed,
        'speed_variance': speed_variance,
        'avg_consumption': avg_consumption,
        'consumption_variance_pct': consumption_variance_pct,
        'fuel_efficiency_nm_mt': fuel_efficiency,
        'compliance_pct': compliance_pct,
        'total_distance_nm': round(total_distance, 1),
        'total_fuel_mt': round(total_fuel, 1),
        'report_count': len(reports),
        'data_source': 'live',
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@vessels_bp.route('', methods=['GET'])
@jwt_required()
def list_vessels():
    """List all vessels with high-level stats."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status_filter = request.args.get('status')

        query = Vessel.query
        if status_filter:
            query = query.filter_by(status=status_filter)

        pagination = query.order_by(Vessel.name).paginate(
            page=page, per_page=per_page, error_out=False
        )

        vessels_data = []
        for v in pagination.items:
            vd = v.to_dict()

            # Attach active voyage info
            active_voyage = Voyage.query.filter_by(
                vessel_id=v.id, status='active'
            ).first()
            vd['active_voyage'] = active_voyage.to_dict() if active_voyage else None

            # Quick report count
            report_count = (
                NoonReport.query
                .join(Voyage, NoonReport.voyage_id == Voyage.id)
                .filter(Voyage.vessel_id == v.id)
                .count()
            )
            vd['report_count'] = report_count
            vessels_data.append(vd)

        return jsonify({
            'vessels': vessels_data,
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': per_page,
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve vessels', 'details': str(e)}), 500


@vessels_bp.route('/<int:vessel_id>', methods=['GET'])
@jwt_required()
def get_vessel(vessel_id):
    """Get full vessel details including health score."""
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = vessel.to_dict()

        # Fetch last 30 noon reports
        recent_reports = (
            NoonReport.query
            .join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc())
            .limit(30)
            .all()
        )

        data['health'] = _compute_health_score(vessel, recent_reports)
        data['performance'] = _compute_performance(vessel, recent_reports)

        # Active voyage
        active_voyage = Voyage.query.filter_by(
            vessel_id=vessel_id, status='active'
        ).first()
        data['active_voyage'] = active_voyage.to_dict() if active_voyage else None

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve vessel', 'details': str(e)}), 500


@vessels_bp.route('', methods=['POST'])
@jwt_required()
def create_vessel():
    """Create a new vessel."""
    try:
        data = request.get_json()
        if not data or not data.get('name') or not data.get('imo_number'):
            return jsonify({'error': 'name and imo_number are required'}), 400

        if Vessel.query.filter_by(imo_number=data['imo_number']).first():
            return jsonify({'error': 'A vessel with this IMO number already exists'}), 409

        vessel = Vessel(
            name=data['name'],
            imo_number=data['imo_number'],
            vessel_type=data.get('vessel_type', 'bulk_carrier'),
            flag=data.get('flag', ''),
            year_built=data.get('year_built'),
            dwt=data.get('dwt'),
            gt=data.get('gt'),
            loa=data.get('loa'),
            beam=data.get('beam'),
            draft_max=data.get('draft_max'),
            main_engine=data.get('main_engine', ''),
            engine_power_kw=data.get('engine_power_kw'),
            speed_design=data.get('speed_design'),
            consumption_design=data.get('consumption_design'),
            status=data.get('status', 'active'),
        )

        db.session.add(vessel)
        db.session.commit()

        return jsonify(vessel.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create vessel', 'details': str(e)}), 500


@vessels_bp.route('/<int:vessel_id>', methods=['PUT'])
@jwt_required()
def update_vessel(vessel_id):
    """Update vessel details."""
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        allowed_fields = [
            'name', 'vessel_type', 'flag', 'year_built', 'dwt', 'gt',
            'loa', 'beam', 'draft_max', 'main_engine', 'engine_power_kw',
            'speed_design', 'consumption_design', 'status',
        ]
        for field in allowed_fields:
            if field in data:
                setattr(vessel, field, data[field])

        vessel.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(vessel.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update vessel', 'details': str(e)}), 500


@vessels_bp.route('/<int:vessel_id>/positions', methods=['GET'])
@jwt_required()
def get_vessel_positions(vessel_id):
    """Return historical track positions for a vessel."""
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        limit = request.args.get('limit', 100, type=int)
        since_hours = request.args.get('since_hours', 72, type=int)
        since_dt = datetime.utcnow() - timedelta(hours=since_hours)

        positions = (
            VesselPosition.query
            .filter(
                VesselPosition.vessel_id == vessel_id,
                VesselPosition.timestamp >= since_dt,
            )
            .order_by(VesselPosition.timestamp.desc())
            .limit(limit)
            .all()
        )

        return jsonify({
            'vessel_id': vessel_id,
            'vessel_name': vessel.name,
            'positions': [p.to_dict() for p in positions],
            'count': len(positions),
            'since_hours': since_hours,
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve positions', 'details': str(e)}), 500


@vessels_bp.route('/<int:vessel_id>/performance', methods=['GET'])
@jwt_required()
def get_vessel_performance(vessel_id):
    """Get aggregated performance metrics for a vessel."""
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        days = request.args.get('days', 30, type=int)
        since_dt = datetime.utcnow() - timedelta(days=days)

        reports = (
            NoonReport.query
            .join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(
                Voyage.vessel_id == vessel_id,
                NoonReport.report_date >= since_dt,
            )
            .order_by(NoonReport.report_date.asc())
            .all()
        )

        metrics = _compute_performance(vessel, reports)
        metrics['period_days'] = days
        metrics['vessel_id'] = vessel_id
        metrics['vessel_name'] = vessel.name

        # Daily breakdown
        daily = {}
        for r in reports:
            day = r.report_date.strftime('%Y-%m-%d') if r.report_date else 'unknown'
            if day not in daily:
                daily[day] = {'date': day, 'speed': [], 'consumption': [], 'distance': []}
            if r.actual_speed:
                daily[day]['speed'].append(r.actual_speed)
            if r.me_consumption:
                daily[day]['consumption'].append(r.me_consumption)
            if r.distance_nm:
                daily[day]['distance'].append(r.distance_nm)

        daily_summary = []
        for day, vals in sorted(daily.items()):
            daily_summary.append({
                'date': day,
                'avg_speed': round(sum(vals['speed']) / len(vals['speed']), 2) if vals['speed'] else None,
                'total_consumption': round(sum(vals['consumption']), 2),
                'total_distance': round(sum(vals['distance']), 1),
            })

        metrics['daily_breakdown'] = daily_summary
        return jsonify(metrics)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve performance', 'details': str(e)}), 500


@vessels_bp.route('/<int:vessel_id>/health', methods=['GET'])
@jwt_required()
def get_vessel_health(vessel_id):
    """Return AI health score with grade and recommendations."""
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        reports = (
            NoonReport.query
            .join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc())
            .limit(30)
            .all()
        )

        health = _compute_health_score(vessel, reports)
        health['vessel_id'] = vessel_id
        health['vessel_name'] = vessel.name

        return jsonify(health)
    except Exception as e:
        return jsonify({'error': 'Failed to compute health score', 'details': str(e)}), 500
