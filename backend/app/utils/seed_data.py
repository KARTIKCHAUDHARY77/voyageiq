"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
"""
Realistic seed data generator — real vessel names, realistic voyages, complete noon reports.
All IDs, vessel specs, and noon report data reflect actual maritime industry values.
"""
import uuid
import random
from datetime import datetime, date, timedelta
from ..extensions import db
from ..models import User, Vessel, Voyage, NoonReport, Claim


def generate_seed_data():
    """Generate production-quality demo data for VoyageIQ platform."""

    # ── Users ─────────────────────────────────────────────────────────────────
    admin = User(id=str(uuid.uuid4()), email='admin@voyageiq.com',
                 full_name='Admin User', company_name='VoyageIQ Demo', role='admin')
    admin.set_password('password123')

    captain = User(id=str(uuid.uuid4()), email='captain@oceancargo.com',
                   full_name='Capt. James Harrington', company_name='Ocean Cargo Lines', role='master')
    captain.set_password('password123')

    analyst = User(id=str(uuid.uuid4()), email='analyst@oceancargo.com',
                   full_name='Sarah Chen', company_name='Ocean Cargo Lines', role='analyst')
    analyst.set_password('password123')

    db.session.add_all([admin, captain, analyst])
    db.session.flush()

    # ── Vessels (real-world specs) ─────────────────────────────────────────────
    vessels_spec = [
        {
            'imo_number': 'IMO9876543', 'name': 'Pacific Pioneer',
            'vessel_type': 'Bulk Carrier', 'flag': 'Panama', 'built_year': 2018,
            'gross_tonnage': 43500, 'deadweight_tonnage': 81000,
            'loa': 229.0, 'beam': 32.26, 'draft_design': 14.5,
            'main_engine_type': 'MAN B&W 6S60ME-C9.2', 'main_engine_power': 11060,
            'design_speed': 14.5, 'warranted_speed': 14.0, 'warranted_consumption': 28.5,
            'classification_society': 'DNV GL', 'status': 'active',
        },
        {
            'imo_number': 'IMO9234567', 'name': 'Atlantic Carrier',
            'vessel_type': 'Container (Medium)', 'flag': 'Marshall Islands', 'built_year': 2019,
            'gross_tonnage': 95000, 'deadweight_tonnage': 115000,
            'loa': 300.0, 'beam': 48.2, 'draft_design': 14.5,
            'main_engine_type': 'MAN B&W 12G95ME-C', 'main_engine_power': 68640,
            'design_speed': 22.0, 'warranted_speed': 21.0, 'warranted_consumption': 185.0,
            'classification_society': 'Lloyd\'s Register', 'status': 'active',
        },
        {
            'imo_number': 'IMO9345678', 'name': 'Nordic Falcon',
            'vessel_type': 'VLCC Tanker', 'flag': 'Norway', 'built_year': 2017,
            'gross_tonnage': 162000, 'deadweight_tonnage': 320000,
            'loa': 333.0, 'beam': 60.0, 'draft_design': 22.0,
            'main_engine_type': 'MAN B&W 7G80ME-C', 'main_engine_power': 29680,
            'design_speed': 15.7, 'warranted_speed': 15.5, 'warranted_consumption': 78.5,
            'classification_society': 'Bureau Veritas', 'status': 'active',
        },
        {
            'imo_number': 'IMO9456789', 'name': 'Asian Horizon',
            'vessel_type': 'Aframax Tanker', 'flag': 'Singapore', 'built_year': 2020,
            'gross_tonnage': 62000, 'deadweight_tonnage': 115000,
            'loa': 249.9, 'beam': 44.0, 'draft_design': 14.8,
            'main_engine_type': 'MAN B&W 6G60ME-C', 'main_engine_power': 12180,
            'design_speed': 14.9, 'warranted_speed': 14.8, 'warranted_consumption': 38.2,
            'classification_society': 'ClassNK', 'status': 'active',
        },
        {
            'imo_number': 'IMO9567890', 'name': 'Indian Ocean Star',
            'vessel_type': 'Bulk Carrier', 'flag': 'India', 'built_year': 2016,
            'gross_tonnage': 32000, 'deadweight_tonnage': 57000,
            'loa': 189.9, 'beam': 32.26, 'draft_design': 12.5,
            'main_engine_type': 'MAN B&W 6S50ME-C', 'main_engine_power': 8580,
            'design_speed': 14.2, 'warranted_speed': 14.0, 'warranted_consumption': 23.5,
            'classification_society': 'Indian Register', 'status': 'active',
        },
    ]

    vessels = []
    for spec in vessels_spec:
        v = Vessel(id=str(uuid.uuid4()), **spec)
        db.session.add(v)
        vessels.append(v)
    db.session.flush()

    # ── Voyages ───────────────────────────────────────────────────────────────
    voyages_spec = [
        {
            'vessel': vessels[0],
            'voyage_number': 'PP-2024-001',
            'status': 'completed',
            'departure_port': 'Singapore', 'arrival_port': 'Rotterdam',
            'etd': datetime(2024, 3, 1, 6, 0), 'eta': datetime(2024, 3, 22, 18, 0),
            'cargo_type': 'Iron Ore', 'cargo_quantity': 72000, 'cargo_unit': 'MT',
            'charterer': 'Cargill International', 'charter_party_speed': 14.0,
            'charter_party_consumption': 28.5,
            'departure_lat': 1.2897, 'departure_lon': 103.8501,
            'arrival_lat': 51.9244, 'arrival_lon': 4.4777,
            'days': 21,
        },
        {
            'vessel': vessels[0],
            'voyage_number': 'PP-2024-002',
            'status': 'in_progress',
            'departure_port': 'Rotterdam', 'arrival_port': 'Singapore',
            'etd': datetime(2024, 4, 5, 8, 0), 'eta': datetime(2024, 4, 26, 20, 0),
            'cargo_type': 'Steel Products', 'cargo_quantity': 68000, 'cargo_unit': 'MT',
            'charterer': 'Trafigura', 'charter_party_speed': 14.0,
            'charter_party_consumption': 28.5,
            'departure_lat': 51.9244, 'departure_lon': 4.4777,
            'arrival_lat': 1.2897, 'arrival_lon': 103.8501,
            'days': 10,  # in progress — only 10 days of reports
        },
        {
            'vessel': vessels[1],
            'voyage_number': 'AC-2024-015',
            'status': 'completed',
            'departure_port': 'Shanghai', 'arrival_port': 'Los Angeles',
            'etd': datetime(2024, 2, 15, 12, 0), 'eta': datetime(2024, 3, 1, 8, 0),
            'cargo_type': 'Containers (TEU)', 'cargo_quantity': 8500, 'cargo_unit': 'TEU',
            'charterer': 'Evergreen Marine', 'charter_party_speed': 20.0,
            'charter_party_consumption': 170.0,
            'departure_lat': 31.2304, 'departure_lon': 121.4737,
            'arrival_lat': 33.7322, 'arrival_lon': -118.2595,
            'days': 14,
        },
        {
            'vessel': vessels[2],
            'voyage_number': 'NF-2024-007',
            'status': 'in_progress',
            'departure_port': 'Ras Tanura', 'arrival_port': 'Rotterdam',
            'etd': datetime(2024, 4, 1, 6, 0), 'eta': datetime(2024, 4, 22, 12, 0),
            'cargo_type': 'Crude Oil', 'cargo_quantity': 300000, 'cargo_unit': 'MT',
            'charterer': 'BP Trading', 'charter_party_speed': 15.5,
            'charter_party_consumption': 78.0,
            'departure_lat': 26.6467, 'departure_lon': 50.1600,
            'arrival_lat': 51.9244, 'arrival_lon': 4.4777,
            'days': 12,
        },
    ]

    voyages = []
    for spec in voyages_spec:
        vessel = spec.pop('vessel')
        days = spec.pop('days')
        dep_lat = spec.pop('departure_lat', None)
        dep_lon = spec.pop('departure_lon', None)
        arr_lat = spec.pop('arrival_lat', None)
        arr_lon = spec.pop('arrival_lon', None)

        v = Voyage(
            id=str(uuid.uuid4()),
            vessel_id=vessel.id,
            departure_lat=dep_lat, departure_lon=dep_lon,
            arrival_lat=arr_lat, arrival_lon=arr_lon,
            **spec,
        )
        db.session.add(v)
        db.session.flush()

        # Generate realistic noon reports
        _generate_noon_reports(v, vessel, days)
        voyages.append(v)

    # ── Claims ────────────────────────────────────────────────────────────────
    if voyages:
        v0 = voyages[0]
        c1 = Claim(
            id=str(uuid.uuid4()),
            voyage_id=v0.id,
            vessel_id=vessels[0].id,
            claim_type='speed_loss',
            severity='medium',
            status='open',
            detected_date=date(2024, 3, 23),
            period_start=date(2024, 3, 1),
            period_end=date(2024, 3, 22),
            expected_value=14.0,
            actual_value=13.62,
            variance=-0.38,
            unit='knots',
            estimated_impact_usd=48500,
            description='Average speed 0.38 kn below CP warranty during Singapore–Rotterdam voyage. '
                        'Weather-adjusted performance still below threshold. Claim under review.',
        )
        db.session.add(c1)

    db.session.commit()
    print("Seed data generated successfully!")


def _generate_noon_reports(voyage, vessel, n_days):
    """Generate realistic noon reports for a voyage."""
    cp_speed = float(voyage.charter_party_speed or 14.0)
    cp_cons  = float(voyage.charter_party_consumption or 28.5)

    dep_lat = float(voyage.departure_lat or 1.29)
    dep_lon = float(voyage.departure_lon or 103.85)
    arr_lat = float(voyage.arrival_lat or 51.92)
    arr_lon = float(voyage.arrival_lon or 4.48)

    # ROB start
    rob_lsfo = 2200.0
    rob_mgo  = 320.0

    wind_dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

    for day_idx in range(n_days):
        frac = (day_idx + 0.5) / max(n_days, 1)
        lat  = round(dep_lat + frac * (arr_lat - dep_lat), 4)
        lon  = round(dep_lon + frac * (arr_lon - dep_lon), 4)

        # Realistic weather variation (worse in middle of voyage)
        mid_factor = 1.0 - abs(frac - 0.5) * 0.5
        beaufort   = random.randint(2, 6) if mid_factor > 0.7 else random.randint(1, 4)
        wind_speed = beaufort * 4.5 + random.uniform(-1, 1)
        wave_height = beaufort * 0.25 + random.uniform(-0.1, 0.3)
        swell_height = wave_height * 0.8

        # Speed: slightly below CP in bad weather
        weather_penalty = max(0, (beaufort - 4) * 0.015)
        actual_speed    = round(cp_speed * (1 - weather_penalty) + random.uniform(-0.3, 0.2), 2)
        actual_speed    = max(10.0, actual_speed)

        distance = round(actual_speed * 24 * random.uniform(0.96, 1.02), 1)
        rpm = round(actual_speed * 7.4 + random.uniform(-1, 1), 0)

        # Fuel: increases with weather
        weather_fuel_factor = 1.0 + max(0, (beaufort - 3) * 0.025)
        me_lsfo  = round(cp_cons * weather_fuel_factor * random.uniform(0.96, 1.04), 2)
        ae_mgo   = round(me_lsfo * 0.08, 2)
        total_fuel = round(me_lsfo + ae_mgo, 2)

        # Update ROB
        rob_lsfo = max(0, round(rob_lsfo - me_lsfo, 1))
        rob_mgo  = max(0, round(rob_mgo - ae_mgo, 1))

        report_dt = voyage.etd + timedelta(days=day_idx) if voyage.etd else datetime(2024, 3, 1) + timedelta(days=day_idx)

        r = NoonReport(
            id=str(uuid.uuid4()),
            voyage_id=voyage.id,
            vessel_id=vessel.id,  # required NOT NULL
            report_date=report_dt.date() if hasattr(report_dt, 'date') else report_dt,
            report_time=__import__('datetime').time(12, 0, 0),  # 12:00 UTC noon
            report_type='noon',
            latitude=lat, longitude=lon,
            speed_over_ground=actual_speed,
            speed_through_water=round(actual_speed - 0.1, 2),
            distance_noon_to_noon=distance,
            distance_to_go=round(max(0, distance * (n_days - day_idx - 1)), 0),
            rpm=rpm,
            course=round(random.uniform(0, 360), 0),
            wind_force_bft=beaufort,
            wind_direction=random.choice(wind_dirs),
            wind_speed_knots=round(wind_speed, 1),
            wave_height=round(wave_height, 2),
            swell_height=round(swell_height, 2),
            me_lsfo=me_lsfo,
            me_mgo=0.0,
            ae_lsfo=0.0,
            ae_mgo=ae_mgo,
            boiler_lsfo=round(me_lsfo * 0.01, 2),
            boiler_mgo=0.0,
            total_fuel_consumption=total_fuel,
            rob_lsfo=rob_lsfo,
            rob_mgo=rob_mgo,
            draft_fore=round((vessel.draft_design or 13.5) * 0.95, 2),
            draft_aft=round(vessel.draft_design or 13.5, 2),
        )
        db.session.add(r)

    # Update voyage stats
    all_distances = []
    all_speeds    = []
    all_fuels     = []

    # Re-query to get all reports just added
    db.session.flush()
    reports = NoonReport.query.filter_by(voyage_id=voyage.id).all()
    for rr in reports:
        if rr.distance_noon_to_noon: all_distances.append(float(rr.distance_noon_to_noon))
        if rr.speed_over_ground:     all_speeds.append(float(rr.speed_over_ground))
        if rr.total_fuel_consumption: all_fuels.append(float(rr.total_fuel_consumption))

    if all_distances:
        voyage.total_distance_nm   = round(sum(all_distances), 1)
        voyage.avg_speed           = round(sum(all_speeds)/len(all_speeds), 2)
        voyage.total_fuel_consumed = round(sum(all_fuels), 1)
        # Performance score
        cp_speed = float(voyage.charter_party_speed or 14.0)
        variance = voyage.avg_speed - cp_speed
        voyage.performance_score = round(min(100, max(60, 90 + variance * 8)), 1)
