"""
Fleet analytics computed from stored noon reports.

Every figure here is derived from rows in the database. When there is no data
the endpoints say so (`data_source: "none"`, empty series, null values) instead
of inventing numbers. The only external assumption is the bunker price, which
is returned with each response so the UI can show it.
"""
import os
from collections import defaultdict
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Claim, NoonReport, Vessel, Voyage
from ..tenancy import current_org_id, get_scoped, scoped_query, tenant_required

analytics_bp = Blueprint('analytics', __name__)

# Assumption, not a measurement. Override with BUNKER_PRICE_USD_MT.
BUNKER_PRICE_USD_MT = float(os.environ.get('BUNKER_PRICE_USD_MT', '620'))
SPEED_TOLERANCE_KN = 0.5
IDLE_SPEED_KN = 1.0
ROUGH_WEATHER_BFT = 6


def _f(value):
    """Decimal/None to float (None stays None)."""
    return float(value) if value is not None else None


def _sum(*values):
    return sum(float(v) for v in values if v is not None)


class Row:
    """One noon report with its vessel and voyage, normalised to floats."""

    def __init__(self, report, vessel, voyage):
        self.r = report
        self.vessel = vessel
        self.voyage = voyage
        self.date = report.report_date
        self.distance = _f(report.distance_noon_to_noon)
        self.sog = _f(report.speed_over_ground)
        self.bft = report.wind_force_bft
        self.weather_factor = _f(report.weather_factor)
        self.me = _sum(report.me_lsfo, report.me_mgo)
        self.ae = _sum(report.ae_lsfo, report.ae_mgo)
        self.boiler = _sum(report.boiler_lsfo, report.boiler_mgo)
        total = _f(report.total_fuel_consumption)
        self.total = total if total else (self.me + self.ae + self.boiler)
        self.rob_lsfo = _f(report.rob_lsfo)
        self.rob_mgo = _f(report.rob_mgo)

    @property
    def warranted_speed(self):
        v = self.voyage.charter_party_speed if self.voyage is not None else None
        v = v if v is not None else (self.vessel.warranted_speed if self.vessel is not None else None)
        return _f(v)

    @property
    def warranted_consumption(self):
        v = self.voyage.charter_party_consumption if self.voyage is not None else None
        v = v if v is not None else (self.vessel.warranted_consumption if self.vessel is not None else None)
        return _f(v)


def _load(days, vessel_id=None):
    """Noon reports in the `days` before the most recent report.

    The window ends at the latest report rather than at "now", so a fleet that
    reports late (or a historical dataset) still shows its most recent period.
    """
    org_id = current_org_id()
    latest_q = db.session.query(db.func.max(NoonReport.report_date)).filter(
        NoonReport.organization_id == org_id)
    if vessel_id:
        latest_q = latest_q.filter(NoonReport.vessel_id == vessel_id)
    latest = latest_q.scalar()
    if latest is None:
        return []
    if not isinstance(latest, datetime):
        latest = datetime(latest.year, latest.month, latest.day)
    since = latest - timedelta(days=days)

    q = (
        db.session.query(NoonReport, Vessel, Voyage)
        .join(Vessel, NoonReport.vessel_id == Vessel.id)
        .outerjoin(Voyage, NoonReport.voyage_id == Voyage.id)
        .filter(NoonReport.organization_id == org_id, NoonReport.report_date >= since)
    )
    if vessel_id:
        q = q.filter(NoonReport.vessel_id == vessel_id)
    return [Row(r, v, vy) for r, v, vy in q.order_by(NoonReport.report_date.asc()).all()]


def _avg(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def _round(v, n=2):
    return round(v, n) if v is not None else None


def _day(d):
    return d.strftime('%Y-%m-%d') if d else None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@analytics_bp.route('/dashboard', methods=['GET'])
@tenant_required('read')
def get_dashboard():
    """Fleet KPIs for the last 30 days."""
    from .vessels import _compute_health_score

    days = 30
    rows = _load(days)

    active_vessels = scoped_query(Vessel).filter_by(status='active').count()
    active_voyages = scoped_query(Voyage).filter(Voyage.status.in_(['active', 'in_progress'])).count()
    open_claims = scoped_query(Claim).filter_by(status='open').count()

    out = {
        'total_distance_nm': None, 'avg_speed': None, 'total_fuel_consumed': None,
        'fuel_efficiency': None, 'weather_risk_score': None, 'performance_score': None,
        'excess_fuel_cost_usd': None, 'idle_days': None, 'fleet_health_score': None,
        'health_breakdown': {}, 'by_vessel': [], 'weather_mix': None,
        'active_vessels': active_vessels, 'active_voyages': active_voyages,
        'open_claims': open_claims, 'report_count': len(rows),
        'period_days': days, 'period_end': _day(rows[-1].date) if rows else None,
        'data_source': 'live' if rows else 'none',
        'assumptions': {'bunker_price_usd_mt': BUNKER_PRICE_USD_MT, 'speed_tolerance_kn': SPEED_TOLERANCE_KN},
        'generated_at': datetime.utcnow().isoformat(),
    }
    if not rows:
        return jsonify(out)

    distance = sum(r.distance or 0 for r in rows)
    fuel = sum(r.total for r in rows)
    out['total_distance_nm'] = round(distance, 0)
    out['total_fuel_consumed'] = round(fuel, 1)
    out['avg_speed'] = _round(_avg([r.sog for r in rows]))
    out['fuel_efficiency'] = round(distance / fuel, 2) if fuel else None

    with_bft = [r for r in rows if r.bft is not None]
    if with_bft:
        rough = sum(1 for r in with_bft if r.bft >= ROUGH_WEATHER_BFT)
        out['weather_risk_score'] = round(rough / len(with_bft) * 100, 1)  # % of report days at Bft 6+

    scored = [r for r in rows if r.sog is not None and r.warranted_speed]
    if scored:
        ok = sum(1 for r in scored if abs(r.sog - r.warranted_speed) <= SPEED_TOLERANCE_KN)
        out['performance_score'] = round(ok / len(scored) * 100, 1)  # % of days within tolerance

    excess = 0.0
    for r in rows:
        if r.me and r.warranted_consumption and r.me > r.warranted_consumption:
            excess += r.me - r.warranted_consumption
    out['excess_fuel_cost_usd'] = round(excess * BUNKER_PRICE_USD_MT, 0)

    out['idle_days'] = sum(1 for r in rows if r.sog is not None and r.sog < IDLE_SPEED_KN)

    scores = []
    by_vessel = defaultdict(list)
    for r in rows:
        by_vessel[r.vessel.id].append(r)
    for vrows in by_vessel.values():
        scores.append(_compute_health_score(vrows[0].vessel, [x.r for x in vrows])['total'])
    scores = [s for s in scores if s is not None]
    out['fleet_health_score'] = _round(_avg(scores), 1)

    # Average of each health component across vessels (null components are skipped).
    comps = defaultdict(list)
    per_vessel = []
    for vrows in by_vessel.values():
        vessel = vrows[0].vessel
        health = _compute_health_score(vessel, [x.r for x in vrows])
        for k, v in (health.get('breakdown') or {}).items():
            if v is not None:
                comps[k].append(v)
        ok = [x for x in vrows if x.sog is not None and x.warranted_speed]
        per_vessel.append({
            'id': vessel.id, 'name': vessel.name, 'report_count': len(vrows),
            'health': health['total'],
            'speed_compliance_pct': (
                round(sum(1 for x in ok if abs(x.sog - x.warranted_speed) <= SPEED_TOLERANCE_KN) / len(ok) * 100, 1)
                if ok else None
            ),
        })
    out['health_breakdown'] = {k: round(_avg(v) / 25 * 100, 0) for k, v in comps.items()}  # each component is /25
    out['by_vessel'] = sorted(per_vessel, key=lambda x: x['name'])

    if with_bft:
        n = len(with_bft)
        out['weather_mix'] = {
            'calm': round(sum(1 for r in with_bft if r.bft <= 3) / n * 100, 1),
            'moderate': round(sum(1 for r in with_bft if 4 <= r.bft <= 5) / n * 100, 1),
            'rough': round(sum(1 for r in with_bft if r.bft >= 6) / n * 100, 1),
        }
    return jsonify(out)


# ---------------------------------------------------------------------------
# Fuel
# ---------------------------------------------------------------------------

@analytics_bp.route('/fuel', methods=['GET'])
@tenant_required('read')
def get_fuel_analytics():
    days = min(max(request.args.get('days', 30, type=int), 1), 365)
    vessel_id = request.args.get('vessel_id') or None
    rows = _load(days, vessel_id)

    vessel = get_scoped(Vessel, vessel_id) if vessel_id else None
    if vessel_id and vessel is None:
        return jsonify({'error': 'Vessel not found'}), 404
    warranted = None
    if vessel is not None:
        warranted = {
            'speed': _f(vessel.warranted_speed),
            'consumption': _f(vessel.warranted_consumption),
        }

    base = {
        'daily_consumption': [], 'monthly_trend': [], 'fuel_type_split': {'lsfo': 0, 'mgo': 0},
        'avg_efficiency': None, 'total_cost_usd': None, 'total_consumed_mt': None,
        'bunker_price_per_mt': BUNKER_PRICE_USD_MT, 'warranted': warranted, 'insights': [],
        'period_days': days, 'data_source': 'live' if rows else 'none',
        'generated_at': datetime.utcnow().isoformat(),
    }
    if not rows:
        return jsonify(base)

    daily = defaultdict(lambda: {'me': 0.0, 'ae': 0.0, 'boiler': 0.0, 'distance': 0.0, 'rob_lsfo': None, 'rob_mgo': None})
    monthly = defaultdict(float)
    for r in rows:
        d = daily[_day(r.date)]
        d['me'] += r.me
        d['ae'] += r.ae
        d['boiler'] += r.boiler
        d['distance'] += r.distance or 0
        if r.rob_lsfo is not None:
            d['rob_lsfo'] = r.rob_lsfo  # rows are ordered, so the last one of the day wins
        if r.rob_mgo is not None:
            d['rob_mgo'] = r.rob_mgo
        monthly[r.date.strftime('%Y-%m')] += r.total

    base['daily_consumption'] = [
        {
            'date': day, 'me': round(v['me'], 2), 'ae': round(v['ae'], 2),
            'boiler': round(v['boiler'], 2), 'total': round(v['me'] + v['ae'] + v['boiler'], 2),
            'distance': round(v['distance'], 1),
            'rob_lsfo': v['rob_lsfo'], 'rob_mgo': v['rob_mgo'],
        }
        for day, v in sorted(daily.items())
    ]
    base['monthly_trend'] = [
        {'month': m, 'total_mt': round(t, 1), 'cost_usd': round(t * BUNKER_PRICE_USD_MT, 0)}
        for m, t in sorted(monthly.items())
    ]

    lsfo = sum(_sum(r.r.me_lsfo, r.r.ae_lsfo, r.r.boiler_lsfo) for r in rows)
    mgo = sum(_sum(r.r.me_mgo, r.r.ae_mgo, r.r.boiler_mgo) for r in rows)
    base['fuel_type_split'] = {'lsfo': round(lsfo, 1), 'mgo': round(mgo, 1)}

    total = sum(r.total for r in rows)
    distance = sum(r.distance or 0 for r in rows)
    base['total_consumed_mt'] = round(total, 1)
    base['total_cost_usd'] = round(total * BUNKER_PRICE_USD_MT, 0)
    base['avg_efficiency'] = round(distance / total, 2) if total else None

    insights = []
    me_total = sum(r.me for r in rows)
    if total:
        insights.append(f'Main engine accounts for {me_total / total * 100:.0f}% of fuel burned over {len(daily)} reporting days.')
    if warranted and warranted['consumption']:
        over = [r for r in rows if r.me and r.me > warranted['consumption']]
        if over:
            avg_over = sum(r.me - warranted['consumption'] for r in over) / len(over)
            insights.append(
                f'{len(over)} of {len(rows)} reports show main-engine burn above the warranted '
                f'{warranted["consumption"]:.1f} MT/day, by {avg_over:.1f} MT/day on average.'
            )
    base['insights'] = insights
    return jsonify(base)


# ---------------------------------------------------------------------------
# Performance trend
# ---------------------------------------------------------------------------

@analytics_bp.route('/performance', methods=['GET'])
@tenant_required('read')
def get_performance_trends():
    days = min(max(request.args.get('days', 90, type=int), 1), 730)
    vessel_id = request.args.get('vessel_id') or None
    rows = _load(days, vessel_id)

    weeks = defaultdict(list)
    for r in rows:
        weeks[r.date.strftime('%G-W%V')].append(r)

    trend = []
    for week, wr in sorted(weeks.items()):
        speed = _avg([r.sog for r in wr])
        cp_speed = _avg([r.warranted_speed for r in wr])
        cons = _avg([r.me or None for r in wr])
        cp_cons = _avg([r.warranted_consumption for r in wr])
        fuel = sum(r.total for r in wr)
        dist = sum(r.distance or 0 for r in wr)
        trend.append({
            'week': week,
            'avg_speed': _round(speed), 'avg_cp_speed': _round(cp_speed),
            'speed_variance': _round(speed - cp_speed) if speed is not None and cp_speed is not None else None,
            'avg_consumption': _round(cons), 'avg_cp_consumption': _round(cp_cons),
            'consumption_variance_pct': (
                _round((cons - cp_cons) / cp_cons * 100) if cons is not None and cp_cons else None
            ),
            'fuel_efficiency_nm_mt': round(dist / fuel, 2) if fuel else None,
            'avg_weather_factor': _round(_avg([r.weather_factor for r in wr])),
        })

    return jsonify({
        'weekly_trend': trend, 'period_days': days,
        'data_source': 'live' if rows else 'none',
        'generated_at': datetime.utcnow().isoformat(),
    })


# ---------------------------------------------------------------------------
# Weather impact
# ---------------------------------------------------------------------------

BANDS = [
    ('calm_0_3', 'Beaufort 0-3', 0, 3),
    ('moderate_4_5', 'Beaufort 4-5', 4, 5),
    ('rough_6_7', 'Beaufort 6-7', 6, 7),
    ('severe_8_plus', 'Beaufort 8+', 8, 99),
]


@analytics_bp.route('/weather-impact', methods=['GET'])
@tenant_required('read')
def get_weather_impact():
    """Speed and fuel deviation from warranted values, grouped by Beaufort force."""
    days = min(max(request.args.get('days', 90, type=int), 1), 730)
    vessel_id = request.args.get('vessel_id') or None
    rows = [r for r in _load(days, vessel_id) if r.bft is not None]

    bands = {}
    for key, label, lo, hi in BANDS:
        br = [r for r in rows if lo <= r.bft <= hi]
        speed_loss = [r.warranted_speed - r.sog for r in br if r.sog is not None and r.warranted_speed]
        excess = [r.me - r.warranted_consumption for r in br if r.me and r.warranted_consumption]
        bands[key] = {
            'label': label, 'report_count': len(br),
            'avg_speed_loss_kn': _round(_avg(speed_loss)),
            'avg_excess_consumption_mt': _round(_avg(excess)),
            'avg_weather_factor': _round(_avg([r.weather_factor for r in br])),
        }

    histogram = [0] * 13
    for r in rows:
        histogram[min(max(int(r.bft), 0), 12)] += 1

    cost = sum(
        max(0.0, r.me - r.warranted_consumption)
        for r in rows if r.bft >= ROUGH_WEATHER_BFT and r.me and r.warranted_consumption
    ) * BUNKER_PRICE_USD_MT

    insights = []
    rough = bands['rough_6_7']
    calm = bands['calm_0_3']
    if rough['report_count'] and rough['avg_excess_consumption_mt'] is not None:
        insights.append(
            f'On {rough["report_count"]} days at Beaufort 6-7 the main engine burned '
            f'{rough["avg_excess_consumption_mt"]:+.1f} MT/day against the warranted figure.'
        )
    if calm['report_count'] and calm['avg_speed_loss_kn'] is not None and calm['avg_speed_loss_kn'] > 0.1:
        insights.append(
            f'In calm weather (Beaufort 0-3, {calm["report_count"]} days) speed was still '
            f'{calm["avg_speed_loss_kn"]:.2f} kn below warranted on average, so that shortfall is not explained by weather.'
        )

    return jsonify({
        'weather_bands': bands, 'beaufort_histogram': histogram,
        'estimated_weather_cost_usd': round(cost, 0) if rows else None,
        'period_days': days, 'data_source': 'live' if rows else 'none',
        'assumptions': {'bunker_price_usd_mt': BUNKER_PRICE_USD_MT},
        'insights': insights, 'generated_at': datetime.utcnow().isoformat(),
    })
