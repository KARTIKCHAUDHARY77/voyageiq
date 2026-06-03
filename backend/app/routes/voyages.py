"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import Vessel, Voyage, NoonReport, Claim
from ..extensions import db

voyages_bp = Blueprint('voyages', __name__)


def _safe_float(v):
    try: return float(v) if v is not None else None
    except: return None

def _safe_int(v):
    try: return int(v) if v is not None else None
    except: return None


# ---------------------------------------------------------------------------
# List voyages
# ---------------------------------------------------------------------------
@voyages_bp.route('', methods=['GET'])
@jwt_required()
def list_voyages():
    try:
        page     = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status   = request.args.get('status')
        vessel_id = request.args.get('vessel_id')

        query = Voyage.query.join(Vessel, Voyage.vessel_id == Vessel.id, isouter=True)
        if status:
            query = query.filter(Voyage.status == status)
        if vessel_id:
            query = query.filter(Voyage.vessel_id == vessel_id)

        pagination = query.order_by(Voyage.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

        voyages_data = []
        for v in pagination.items:
            vd = v.to_dict()
            vd['vessel_name'] = v.vessel.name if v.vessel else None
            vd['vessel_type'] = v.vessel.vessel_type if v.vessel else None
            # Report count
            vd['report_count'] = NoonReport.query.filter_by(voyage_id=v.id).count()
            voyages_data.append(vd)

        return jsonify({'voyages': voyages_data, 'total': pagination.total,
                        'page': pagination.page, 'pages': pagination.pages})
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve voyages', 'details': str(e)}), 500


# ---------------------------------------------------------------------------
# Get single voyage
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>', methods=['GET'])
@jwt_required()
def get_voyage(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404
        data = voyage.to_dict()
        data['vessel_name'] = voyage.vessel.name if voyage.vessel else None
        data['vessel_type'] = voyage.vessel.vessel_type if voyage.vessel else None
        data['vessel_imo']  = voyage.vessel.imo_number if voyage.vessel else None
        data['report_count'] = NoonReport.query.filter_by(voyage_id=voyage_id).count()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Create voyage
# ---------------------------------------------------------------------------
@voyages_bp.route('', methods=['POST'])
@jwt_required()
def create_voyage():
    try:
        data = request.get_json() or {}
        for req_field in ['vessel_id', 'voyage_number', 'departure_port', 'arrival_port']:
            if not data.get(req_field):
                return jsonify({'error': f'{req_field} is required'}), 400

        vessel = Vessel.query.get(data['vessel_id'])
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        if Voyage.query.filter_by(voyage_number=data['voyage_number']).first():
            return jsonify({'error': f"Voyage number '{data['voyage_number']}' already exists"}), 409

        def parse_dt(val):
            if not val: return None
            try: return datetime.fromisoformat(str(val).replace('Z',''))
            except: return None

        voyage = Voyage(
            id=str(uuid.uuid4()),
            vessel_id=data['vessel_id'],
            voyage_number=data['voyage_number'].strip(),
            status=data.get('status', 'planned'),
            departure_port=data['departure_port'],
            arrival_port=data['arrival_port'],
            etd=parse_dt(data.get('etd')),
            eta=parse_dt(data.get('eta')),
            cargo_type=data.get('cargo_type'),
            cargo_quantity=_safe_float(data.get('cargo_quantity')),
            cargo_unit=data.get('cargo_unit', 'MT'),
            charterer=data.get('charterer'),
            charter_party_speed=_safe_float(data.get('charter_party_speed')),
            charter_party_consumption=_safe_float(data.get('charter_party_consumption')),
        )

        db.session.add(voyage)
        db.session.commit()
        vd = voyage.to_dict()
        vd['vessel_name'] = vessel.name
        return jsonify(vd), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create voyage', 'details': str(e)}), 500


# ---------------------------------------------------------------------------
# Update voyage
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>', methods=['PUT'])
@jwt_required()
def update_voyage(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404
        data = request.get_json() or {}
        for field in ['status','departure_port','arrival_port','cargo_type','cargo_quantity',
                      'charterer','charter_party_speed','charter_party_consumption']:
            if field in data:
                setattr(voyage, field, data[field])
        voyage.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(voyage.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Noon reports list
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>/noon-reports', methods=['GET'])
@jwt_required()
def list_noon_reports(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404
        page     = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        pagination = (NoonReport.query.filter_by(voyage_id=voyage_id)
                      .order_by(NoonReport.report_date.desc())
                      .paginate(page=page, per_page=per_page, error_out=False))
        return jsonify({'reports': [r.to_dict() for r in pagination.items],
                        'total': pagination.total})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Add noon report — maps ALL field names the frontend sends to actual model columns
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>/noon-reports', methods=['POST'])
@jwt_required()
def add_noon_report(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        data = request.get_json() or {}

        def parse_date(v):
            if not v: return None
            try: return datetime.strptime(str(v)[:10], '%Y-%m-%d').date()
            except: return None

        def parse_time(v):
            if not v: return None
            try: return datetime.strptime(str(v)[:8], '%H:%M:%S').time()
            except: return None

        report = NoonReport(
            id=str(uuid.uuid4()),
            voyage_id=voyage_id,
            vessel_id=voyage.vessel_id,   # required NOT NULL
            # Date/time
            report_date=parse_date(data.get('report_date')),
            report_time=parse_time(data.get('report_time')) or datetime.utcnow().time(),
            report_type=data.get('report_type', 'noon'),
            # Position
            latitude=_safe_float(data.get('latitude')),
            longitude=_safe_float(data.get('longitude')),
            # Navigation
            speed_over_ground=_safe_float(data.get('speed_over_ground')),
            speed_through_water=_safe_float(data.get('speed_through_water')),
            distance_noon_to_noon=_safe_float(data.get('distance_noon_to_noon')),
            distance_to_go=_safe_float(data.get('distance_to_go')),
            rpm=_safe_float(data.get('rpm')),
            course=_safe_float(data.get('course')),
            # Weather
            wind_force_bft=_safe_int(data.get('wind_force_bft')),
            wind_direction=data.get('wind_direction', ''),
            wind_speed_knots=_safe_float(data.get('wind_speed_knots')),
            wave_height=_safe_float(data.get('wave_height')),
            swell_height=_safe_float(data.get('swell_height')),
            # Fuel consumption
            me_lsfo=_safe_float(data.get('me_lsfo')),
            me_mgo=_safe_float(data.get('me_mgo')),
            ae_lsfo=_safe_float(data.get('ae_lsfo')),
            ae_mgo=_safe_float(data.get('ae_mgo')),
            boiler_lsfo=_safe_float(data.get('boiler_lsfo')),
            boiler_mgo=_safe_float(data.get('boiler_mgo')),
            # ROB
            rob_lsfo=_safe_float(data.get('rob_lsfo')),
            rob_mgo=_safe_float(data.get('rob_mgo')),
            # Other
            cargo_quantity=_safe_float(data.get('cargo_quantity')),
            draft_fore=_safe_float(data.get('draft_fore')),
            draft_aft=_safe_float(data.get('draft_aft')),
        )

        # Auto-calculate total fuel consumption
        total = sum(filter(None, [
            report.me_lsfo, report.me_mgo,
            report.ae_lsfo, report.ae_mgo,
            report.boiler_lsfo, report.boiler_mgo,
        ]))
        report.total_fuel_consumption = round(total, 3) if total else None

        db.session.add(report)
        db.session.commit()

        # Update voyage totals
        _update_voyage_stats(voyage)

        return jsonify(report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add noon report', 'details': str(e)}), 500


def _update_voyage_stats(voyage):
    """Recalculate voyage aggregate stats from all noon reports."""
    try:
        reports = NoonReport.query.filter_by(voyage_id=voyage.id).all()
        if not reports: return
        distances = [r.distance_noon_to_noon for r in reports if r.distance_noon_to_noon]
        speeds    = [r.speed_over_ground for r in reports if r.speed_over_ground]
        fuels     = [r.total_fuel_consumption for r in reports if r.total_fuel_consumption]
        voyage.total_distance_nm  = round(sum(distances), 1) if distances else None
        voyage.avg_speed          = round(sum(speeds)/len(speeds), 2) if speeds else None
        voyage.total_fuel_consumed = round(sum(fuels), 1) if fuels else None
        db.session.commit()
    except Exception:
        db.session.rollback()


# ---------------------------------------------------------------------------
# Voyage performance
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>/performance', methods=['GET'])
@jwt_required()
def get_voyage_performance(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        reports = (NoonReport.query.filter_by(voyage_id=voyage_id)
                   .order_by(NoonReport.report_date.asc()).all())

        if not reports:
            ws = float(voyage.charter_party_speed or 14.0)
            wc = float(voyage.charter_party_consumption or 28.5)
            return jsonify({
                'voyage_id': voyage_id, 'voyage_number': voyage.voyage_number,
                'vessel_name': voyage.vessel.name if voyage.vessel else None,
                'summary': {'message': 'No noon reports yet. Add reports to see performance.'},
                'daily': [], 'weekly': [],
            })

        daily_map = defaultdict(lambda: {'speeds':[], 'fuels':[], 'distances':[], 'bft':[]})
        for r in reports:
            if not r.report_date: continue
            day = r.report_date.strftime('%Y-%m-%d')
            if r.speed_over_ground: daily_map[day]['speeds'].append(float(r.speed_over_ground))
            if r.total_fuel_consumption: daily_map[day]['fuels'].append(float(r.total_fuel_consumption))
            if r.distance_noon_to_noon: daily_map[day]['distances'].append(float(r.distance_noon_to_noon))
            if r.wind_force_bft: daily_map[day]['bft'].append(r.wind_force_bft)

        daily = []
        for day in sorted(daily_map.keys()):
            d = daily_map[day]
            td = sum(d['distances']); tf = sum(d['fuels'])
            daily.append({'date': day,
                'avg_speed': round(sum(d['speeds'])/len(d['speeds']), 2) if d['speeds'] else None,
                'total_fuel_mt': round(tf, 2),
                'total_distance_nm': round(td, 1),
                'fuel_efficiency': round(td/tf, 2) if tf else None,
                'avg_beaufort': round(sum(d['bft'])/len(d['bft']), 1) if d['bft'] else None,
            })

        all_speeds = [float(r.speed_over_ground) for r in reports if r.speed_over_ground]
        all_fuels  = [float(r.total_fuel_consumption) for r in reports if r.total_fuel_consumption]
        all_dists  = [float(r.distance_noon_to_noon) for r in reports if r.distance_noon_to_noon]
        td = sum(all_dists); tf = sum(all_fuels)
        ws = float(voyage.charter_party_speed or 14.0)
        wc = float(voyage.charter_party_consumption or 28.5)
        avg_s = round(sum(all_speeds)/len(all_speeds), 2) if all_speeds else ws
        avg_f = round(sum(all_fuels)/len(all_fuels), 2) if all_fuels else wc

        summary = {
            'total_distance_nm': round(td, 1), 'total_fuel_mt': round(tf, 1),
            'avg_speed': avg_s, 'cp_speed': ws, 'speed_variance': round(avg_s - ws, 2),
            'avg_daily_fuel': avg_f, 'cp_consumption': wc,
            'consumption_variance_pct': round((avg_f - wc) / wc * 100, 1) if wc else 0,
            'fuel_efficiency_nm_mt': round(td/tf, 2) if tf else 0,
            'report_count': len(reports),
        }

        return jsonify({'voyage_id': voyage_id, 'voyage_number': voyage.voyage_number,
                        'vessel_name': voyage.vessel.name if voyage.vessel else None,
                        'summary': summary, 'daily': daily})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Voyage claims
# ---------------------------------------------------------------------------
@voyages_bp.route('/<voyage_id>/claims', methods=['GET'])
@jwt_required()
def get_voyage_claims(voyage_id):
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404
        claims = Claim.query.filter_by(voyage_id=voyage_id).order_by(Claim.created_at.desc()).all()
        return jsonify({'voyage_id': voyage_id, 'voyage_number': voyage.voyage_number,
                        'vessel_name': voyage.vessel.name if voyage.vessel else None,
                        'claims': [c.to_dict() for c in claims],
                        'total_claims': len(claims),
                        'total_amount_usd': round(sum((c.estimated_impact_usd or 0) for c in claims), 2)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
