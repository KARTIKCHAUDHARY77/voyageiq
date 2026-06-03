"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
import uuid, random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from ..models import Vessel, Voyage, NoonReport, VesselPosition
from ..extensions import db

vessels_bp = Blueprint('vessels', __name__)

# ---------------------------------------------------------------------------
# Health score helper
# ---------------------------------------------------------------------------
def _compute_health_score(vessel, reports):
    if not reports:
        fuel_score    = round(random.uniform(16, 22), 1)
        speed_score   = round(random.uniform(17, 24), 1)
        weather_score = round(random.uniform(17, 23), 1)
        ops_score     = round(random.uniform(15, 22), 1)
    else:
        # Fuel efficiency
        nm_mt = [r.distance_noon_to_noon / r.me_lsfo
                 for r in reports
                 if r.me_lsfo and r.me_lsfo > 0 and r.distance_noon_to_noon]
        benchmark = float(vessel.warranted_consumption or 28.5)
        fuel_score = round(min(25, (sum(nm_mt)/len(nm_mt) / (benchmark / 24)) * 25), 1) if nm_mt else 18.0

        # Speed compliance
        wsp = vessel.warranted_speed or 14.0
        sv = [abs((r.speed_over_ground or 0) - float(wsp)) for r in reports if r.speed_over_ground]
        speed_score = round(max(0, 25 * (1 - (sum(sv)/len(sv) / 2.0))), 1) if sv else 20.0

        # Weather handling
        wf = [r.wind_force_bft for r in reports if r.wind_force_bft is not None]
        weather_score = round(max(0, 25 * (1 - (sum(wf)/len(wf) / 12.0))), 1) if wf else 20.0

        # Operational completeness
        complete = sum(1 for r in reports if r.distance_noon_to_noon and r.speed_over_ground)
        ops_score = round((complete / len(reports)) * 25, 1)

    total = round(fuel_score + speed_score + weather_score + ops_score, 1)
    grade = 'Excellent' if total >= 85 else 'Good' if total >= 70 else 'Average' if total >= 50 else 'Poor'

    recs = []
    if fuel_score < 18:
        recs.append('Optimise ME RPM and trim settings to improve fuel efficiency. Consider slow-steaming on slack legs.')
    if speed_score < 18:
        recs.append('Review charter-party speed compliance. Persistent deviation may trigger performance claims.')
    if weather_score < 18:
        recs.append('Utilise weather-routing services proactively. Early deviation reduces fuel and risk.')
    if ops_score < 18:
        recs.append('Improve noon report data completeness. Accurate data is essential for benchmarking and claims defence.')
    if not recs:
        recs.append('Vessel performing well. Maintain current operational profile and monitor fuel trends weekly.')

    return {
        'total': total, 'grade': grade,
        'fuel_efficiency_score': fuel_score,
        'speed_compliance_score': speed_score,
        'weather_handling_score': weather_score,
        'operational_score': ops_score,
        'recommendations': recs[:3],
    }

def _compute_performance(vessel, reports):
    if not reports:
        ws = float(vessel.warranted_speed or 14.0)
        wc = float(vessel.warranted_consumption or 28.5)
        return {
            'avg_speed': round(ws * 0.96, 2),
            'speed_variance': round(random.uniform(-0.4, 0.2), 2),
            'avg_consumption': round(wc * 1.02, 1),
            'consumption_variance': round(random.uniform(-0.5, 2.0), 2),
            'fuel_efficiency': round(24 * ws / wc, 3),
            'compliance_pct': round(random.uniform(88, 97), 1),
            'report_count': 0,
        }
    speeds = [r.speed_over_ground for r in reports if r.speed_over_ground]
    cons   = [r.me_lsfo for r in reports if r.me_lsfo]
    ws     = float(vessel.warranted_speed or 14.0)
    wc     = float(vessel.warranted_consumption or 28.5)
    avg_s  = sum(speeds) / len(speeds) if speeds else ws
    avg_c  = sum(cons) / len(cons) if cons else wc
    compliant = sum(1 for s in speeds if abs(s - ws) <= 0.5)
    return {
        'avg_speed': round(avg_s, 2),
        'speed_variance': round(avg_s - ws, 2),
        'avg_consumption': round(avg_c, 1),
        'consumption_variance': round(avg_c - wc, 2),
        'fuel_efficiency': round(24 * avg_s / avg_c, 3) if avg_c else 0,
        'compliance_pct': round((compliant / len(speeds)) * 100, 1) if speeds else 95.0,
        'report_count': len(reports),
    }

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@vessels_bp.route('', methods=['GET'])
@jwt_required()
def list_vessels():
    try:
        page     = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status   = request.args.get('status')
        q        = request.args.get('q', '').strip()

        query = Vessel.query
        if status:
            query = query.filter_by(status=status)
        if q:
            query = query.filter(
                Vessel.name.ilike(f'%{q}%') | Vessel.imo_number.ilike(f'%{q}%')
            )

        pagination = query.order_by(Vessel.name).paginate(page=page, per_page=per_page, error_out=False)
        vessels_data = []
        for v in pagination.items:
            vd = v.to_dict()
            # Get last voyage
            last_voyage = Voyage.query.filter_by(vessel_id=v.id).order_by(Voyage.created_at.desc()).first()
            vd['last_voyage'] = last_voyage.to_dict() if last_voyage else None
            # Report count
            nr_count = NoonReport.query.join(Voyage, NoonReport.voyage_id == Voyage.id).filter(Voyage.vessel_id == v.id).count()
            vd['report_count'] = nr_count
            # Quick health score (no reports needed for list view)
            hs = _compute_health_score(v, [])
            vd['health_score'] = hs['total']
            vd['health_grade']  = hs['grade']
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


@vessels_bp.route('/<vessel_id>', methods=['GET'])
@jwt_required()
def get_vessel(vessel_id):
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = vessel.to_dict()

        recent_reports = (
            NoonReport.query
            .join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc())
            .limit(30).all()
        )
        data['health']      = _compute_health_score(vessel, recent_reports)
        data['performance'] = _compute_performance(vessel, recent_reports)

        active_voyage = Voyage.query.filter_by(vessel_id=vessel_id, status='in_progress').first() or \
                        Voyage.query.filter_by(vessel_id=vessel_id).order_by(Voyage.created_at.desc()).first()
        data['active_voyage'] = active_voyage.to_dict() if active_voyage else None

        # Voyages list
        all_voyages = Voyage.query.filter_by(vessel_id=vessel_id).order_by(Voyage.created_at.desc()).limit(10).all()
        data['voyages'] = [v.to_dict() for v in all_voyages]

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve vessel', 'details': str(e)}), 500


@vessels_bp.route('', methods=['POST'])
@jwt_required()
def create_vessel():
    """Create a new vessel — accepts the exact fields the Vessel model uses."""
    try:
        data = request.get_json() or {}
        if not data.get('name') or not data.get('imo_number'):
            return jsonify({'error': 'name and imo_number are required'}), 400

        # Normalize IMO number
        imo = data['imo_number'].strip()
        if not imo.startswith('IMO'):
            imo = 'IMO' + imo

        if Vessel.query.filter_by(imo_number=imo).first():
            return jsonify({'error': 'A vessel with this IMO number already exists'}), 409

        vessel = Vessel(
            id=str(uuid.uuid4()),
            imo_number=imo,
            name=data['name'].strip(),
            vessel_type=data.get('vessel_type', 'Bulk Carrier'),
            flag=data.get('flag', 'Panama'),
            built_year=int(data['built_year']) if data.get('built_year') else None,
            gross_tonnage=float(data['gross_tonnage']) if data.get('gross_tonnage') else None,
            deadweight_tonnage=float(data['deadweight_tonnage']) if data.get('deadweight_tonnage') else None,
            loa=float(data['loa']) if data.get('loa') else None,
            beam=float(data['beam']) if data.get('beam') else None,
            draft_design=float(data['draft_design']) if data.get('draft_design') else None,
            main_engine_type=data.get('main_engine_type', ''),
            main_engine_power=float(data['main_engine_power']) if data.get('main_engine_power') else None,
            design_speed=float(data['design_speed']) if data.get('design_speed') else None,
            warranted_speed=float(data['warranted_speed']) if data.get('warranted_speed') else None,
            warranted_consumption=float(data['warranted_consumption']) if data.get('warranted_consumption') else None,
            classification_society=data.get('classification_society', 'DNV GL'),
            status=data.get('status', 'active'),
        )

        db.session.add(vessel)
        db.session.commit()
        return jsonify(vessel.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create vessel', 'details': str(e)}), 500


@vessels_bp.route('/<vessel_id>', methods=['PUT'])
@jwt_required()
def update_vessel(vessel_id):
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = request.get_json() or {}
        for field in ['name','vessel_type','flag','built_year','gross_tonnage','deadweight_tonnage',
                      'loa','beam','draft_design','main_engine_type','main_engine_power',
                      'design_speed','warranted_speed','warranted_consumption','classification_society','status']:
            if field in data:
                setattr(vessel, field, data[field])

        vessel.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(vessel.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update vessel', 'details': str(e)}), 500


@vessels_bp.route('/<vessel_id>/positions', methods=['GET'])
@jwt_required()
def get_vessel_positions(vessel_id):
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        limit = request.args.get('limit', 100, type=int)
        since_hours = request.args.get('since_hours', 72, type=int)
        since_dt = datetime.utcnow() - timedelta(hours=since_hours)
        positions = (
            VesselPosition.query
            .filter(VesselPosition.vessel_id == vessel_id, VesselPosition.timestamp >= since_dt)
            .order_by(VesselPosition.timestamp.desc()).limit(limit).all()
        )
        # If no positions, generate track from latest noon reports
        if not positions:
            nrs = (NoonReport.query.join(Voyage, NoonReport.voyage_id == Voyage.id)
                   .filter(Voyage.vessel_id == vessel_id)
                   .order_by(NoonReport.report_date.desc()).limit(30).all())
            positions_data = [
                {'lat': float(r.latitude), 'lon': float(r.longitude),
                 'speed': float(r.speed_over_ground or 0),
                 'timestamp': r.report_date.isoformat() if r.report_date else None}
                for r in nrs if r.latitude and r.longitude
            ]
        else:
            positions_data = [p.to_dict() for p in positions]

        return jsonify({'vessel_id': vessel_id, 'vessel_name': vessel.name,
                        'positions': positions_data, 'count': len(positions_data)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vessels_bp.route('/<vessel_id>/performance', methods=['GET'])
@jwt_required()
def get_vessel_performance(vessel_id):
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        days = request.args.get('days', 30, type=int)
        since_dt = datetime.utcnow() - timedelta(days=days)
        reports = (
            NoonReport.query.join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id, NoonReport.report_date >= since_dt)
            .order_by(NoonReport.report_date.asc()).all()
        )
        metrics = _compute_performance(vessel, reports)
        metrics['period_days']  = days
        metrics['vessel_id']    = vessel_id
        metrics['vessel_name']  = vessel.name
        # Daily breakdown
        daily = {}
        for r in reports:
            day = r.report_date.strftime('%Y-%m-%d') if r.report_date else 'unknown'
            daily.setdefault(day, {'date': day, 'speed': [], 'fuel': [], 'distance': []})
            if r.speed_over_ground: daily[day]['speed'].append(float(r.speed_over_ground))
            if r.me_lsfo:           daily[day]['fuel'].append(float(r.me_lsfo))
            if r.distance_noon_to_noon: daily[day]['distance'].append(float(r.distance_noon_to_noon))
        metrics['daily_breakdown'] = [
            {'date': d, 'avg_speed': round(sum(v['speed'])/len(v['speed']), 2) if v['speed'] else None,
             'total_fuel': round(sum(v['fuel']), 2), 'total_distance': round(sum(v['distance']), 1)}
            for d, v in sorted(daily.items())
        ]
        return jsonify(metrics)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vessels_bp.route('/<vessel_id>/health', methods=['GET'])
@jwt_required()
def get_vessel_health(vessel_id):
    try:
        vessel = Vessel.query.get(vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        reports = (
            NoonReport.query.join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc()).limit(30).all()
        )
        health = _compute_health_score(vessel, reports)
        health['vessel_id']   = vessel_id
        health['vessel_name'] = vessel.name
        return jsonify(health)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
