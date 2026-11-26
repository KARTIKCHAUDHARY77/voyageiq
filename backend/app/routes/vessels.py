"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
import uuid
from datetime import datetime, timedelta
from flask import Blueprint, g, request, jsonify
from sqlalchemy import func

from ..models import Vessel, Voyage, NoonReport, VesselPosition
from ..extensions import db
from ..tenancy import audit, current_org_id, get_scoped, scoped_query, tenant_required

vessels_bp = Blueprint('vessels', __name__)

NUMERIC_VESSEL_FIELDS = {'built_year', 'gross_tonnage', 'deadweight_tonnage', 'loa', 'beam',
                         'draft_design', 'main_engine_power', 'design_speed',
                         'warranted_speed', 'warranted_consumption'}

# ---------------------------------------------------------------------------
# Health score helper
# ---------------------------------------------------------------------------
def _compute_health_score(vessel, reports):
    if not reports:
        return {
            'total': None, 'grade': 'No data',
            'fuel_efficiency_score': None, 'speed_compliance_score': None,
            'weather_handling_score': None, 'operational_score': None,
            'recommendations': ['Add noon reports to compute a health score.'],
            'total_score': None, 'grade_color': 'slate', 'breakdown': {},
        }
    warranted_cons = float(vessel.warranted_consumption) if vessel.warranted_consumption else None
    warranted_speed = float(vessel.warranted_speed) if vessel.warranted_speed else None

    # Each component is scored out of 25, or left None when the inputs are missing.
    nm_mt = [float(r.distance_noon_to_noon) / float(r.me_lsfo) for r in reports
             if r.me_lsfo and r.me_lsfo > 0 and r.distance_noon_to_noon]
    fuel_score = None
    if nm_mt and warranted_cons and warranted_speed:
        # Warranted efficiency in nm per MT: (speed x 24h) / daily consumption.
        expected_nm_mt = warranted_speed * 24 / warranted_cons
        fuel_score = round(min(25, (sum(nm_mt) / len(nm_mt) / expected_nm_mt) * 25), 1)

    sv = [abs(float(r.speed_over_ground) - warranted_speed) for r in reports
          if r.speed_over_ground and warranted_speed]
    speed_score = round(max(0, 25 * (1 - (sum(sv) / len(sv) / 2.0))), 1) if sv else None

    wf = [r.wind_force_bft for r in reports if r.wind_force_bft is not None]
    weather_score = round(max(0, 25 * (1 - (sum(wf) / len(wf) / 12.0))), 1) if wf else None

    complete = sum(1 for r in reports if r.distance_noon_to_noon and r.speed_over_ground)
    ops_score = round((complete / len(reports)) * 25, 1)

    parts = [x for x in (fuel_score, speed_score, weather_score, ops_score) if x is not None]
    total = round(sum(parts) / (25 * len(parts)) * 100, 1)
    grade = 'Excellent' if total >= 85 else 'Good' if total >= 70 else 'Average' if total >= 50 else 'Poor'

    recs = []
    if fuel_score is not None and fuel_score < 18:
        recs.append('Fuel efficiency is below the warranted benchmark. Review ME RPM and trim settings.')
    if speed_score is not None and speed_score < 18:
        recs.append('Speed deviates from the warranted figure. Persistent deviation may trigger performance claims.')
    if weather_score is not None and weather_score < 18:
        recs.append('Reports show heavy-weather exposure. Weather routing could reduce fuel and risk.')
    if ops_score < 18:
        recs.append('Many noon reports are missing distance or speed. Complete data is needed for benchmarking and claims defence.')
    if not recs:
        recs.append('No issues flagged by the available data.')

    return {
        'total': total, 'grade': grade,
        'fuel_efficiency_score': fuel_score,
        'speed_compliance_score': speed_score,
        'weather_handling_score': weather_score,
        'operational_score': ops_score,
        'components_scored': len(parts),
        'recommendations': recs[:3],
        'total_score': total,
        'grade_color': 'green' if total >= 85 else 'teal' if total >= 70 else 'amber' if total >= 50 else 'red',
        'breakdown': {
            'fuel_efficiency': fuel_score, 'speed_compliance': speed_score,
            'weather_handling': weather_score, 'operational': ops_score,
        },
    }

def _compute_performance(vessel, reports):
    if not reports:
        return {
            'avg_speed': None, 'speed_variance': None, 'avg_consumption': None,
            'consumption_variance': None, 'fuel_efficiency': None,
            'compliance_pct': None, 'report_count': 0,
        }
    speeds = [r.speed_over_ground for r in reports if r.speed_over_ground]
    cons   = [r.me_lsfo for r in reports if r.me_lsfo]
    ws     = float(vessel.warranted_speed) if vessel.warranted_speed else None
    wc     = float(vessel.warranted_consumption) if vessel.warranted_consumption else None
    speeds = [float(x) for x in speeds]
    cons   = [float(x) for x in cons]
    avg_s  = sum(speeds) / len(speeds) if speeds else None
    avg_c  = sum(cons) / len(cons) if cons else None
    compliant = sum(1 for s in speeds if ws is not None and abs(s - ws) <= 0.5)
    return {
        'avg_speed': round(avg_s, 2) if avg_s is not None else None,
        'speed_variance': round(avg_s - ws, 2) if avg_s is not None and ws is not None else None,
        'avg_consumption': round(avg_c, 1) if avg_c is not None else None,
        'consumption_variance': round(avg_c - wc, 2) if avg_c is not None and wc is not None else None,
        'fuel_efficiency': round(24 * avg_s / avg_c, 3) if avg_s is not None and avg_c else None,
        'compliance_pct': round((compliant / len(speeds)) * 100, 1) if speeds and ws is not None else None,
        'report_count': len(reports),
    }

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@vessels_bp.route('', methods=['GET'])
@tenant_required('read')
def list_vessels():
    try:
        page     = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status   = request.args.get('status')
        q        = request.args.get('q', '').strip()

        query = scoped_query(Vessel)
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
            last_voyage = scoped_query(Voyage).filter_by(vessel_id=v.id).order_by(Voyage.created_at.desc()).first()
            vd['last_voyage'] = last_voyage.to_dict() if last_voyage else None
            # Report count
            nr_count = scoped_query(NoonReport).join(Voyage, NoonReport.voyage_id == Voyage.id).filter(Voyage.vessel_id == v.id).count()
            vd['report_count'] = nr_count
            # Health score from the 30 most recent noon reports (None when there are none)
            recent = (scoped_query(NoonReport).filter(NoonReport.vessel_id == v.id)
                      .order_by(NoonReport.report_date.desc()).limit(30).all())
            hs = _compute_health_score(v, recent)
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
        return jsonify({'error': 'Failed to retrieve vessels'}), 500


@vessels_bp.route('/<vessel_id>', methods=['GET'])
@tenant_required('read')
def get_vessel(vessel_id):
    try:
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = vessel.to_dict()

        recent_reports = (
            scoped_query(NoonReport)
            .join(Voyage, NoonReport.voyage_id == Voyage.id)
            .filter(Voyage.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc())
            .limit(30).all()
        )
        data['health']      = _compute_health_score(vessel, recent_reports)
        data['performance'] = _compute_performance(vessel, recent_reports)

        active_voyage = scoped_query(Voyage).filter_by(vessel_id=vessel_id, status='in_progress').first() or \
                        scoped_query(Voyage).filter_by(vessel_id=vessel_id).order_by(Voyage.created_at.desc()).first()
        data['active_voyage'] = active_voyage.to_dict() if active_voyage else None

        # Voyages list
        all_voyages = scoped_query(Voyage).filter_by(vessel_id=vessel_id).order_by(Voyage.created_at.desc()).limit(10).all()
        data['voyages'] = [v.to_dict() for v in all_voyages]

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve vessel'}), 500


@vessels_bp.route('', methods=['POST'])
@tenant_required('fleet:write')
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

        if scoped_query(Vessel).filter_by(imo_number=imo).first():
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
            owner_id=g.tenant.user_id,
            organization_id=current_org_id(),
        )

        db.session.add(vessel)
        db.session.flush()
        audit('vessel.created', 'vessel', vessel.id, name=vessel.name, imo=imo)
        db.session.commit()
        return jsonify(vessel.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create vessel'}), 500


@vessels_bp.route('/<vessel_id>', methods=['PUT'])
@tenant_required('fleet:write')
def update_vessel(vessel_id):
    try:
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        data = request.get_json() or {}
        for field in ['name','vessel_type','flag','built_year','gross_tonnage','deadweight_tonnage',
                      'loa','beam','draft_design','main_engine_type','main_engine_power',
                      'design_speed','warranted_speed','warranted_consumption','classification_society','status']:
            if field in data:
                value = data[field]
                if field in NUMERIC_VESSEL_FIELDS and value not in (None, ''):
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        return jsonify({'error': f'{field} must be a number'}), 400
                elif field not in NUMERIC_VESSEL_FIELDS and value is not None and not isinstance(value, (str, int)):
                    return jsonify({'error': f'{field} is invalid'}), 400
                setattr(vessel, field, value if value != '' else None)

        vessel.updated_at = datetime.utcnow()
        audit('vessel.updated', 'vessel', vessel.id, fields=sorted(data.keys()))
        db.session.commit()
        return jsonify(vessel.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update vessel'}), 500


@vessels_bp.route('/<vessel_id>/positions', methods=['GET'])
@tenant_required('read')
def get_vessel_positions(vessel_id):
    try:
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        limit = request.args.get('limit', 100, type=int)
        since_hours = request.args.get('since_hours', 72, type=int)
        since_dt = datetime.utcnow() - timedelta(hours=since_hours)
        positions = (
            scoped_query(VesselPosition)
            .filter(VesselPosition.vessel_id == vessel_id, VesselPosition.timestamp >= since_dt)
            .order_by(VesselPosition.timestamp.desc()).limit(limit).all()
        )
        # If no positions, generate track from latest noon reports
        if not positions:
            nrs = (scoped_query(NoonReport).join(Voyage, NoonReport.voyage_id == Voyage.id)
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
        return jsonify({'error': 'Request failed'}), 500


@vessels_bp.route('/<vessel_id>/performance', methods=['GET'])
@tenant_required('read')
def get_vessel_performance(vessel_id):
    try:
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        days = request.args.get('days', 30, type=int)
        # Window ends at the vessel's latest report, not at "now".
        latest = db.session.query(db.func.max(NoonReport.report_date)).filter(
            NoonReport.organization_id == current_org_id(), NoonReport.vessel_id == vessel_id).scalar()
        reports = []
        if latest is not None:
            if not isinstance(latest, datetime):
                latest = datetime(latest.year, latest.month, latest.day)
            reports = (
                scoped_query(NoonReport)
                .filter(NoonReport.vessel_id == vessel_id,
                        NoonReport.report_date >= latest - timedelta(days=days))
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
        return jsonify({'error': 'Request failed'}), 500


@vessels_bp.route('/<vessel_id>/health', methods=['GET'])
@tenant_required('read')
def get_vessel_health(vessel_id):
    try:
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404
        reports = (
            scoped_query(NoonReport).filter(NoonReport.vessel_id == vessel_id)
            .order_by(NoonReport.report_date.desc()).limit(30).all()
        )
        health = _compute_health_score(vessel, reports)
        health['vessel_id']   = vessel_id
        health['vessel_name'] = vessel.name
        return jsonify(health)
    except Exception as e:
        return jsonify({'error': 'Request failed'}), 500
