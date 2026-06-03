from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from ..models import Claim, Voyage, Vessel, NoonReport
from ..extensions import db

claims_bp = Blueprint('claims', __name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_HIRE_RATE_PER_DAY = 15_000.0   # USD/day
DEFAULT_BUNKER_PRICE_PER_MT = 620.0    # USD/MT

SPEED_LOSS_THRESHOLD_KN = -0.3         # avg variance below CP speed
EXCESS_CONSUMPTION_THRESHOLD_PCT = 5.0 # % above CP consumption


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _vessel_name(voyage: Voyage) -> str:
    return voyage.vessel.name if voyage and voyage.vessel else 'Unknown'


def _detect_claims_for_voyage(voyage: Voyage, reports: list) -> list:
    """
    Core detection algorithm.
    Returns a list of dicts describing detected claims (not yet persisted).
    """
    detected = []
    if not reports:
        return detected

    hire_rate = voyage.hire_rate_per_day or DEFAULT_HIRE_RATE_PER_DAY
    bunker_price = voyage.bunker_price_per_mt or DEFAULT_BUNKER_PRICE_PER_MT

    # ------------------------------------------------------------------
    # 1. Speed-loss claim
    # ------------------------------------------------------------------
    speed_pairs = [
        (r.actual_speed, r.charter_party_speed)
        for r in reports
        if r.actual_speed is not None and r.charter_party_speed is not None
    ]
    if speed_pairs:
        variances = [actual - cp for actual, cp in speed_pairs]
        avg_variance = sum(variances) / len(variances)

        if avg_variance < SPEED_LOSS_THRESHOLD_KN:
            # Days lost = distance / cp_speed - distance / actual_speed
            total_distance = sum(r.distance_nm for r in reports if r.distance_nm)
            avg_cp_speed = sum(cp for _, cp in speed_pairs) / len(speed_pairs)
            avg_actual_speed = sum(actual for actual, _ in speed_pairs) / len(speed_pairs)

            if avg_actual_speed > 0 and avg_cp_speed > 0:
                days_lost = (
                    total_distance / avg_actual_speed - total_distance / avg_cp_speed
                ) / 24  # convert hours → days
            else:
                days_lost = 0

            commercial_impact = round(max(0, days_lost) * hire_rate, 2)
            detected.append({
                'claim_type': 'speed_loss',
                'severity': 'high' if commercial_impact > 50_000 else 'medium',
                'description': (
                    f'Average speed {avg_actual_speed:.2f} kn vs CP speed {avg_cp_speed:.2f} kn '
                    f'(variance {avg_variance:.2f} kn over {len(speed_pairs)} reports).'
                ),
                'avg_speed_variance_kn': round(avg_variance, 3),
                'days_lost': round(days_lost, 2),
                'claim_amount_usd': commercial_impact,
                'calculation_basis': (
                    f'{round(days_lost, 2)} days × ${hire_rate:,.0f}/day hire rate'
                ),
            })

    # ------------------------------------------------------------------
    # 2. Excess fuel consumption claim
    # ------------------------------------------------------------------
    cons_pairs = [
        (r.me_consumption, r.charter_party_consumption)
        for r in reports
        if r.me_consumption is not None and r.charter_party_consumption is not None
        and r.charter_party_consumption > 0
    ]
    if cons_pairs:
        variances_pct = [
            ((actual - cp) / cp) * 100
            for actual, cp in cons_pairs
        ]
        avg_variance_pct = sum(variances_pct) / len(variances_pct)

        if avg_variance_pct > EXCESS_CONSUMPTION_THRESHOLD_PCT:
            total_cp_cons = sum(cp for _, cp in cons_pairs)
            total_actual_cons = sum(actual for actual, _ in cons_pairs)
            excess_fuel_mt = max(0.0, total_actual_cons - total_cp_cons)
            commercial_impact = round(excess_fuel_mt * bunker_price, 2)

            detected.append({
                'claim_type': 'excess_consumption',
                'severity': 'high' if commercial_impact > 30_000 else 'medium',
                'description': (
                    f'Average ME consumption {avg_variance_pct:.1f}% above CP allowance '
                    f'over {len(cons_pairs)} reports. '
                    f'Total excess: {excess_fuel_mt:.1f} MT.'
                ),
                'avg_consumption_variance_pct': round(avg_variance_pct, 2),
                'excess_fuel_mt': round(excess_fuel_mt, 2),
                'claim_amount_usd': commercial_impact,
                'calculation_basis': (
                    f'{round(excess_fuel_mt, 2)} MT × ${bunker_price:,.0f}/MT bunker price'
                ),
            })

    return detected


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@claims_bp.route('', methods=['GET'])
@jwt_required()
def list_claims():
    """List all claims with optional filters by status and severity."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status_filter = request.args.get('status')
        severity_filter = request.args.get('severity')
        voyage_id_filter = request.args.get('voyage_id', type=int)
        vessel_id_filter = request.args.get('vessel_id', type=int)

        query = Claim.query

        if status_filter:
            query = query.filter_by(status=status_filter)
        if severity_filter:
            query = query.filter_by(severity=severity_filter)
        if voyage_id_filter:
            query = query.filter_by(voyage_id=voyage_id_filter)
        if vessel_id_filter:
            # Join through Voyage to filter by vessel
            query = query.join(Voyage, Claim.voyage_id == Voyage.id).filter(
                Voyage.vessel_id == vessel_id_filter
            )

        pagination = query.order_by(Claim.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        claims_data = []
        for c in pagination.items:
            cd = c.to_dict()
            voyage = Voyage.query.get(c.voyage_id) if c.voyage_id else None
            cd['vessel_name'] = _vessel_name(voyage) if voyage else None
            cd['voyage_number'] = voyage.voyage_number if voyage else None
            claims_data.append(cd)

        total_open_amount = (
            db.session.query(db.func.sum(Claim.claim_amount_usd))
            .filter_by(status='open')
            .scalar() or 0
        )

        return jsonify({
            'claims': claims_data,
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': per_page,
            'total_open_amount_usd': round(float(total_open_amount), 2),
        })
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve claims', 'details': str(e)}), 500


@claims_bp.route('/<int:claim_id>', methods=['GET'])
@jwt_required()
def get_claim(claim_id):
    """Get full details for a single claim."""
    try:
        claim = Claim.query.get(claim_id)
        if not claim:
            return jsonify({'error': 'Claim not found'}), 404

        data = claim.to_dict()
        voyage = Voyage.query.get(claim.voyage_id) if claim.voyage_id else None
        if voyage:
            data['vessel_name'] = _vessel_name(voyage)
            data['voyage_number'] = voyage.voyage_number
            data['departure_port'] = voyage.departure_port
            data['arrival_port'] = voyage.arrival_port

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve claim', 'details': str(e)}), 500


@claims_bp.route('', methods=['POST'])
@jwt_required()
def create_claim():
    """Manually create a new claim."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        required = ['voyage_id', 'claim_type', 'description']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

        voyage = Voyage.query.get(data['voyage_id'])
        if not voyage:
            return jsonify({'error': 'Voyage not found'}), 404

        claim = Claim(
            voyage_id=data['voyage_id'],
            vessel_id=voyage.vessel_id,
            claim_type=data['claim_type'],
            severity=data.get('severity', 'medium'),
            status=data.get('status', 'open'),
            description=data['description'],
            claim_amount_usd=data.get('claim_amount_usd'),
            calculation_basis=data.get('calculation_basis', ''),
            evidence_summary=data.get('evidence_summary', ''),
            avg_speed_variance_kn=data.get('avg_speed_variance_kn'),
            avg_consumption_variance_pct=data.get('avg_consumption_variance_pct'),
            days_lost=data.get('days_lost'),
            excess_fuel_mt=data.get('excess_fuel_mt'),
            auto_detected=False,
            created_at=datetime.utcnow(),
        )

        db.session.add(claim)
        db.session.commit()

        return jsonify(claim.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create claim', 'details': str(e)}), 500


@claims_bp.route('/<int:claim_id>/status', methods=['PUT'])
@jwt_required()
def update_claim_status(claim_id):
    """Update the status of a claim (e.g. open → under_review → resolved)."""
    try:
        claim = Claim.query.get(claim_id)
        if not claim:
            return jsonify({'error': 'Claim not found'}), 404

        data = request.get_json()
        if not data or not data.get('status'):
            return jsonify({'error': 'status field is required'}), 400

        valid_statuses = {'open', 'under_review', 'disputed', 'settled', 'resolved', 'withdrawn'}
        if data['status'] not in valid_statuses:
            return jsonify({
                'error': f'Invalid status. Must be one of: {", ".join(sorted(valid_statuses))}'
            }), 400

        old_status = claim.status
        claim.status = data['status']

        if data.get('resolution_notes'):
            claim.resolution_notes = data['resolution_notes']
        if data.get('settled_amount_usd') is not None:
            claim.settled_amount_usd = data['settled_amount_usd']
        if data['status'] in ('resolved', 'settled', 'withdrawn'):
            claim.resolved_at = datetime.utcnow()

        claim.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'claim_id': claim_id,
            'previous_status': old_status,
            'new_status': claim.status,
            'claim': claim.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update claim status', 'details': str(e)}), 500


@claims_bp.route('/detect/<int:voyage_id>', methods=['GET'])
@jwt_required()
def detect_claims(voyage_id):
    """
    Run the claim detection algorithm against a voyage's noon reports.

    Steps:
    1. Query noon reports for the voyage.
    2. Compare actual vs CP speed → if avg variance < -0.3 kn flag speed_loss.
    3. Compare actual vs CP consumption → if > 5% excess flag excess_consumption.
    4. Calculate commercial impact for each flagged issue.
    5. Auto-create Claim records for newly detected issues.
    6. Return all detected claims.
    """
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
                'message': 'No noon reports found for this voyage. Cannot run detection.',
                'detected_claims': [],
                'new_claims_created': 0,
            })

        detected = _detect_claims_for_voyage(voyage, reports)

        new_claims = []
        for d in detected:
            # Avoid duplicate auto-detected claims of the same type
            existing = Claim.query.filter_by(
                voyage_id=voyage_id,
                claim_type=d['claim_type'],
                auto_detected=True,
            ).first()

            if not existing:
                claim = Claim(
                    voyage_id=voyage_id,
                    vessel_id=voyage.vessel_id,
                    claim_type=d['claim_type'],
                    severity=d.get('severity', 'medium'),
                    status='open',
                    description=d['description'],
                    claim_amount_usd=d.get('claim_amount_usd'),
                    calculation_basis=d.get('calculation_basis', ''),
                    avg_speed_variance_kn=d.get('avg_speed_variance_kn'),
                    avg_consumption_variance_pct=d.get('avg_consumption_variance_pct'),
                    days_lost=d.get('days_lost'),
                    excess_fuel_mt=d.get('excess_fuel_mt'),
                    auto_detected=True,
                    created_at=datetime.utcnow(),
                )
                db.session.add(claim)
                new_claims.append(claim)

        db.session.commit()

        # Return all claims (including previously detected ones) for this voyage
        all_claims = Claim.query.filter_by(voyage_id=voyage_id).order_by(
            Claim.created_at.desc()
        ).all()

        return jsonify({
            'voyage_id': voyage_id,
            'voyage_number': voyage.voyage_number,
            'vessel_name': _vessel_name(voyage),
            'reports_analysed': len(reports),
            'detected_issues': len(detected),
            'new_claims_created': len(new_claims),
            'detected_claims': detected,
            'all_voyage_claims': [c.to_dict() for c in all_claims],
            'total_exposure_usd': round(
                sum(d.get('claim_amount_usd', 0) for d in detected), 2
            ),
            'detected_at': datetime.utcnow().isoformat(),
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Claim detection failed', 'details': str(e)}), 500
