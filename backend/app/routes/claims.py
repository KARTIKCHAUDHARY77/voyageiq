"""
Charter-party performance claims.

Detection compares noon-report performance with the warranted speed and
consumption (from the voyage's charter-party terms, falling back to the vessel's
warranted figures). Charter parties normally warrant performance in good weather
only, so detection uses reports at Beaufort 4 or below and says so in each claim.

The hire rate and bunker price are assumptions, not measurements. They are
stored with every claim so a reviewer can see exactly what the dollar figure
rests on.
"""
import os
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Claim, NoonReport, Vessel, Voyage
from ..security import CLAIM_WRITE_ROLES, roles_required

claims_bp = Blueprint('claims', __name__)

HIRE_RATE_USD_DAY = float(os.environ.get('DEFAULT_HIRE_RATE_USD_DAY', '15000'))
BUNKER_PRICE_USD_MT = float(os.environ.get('BUNKER_PRICE_USD_MT', '620'))

GOOD_WEATHER_MAX_BFT = 4
MIN_GOOD_WEATHER_REPORTS = 3
SPEED_SHORTFALL_KN = 0.3          # flag when average speed is this far below warranted
EXCESS_CONSUMPTION_PCT = 5.0      # flag when average burn is this far above warranted

VALID_STATUSES = {'open', 'acknowledged', 'disputed', 'resolved', 'closed'}
VALID_SEVERITIES = {'low', 'medium', 'high', 'critical'}


def _f(v):
    return float(v) if v is not None else None


def _claim_dict(claim, voyage=None, vessel=None):
    d = claim.to_dict()
    d['type'] = claim.claim_type  # the UI reads `type`
    d['notes'] = claim.notes
    d['supporting_data'] = claim.supporting_data
    d['bunker_price_usd'] = _f(claim.bunker_price_usd)
    d['hire_rate_usd'] = _f(claim.hire_rate_usd)
    voyage = voyage or db.session.get(Voyage, claim.voyage_id)
    vessel = vessel or db.session.get(Vessel, claim.vessel_id)
    d['voyage_number'] = voyage.voyage_number if voyage else None
    d['vessel_name'] = vessel.name if vessel else None
    return d


def _severity(impact_usd):
    if impact_usd >= 100_000:
        return 'critical'
    if impact_usd >= 50_000:
        return 'high'
    if impact_usd >= 10_000:
        return 'medium'
    return 'low'


def _detect(voyage, vessel, reports):
    """Return (findings, notes). Findings are unsaved dicts; notes explain what could not be assessed."""
    findings, notes = [], []

    cp_speed = _f(voyage.charter_party_speed) or _f(vessel.warranted_speed)
    cp_cons = _f(voyage.charter_party_consumption) or _f(vessel.warranted_consumption)

    good = [r for r in reports if r.wind_force_bft is not None and r.wind_force_bft <= GOOD_WEATHER_MAX_BFT]
    if len(good) < MIN_GOOD_WEATHER_REPORTS:
        notes.append(
            f'Only {len(good)} good-weather report(s) (Beaufort {GOOD_WEATHER_MAX_BFT} or less); '
            f'at least {MIN_GOOD_WEATHER_REPORTS} are needed for a performance claim.'
        )
        return findings, notes

    period_start = min(r.report_date for r in good)
    period_end = max(r.report_date for r in good)
    basis = (f'{len(good)} of {len(reports)} reports at Beaufort {GOOD_WEATHER_MAX_BFT} or below '
             f'(heavier weather excluded, as is usual for charter-party warranties).')

    # 1. Speed shortfall ------------------------------------------------------
    speeds = [(_f(r.speed_over_ground), _f(r.distance_noon_to_noon)) for r in good if r.speed_over_ground]
    if cp_speed and speeds:
        avg_speed = sum(s for s, _ in speeds) / len(speeds)
        variance = avg_speed - cp_speed
        if variance < -SPEED_SHORTFALL_KN:
            distance = sum(d or 0 for _, d in speeds)
            days_lost = (distance / avg_speed - distance / cp_speed) / 24 if avg_speed > 0 else 0
            impact = round(max(0.0, days_lost) * HIRE_RATE_USD_DAY, 2)
            findings.append({
                'claim_type': 'speed_loss', 'severity': _severity(impact),
                'expected_value': cp_speed, 'actual_value': round(avg_speed, 3), 'variance': round(variance, 3),
                'unit': 'kn', 'estimated_impact_usd': impact,
                'bunker_price_usd': None, 'hire_rate_usd': HIRE_RATE_USD_DAY,
                'period_start': period_start, 'period_end': period_end,
                'description': (f'Average speed {avg_speed:.2f} kn against {cp_speed:.2f} kn warranted '
                                f'({variance:+.2f} kn).'),
                'supporting_data': {
                    'basis': basis, 'reports_used': len(speeds), 'distance_nm': round(distance, 1),
                    'days_lost': round(days_lost, 2),
                    'calculation': f'{days_lost:.2f} days lost x ${HIRE_RATE_USD_DAY:,.0f}/day hire (assumed rate)',
                },
            })

    # 2. Excess consumption ---------------------------------------------------
    burns = []
    for r in good:
        burn = (_f(r.me_lsfo) or 0) + (_f(r.me_mgo) or 0)
        if burn > 0:
            burns.append(burn)
    if cp_cons and burns:
        avg_burn = sum(burns) / len(burns)
        variance_pct = (avg_burn - cp_cons) / cp_cons * 100
        if variance_pct > EXCESS_CONSUMPTION_PCT:
            excess_mt = (avg_burn - cp_cons) * len(burns)
            impact = round(excess_mt * BUNKER_PRICE_USD_MT, 2)
            findings.append({
                'claim_type': 'excess_consumption', 'severity': _severity(impact),
                'expected_value': cp_cons, 'actual_value': round(avg_burn, 3),
                'variance': round(avg_burn - cp_cons, 3), 'unit': 'MT/day',
                'estimated_impact_usd': impact,
                'bunker_price_usd': BUNKER_PRICE_USD_MT, 'hire_rate_usd': None,
                'period_start': period_start, 'period_end': period_end,
                'description': (f'Main-engine burn {avg_burn:.1f} MT/day against {cp_cons:.1f} MT/day '
                                f'warranted ({variance_pct:+.1f}%).'),
                'supporting_data': {
                    'basis': basis, 'reports_used': len(burns), 'excess_mt': round(excess_mt, 2),
                    'calculation': f'{excess_mt:.1f} MT x ${BUNKER_PRICE_USD_MT:,.0f}/MT bunker price (assumed price)',
                },
            })

    if not cp_speed and not cp_cons:
        notes.append('No warranted speed or consumption is recorded for this voyage or vessel.')
    return findings, notes


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@claims_bp.route('', methods=['GET'])
@jwt_required()
def list_claims():
    page = max(request.args.get('page', 1, type=int), 1)
    per_page = min(max(request.args.get('per_page', 50, type=int), 1), 100)

    query = Claim.query
    for arg in ('status', 'severity', 'voyage_id', 'vessel_id'):
        value = request.args.get(arg)
        if value:
            query = query.filter(getattr(Claim, arg) == value)

    pagination = query.order_by(Claim.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    open_exposure = db.session.query(db.func.coalesce(db.func.sum(Claim.estimated_impact_usd), 0)).filter(
        Claim.status == 'open').scalar()

    return jsonify({
        'claims': [_claim_dict(c) for c in pagination.items],
        'total': pagination.total, 'page': pagination.page, 'pages': pagination.pages,
        'per_page': per_page, 'open_exposure_usd': round(float(open_exposure or 0), 2),
    })


@claims_bp.route('/<claim_id>', methods=['GET'])
@jwt_required()
def get_claim(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim:
        return jsonify({'error': 'Claim not found'}), 404
    return jsonify(_claim_dict(claim))


@claims_bp.route('', methods=['POST'])
@jwt_required()
@roles_required(*CLAIM_WRITE_ROLES)
def create_claim():
    data = request.get_json(silent=True) or {}
    missing = [f for f in ('voyage_id', 'claim_type', 'description') if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    voyage = db.session.get(Voyage, data['voyage_id'])
    if not voyage:
        return jsonify({'error': 'Voyage not found'}), 404
    severity = data.get('severity', 'medium')
    if severity not in VALID_SEVERITIES:
        return jsonify({'error': f'severity must be one of: {", ".join(sorted(VALID_SEVERITIES))}'}), 400
    try:
        impact = float(data['estimated_impact_usd']) if data.get('estimated_impact_usd') not in (None, '') else None
    except (TypeError, ValueError):
        return jsonify({'error': 'estimated_impact_usd must be a number'}), 400

    claim = Claim(
        voyage_id=voyage.id, vessel_id=voyage.vessel_id,
        claim_type=str(data['claim_type'])[:100], detected_date=date.today(),
        severity=severity, status='open', description=str(data['description'])[:5000],
        estimated_impact_usd=impact, notes=(data.get('notes') or None),
    )
    db.session.add(claim)
    db.session.commit()
    return jsonify(_claim_dict(claim, voyage)), 201


@claims_bp.route('/<claim_id>/status', methods=['PUT'])
@jwt_required()
@roles_required(*CLAIM_WRITE_ROLES)
def update_claim_status(claim_id):
    claim = db.session.get(Claim, claim_id)
    if not claim:
        return jsonify({'error': 'Claim not found'}), 404

    data = request.get_json(silent=True) or {}
    status = data.get('status')
    if status not in VALID_STATUSES:
        return jsonify({'error': f'status must be one of: {", ".join(sorted(VALID_STATUSES))}'}), 400

    previous = claim.status
    claim.status = status
    if data.get('notes'):
        claim.notes = str(data['notes'])[:5000]
    db.session.commit()
    return jsonify({'claim_id': claim.id, 'previous_status': previous, 'new_status': status, 'claim': _claim_dict(claim)})


@claims_bp.route('/detect/<voyage_id>', methods=['POST', 'GET'])
@jwt_required()
@roles_required(*CLAIM_WRITE_ROLES)
def detect_claims(voyage_id):
    """Run detection for one voyage and save new findings. Re-running updates open claims instead of duplicating them."""
    voyage = db.session.get(Voyage, voyage_id)
    if not voyage:
        return jsonify({'error': 'Voyage not found'}), 404
    vessel = db.session.get(Vessel, voyage.vessel_id)

    reports = NoonReport.query.filter_by(voyage_id=voyage_id).order_by(NoonReport.report_date.asc()).all()
    base = {'voyage_id': voyage_id, 'voyage_number': voyage.voyage_number, 'vessel_name': vessel.name if vessel else None,
            'reports_analysed': len(reports), 'detected_claims': [], 'new_claims_created': 0, 'notes': []}
    if not reports:
        base['notes'].append('This voyage has no noon reports, so there is nothing to assess.')
        return jsonify(base)

    findings, notes = _detect(voyage, vessel, reports)
    saved, created = [], 0
    for f in findings:
        claim = Claim.query.filter_by(voyage_id=voyage_id, claim_type=f['claim_type'], status='open').first()
        if claim is None:
            claim = Claim(voyage_id=voyage_id, vessel_id=voyage.vessel_id, detected_date=date.today(), status='open')
            db.session.add(claim)
            created += 1
        for key, value in f.items():
            setattr(claim, key, value)
        saved.append(claim)
    db.session.commit()

    base.update({
        'detected_claims': [_claim_dict(c, voyage, vessel) for c in saved],
        'new_claims_created': created, 'notes': notes,
        'total_exposure_usd': round(sum(float(c.estimated_impact_usd or 0) for c in saved), 2),
        'assumptions': {'hire_rate_usd_day': HIRE_RATE_USD_DAY, 'bunker_price_usd_mt': BUNKER_PRICE_USD_MT},
        'detected_at': datetime.utcnow().isoformat(),
    })
    return jsonify(base)
