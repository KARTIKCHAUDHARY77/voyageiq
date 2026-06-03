"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from collections import defaultdict

from ..models import Voyage, Vessel, NoonReport, Claim
from ..extensions import db

voyages_bp = Blueprint('voyages', __name__)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@voyages_bp.route('', methods=['GET'])
@jwt_required()
def list_voyages():
    """List all voyages with vessel name and basic stats."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status_filter = request.args.get('status')
        vessel_id_filter = request.args.get('vessel_id', type=int)

        query = Voyage.query.join(Vessel, Voyage.vessel_id == Vessel.id)

        if status_filter:
            query = query.filter(Voyage.status == status_filter)
        if vessel_id_filter:
            query = query.filter(Voyage.vessel_id == vessel_id_filter)

        pagination = query.order_by(Voyage.departure_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        voyages_data = []
        for v in pagination.items:
            vd = v.to_dict()
            vd['vessel_name'] = v.vessel.name if v.vessel else None
            vd['vessel_imo'] = v.vessel.imo_number if v.vessel else None

            # Attach report count and open claims
            vd['report_count'] = NoonReport.query.filter_by(voyage_id=v.id).count()
            vd['open_claims'] = Claim.query.filter_by(
                voyage_id=v.id, status='open'
            ).count()
            voyages_data.append(vd)

        return jsonify({
            'voyages': voyages_data,
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': per_page,
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve voyages', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>', methods=['GET'])
@jwt_required()
def get_voyage(voyage_id):
    """Get full voyage details."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        data = voyage.to_dict()
        data['vessel_name'] = voyage.vessel.name if voyage.vessel else None
        data['vessel_imo'] = voyage.vessel.imo_number if voyage.vessel else None
        data['report_count'] = NoonReport.query.filter_by(voyage_id=voyage_id).count()

        claims = Claim.query.filter_by(voyage_id=voyage_id).all()
        data['claims_summary'] = {
            'total': len(claims),
            'open': sum(1 for c in claims if c.status == 'open'),
            'resolved': sum(1 for c in claims if c.status == 'resolved'),
            'total_amount_usd': sum(
                (c.claim_amount_usd or 0) for c in claims
            ),
        }

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve voyage', 'details': str(e)}), 500


@voyages_bp.route('', methods=['POST'])
@jwt_required()
def create_voyage():
    """Create a new voyage."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        required = ['vessel_id', 'voyage_number', 'departure_port', 'arrival_port']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

        vessel = Vessel.query.get(data['vessel_id'])
        if not vessel:
            return jsonify({'error': 'Vessel not found'}), 404

        # Check for duplicate voyage number on this vessel
        existing = Voyage.query.filter_by(
            vessel_id=data['vessel_id'],
            voyage_number=data['voyage_number']
        ).first()
        if existing:
            return jsonify({'error': 'Voyage number already exists for this vessel'}), 409

        def _parse_date(val):
            if not val:
                return None
            for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
                try:
                    return datetime.strptime(val, fmt)
                except ValueError:
                    continue
            return None

        voyage = Voyage(
            vessel_id=data['vessel_id'],
            voyage_number=data['voyage_number'],
            departure_port=data['departure_port'],
            arrival_port=data['arrival_port'],
            departure_date=_parse_date(data.get('departure_date')),
            arrival_date=_parse_date(data.get('arrival_date')),
            charter_party_speed=data.get('charter_party_speed'),
            charter_party_consumption=data.get('charter_party_consumption'),
            cargo_type=data.get('cargo_type', ''),
            cargo_quantity=data.get('cargo_quantity'),
            hire_rate_per_day=data.get('hire_rate_per_day'),
            bunker_price_per_mt=data.get('bunker_price_per_mt'),
            status=data.get('status', 'planned'),
        )

        db.session.add(voyage)
        db.session.commit()

        return jsonify(voyage.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create voyage', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>', methods=['PUT'])
@jwt_required()
def update_voyage(voyage_id):
    """Update voyage details."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        allowed_fields = [
            'voyage_number', 'departure_port', 'arrival_port',
            'departure_date', 'arrival_date', 'charter_party_speed',
            'charter_party_consumption', 'cargo_type', 'cargo_quantity',
            'hire_rate_per_day', 'bunker_price_per_mt', 'status',
        ]
        date_fields = {'departure_date', 'arrival_date'}

        for field in allowed_fields:
            if field in data:
                if field in date_fields and isinstance(data[field], str):
                    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
                        try:
                            setattr(voyage, field, datetime.strptime(data[field], fmt))
                            break
                        except ValueError:
                            continue
                else:
                    setattr(voyage, field, data[field])

        db.session.commit()
        return jsonify(voyage.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update voyage', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>/noon-reports', methods=['GET'])
@jwt_required()
def list_noon_reports(voyage_id):
    """List all noon reports for a voyage."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 30, type=int)

        pagination = (
            NoonReport.query
            .filter_by(voyage_id=voyage_id)
            .order_by(NoonReport.report_date.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return jsonify({
            'voyage_id': voyage_id,
            'reports': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve noon reports', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>/noon-reports', methods=['POST'])
@jwt_required()
def add_noon_report(voyage_id):
    """Add a noon report to a voyage."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        if not data.get('report_date'):
            return jsonify({'error': 'report_date is required'}), 400

        # Parse report date
        report_date = None
        for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
            try:
                report_date = datetime.strptime(data['report_date'], fmt)
                break
            except ValueError:
                continue
        if not report_date:
            return jsonify({'error': 'Invalid report_date format. Use YYYY-MM-DD or ISO format'}), 400

        report = NoonReport(
            voyage_id=voyage_id,
            report_date=report_date,
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            actual_speed=data.get('actual_speed'),
            charter_party_speed=data.get('charter_party_speed') or voyage.charter_party_speed,
            distance_nm=data.get('distance_nm'),
            me_consumption=data.get('me_consumption'),
            ae_consumption=data.get('ae_consumption', 0),
            boiler_consumption=data.get('boiler_consumption', 0),
            total_consumption=data.get('total_consumption'),
            charter_party_consumption=data.get('charter_party_consumption') or voyage.charter_party_consumption,
            wind_force=data.get('wind_force'),
            wind_direction=data.get('wind_direction', ''),
            wave_height=data.get('wave_height'),
            weather_factor=data.get('weather_factor', 1.0),
            rob_hfo=data.get('rob_hfo'),
            rob_lsfo=data.get('rob_lsfo'),
            rob_mdo=data.get('rob_mdo'),
            notes=data.get('notes', ''),
        )

        # Auto-compute total consumption if not provided
        if not report.total_consumption:
            report.total_consumption = (
                (report.me_consumption or 0)
                + (report.ae_consumption or 0)
                + (report.boiler_consumption or 0)
            )

        db.session.add(report)
        db.session.commit()

        return jsonify(report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add noon report', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>/performance', methods=['GET'])
@jwt_required()
def get_voyage_performance(voyage_id):
    """Return performance summary (daily and weekly aggregates)."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        reports = (
            NoonReport.query
            .filter_by(voyage_id=voyage_id)
            .order_by(NoonReport.report_date.asc())
            .all()
        )

        if not reports:
            return jsonify({
                'voyage_id': voyage_id,
                'message': 'No noon reports found for this voyage',
                'daily': [],
                'weekly': [],
                'summary': {},
            })

        # --- Daily aggregation ---
        daily_map = defaultdict(lambda: {
            'speeds': [], 'consumptions': [], 'distances': [],
            'weather_factors': [],
        })

        for r in reports:
            if not r.report_date:
                continue
            day = r.report_date.strftime('%Y-%m-%d')
            if r.actual_speed:
                daily_map[day]['speeds'].append(r.actual_speed)
            if r.me_consumption:
                daily_map[day]['consumptions'].append(r.me_consumption)
            if r.distance_nm:
                daily_map[day]['distances'].append(r.distance_nm)
            if r.weather_factor:
                daily_map[day]['weather_factors'].append(r.weather_factor)

        daily = []
        for day in sorted(daily_map.keys()):
            d = daily_map[day]
            total_dist = sum(d['distances'])
            total_cons = sum(d['consumptions'])
            daily.append({
                'date': day,
                'avg_speed': round(sum(d['speeds']) / len(d['speeds']), 2) if d['speeds'] else None,
                'total_consumption_mt': round(total_cons, 2),
                'total_distance_nm': round(total_dist, 1),
                'fuel_efficiency_nm_mt': round(total_dist / total_cons, 2) if total_cons else None,
                'avg_weather_factor': round(sum(d['weather_factors']) / len(d['weather_factors']), 2) if d['weather_factors'] else None,
            })

        # --- Weekly aggregation ---
        weekly_map = defaultdict(lambda: {
            'speeds': [], 'consumptions': [], 'distances': [],
        })
        for r in reports:
            if not r.report_date:
                continue
            # ISO week key
            week_key = r.report_date.strftime('%Y-W%W')
            if r.actual_speed:
                weekly_map[week_key]['speeds'].append(r.actual_speed)
            if r.me_consumption:
                weekly_map[week_key]['consumptions'].append(r.me_consumption)
            if r.distance_nm:
                weekly_map[week_key]['distances'].append(r.distance_nm)

        weekly = []
        for week in sorted(weekly_map.keys()):
            w = weekly_map[week]
            total_dist = sum(w['distances'])
            total_cons = sum(w['consumptions'])
            weekly.append({
                'week': week,
                'avg_speed': round(sum(w['speeds']) / len(w['speeds']), 2) if w['speeds'] else None,
                'total_consumption_mt': round(total_cons, 2),
                'total_distance_nm': round(total_dist, 1),
                'fuel_efficiency_nm_mt': round(total_dist / total_cons, 2) if total_cons else None,
            })

        # --- Overall summary ---
        all_speeds = [r.actual_speed for r in reports if r.actual_speed]
        all_cp_speeds = [r.charter_party_speed for r in reports if r.charter_party_speed]
        all_cons = [r.me_consumption for r in reports if r.me_consumption]
        all_cp_cons = [r.charter_party_consumption for r in reports if r.charter_party_consumption]
        all_dist = [r.distance_nm for r in reports if r.distance_nm]

        total_distance = sum(all_dist)
        total_fuel = sum(all_cons)

        avg_speed = round(sum(all_speeds) / len(all_speeds), 2) if all_speeds else 0
        avg_cp_speed = round(sum(all_cp_speeds) / len(all_cp_speeds), 2) if all_cp_speeds else avg_speed
        avg_cons = round(sum(all_cons) / len(all_cons), 2) if all_cons else 0
        avg_cp_cons = round(sum(all_cp_cons) / len(all_cp_cons), 2) if all_cp_cons else avg_cons

        speed_variance = round(avg_speed - avg_cp_speed, 2)
        cons_variance_pct = (
            round(((avg_cons - avg_cp_cons) / avg_cp_cons) * 100, 2)
            if avg_cp_cons else 0
        )

        summary = {
            'total_distance_nm': round(total_distance, 1),
            'total_fuel_consumed_mt': round(total_fuel, 1),
            'avg_speed_knots': avg_speed,
            'avg_cp_speed_knots': avg_cp_speed,
            'speed_variance_knots': speed_variance,
            'avg_consumption_mt_day': avg_cons,
            'avg_cp_consumption_mt_day': avg_cp_cons,
            'consumption_variance_pct': cons_variance_pct,
            'fuel_efficiency_nm_mt': round(total_distance / total_fuel, 2) if total_fuel else 0,
            'report_count': len(reports),
        }

        return jsonify({
            'voyage_id': voyage_id,
            'voyage_number': voyage.voyage_number,
            'vessel_name': voyage.vessel.name if voyage.vessel else None,
            'summary': summary,
            'daily': daily,
            'weekly': weekly,
        })
    except Exception as e:
        return jsonify({'error': 'Failed to compute voyage performance', 'details': str(e)}), 500


@voyages_bp.route('/<int:voyage_id>/claims', methods=['GET'])
@jwt_required()
def get_voyage_claims(voyage_id):
    """Get all claims associated with a voyage."""
    try:
        voyage = Voyage.query.get(voyage_id)
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        status_filter = request.args.get('status')
        query = Claim.query.filter_by(voyage_id=voyage_id)
        if status_filter:
            query = query.filter_by(status=status_filter)

        claims = query.order_by(Claim.created_at.desc()).all()

        total_amount = sum((c.claim_amount_usd or 0) for c in claims)

        return jsonify({
            'voyage_id': voyage_id,
            'voyage_number': voyage.voyage_number,
            'vessel_name': voyage.vessel.name if voyage.vessel else None,
            'claims': [c.to_dict() for c in claims],
            'total_claims': len(claims),
            'total_amount_usd': round(total_amount, 2),
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve claims', 'details': str(e)}), 500
