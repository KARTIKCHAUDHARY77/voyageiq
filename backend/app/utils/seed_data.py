"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

import random
import uuid
from datetime import datetime, date, timedelta, time
from decimal import Decimal
from ..extensions import db
from ..models import User, Vessel, Voyage, NoonReport, Claim, FuelAnalytic, VesselPosition

def generate_seed_data():
    """Generate realistic demo data for VoyageIQ platform."""
    
    # Create admin user
    admin = User(
        id=str(uuid.uuid4()),
        email='admin@voyageiq.com',
        full_name='Admin User',
        company_name='VoyageIQ Demo',
        role='admin'
    )
    admin.set_password('password123')
    
    captain = User(
        id=str(uuid.uuid4()),
        email='captain@oceancargo.com',
        full_name='Capt. James Harbor',
        company_name='Ocean Cargo Lines',
        role='master'
    )
    captain.set_password('password123')
    
    analyst = User(
        id=str(uuid.uuid4()),
        email='analyst@oceancargo.com',
        full_name='Sarah Chen',
        company_name='Ocean Cargo Lines',
        role='analyst'
    )
    analyst.set_password('password123')
    
    db.session.add_all([admin, captain, analyst])
    db.session.flush()
    
    # Create vessels
    vessels_data = [
        {
            'imo_number': 'IMO9876543',
            'name': 'MV Pacific Star',
            'vessel_type': 'Bulk Carrier',
            'flag': 'Panama',
            'built_year': 2018,
            'gross_tonnage': 43500,
            'deadweight_tonnage': 81000,
            'loa': 229.0,
            'beam': 32.26,
            'draft_design': 14.5,
            'main_engine_type': 'MAN B&W 6S60ME-C',
            'main_engine_power': 11060,
            'design_speed': 14.5,
            'warranted_speed': 14.0,
            'warranted_consumption': 28.5,
            'classification_society': 'DNV GL',
            'status': 'active'
        },
        {
            'imo_number': 'IMO9234567',
            'name': 'MV Atlantic Pioneer',
            'vessel_type': 'Container Ship',
            'flag': 'Marshall Islands',
            'built_year': 2019,
            'gross_tonnage': 95000,
            'deadweight_tonnage': 115000,
            'loa': 300.0,
            'beam': 48.2,
            'draft_design': 14.5,
            'main_engine_type': 'MAN B&W 12G95ME-C',
            'main_engine_power': 68640,
            'design_speed': 22.0,
            'warranted_speed': 21.0,
            'warranted_consumption': 185.0,
            'classification_society': "Lloyd's Register",
            'status': 'active'
        },
        {
            'imo_number': 'IMO9345678',
            'name': 'MT Ocean Titan',
            'vessel_type': 'VLCC Tanker',
            'flag': 'Liberia',
            'built_year': 2020,
            'gross_tonnage': 162000,
            'deadweight_tonnage': 320000,
            'loa': 333.0,
            'beam': 60.0,
            'draft_design': 21.0,
            'main_engine_type': 'MAN B&W 7G80ME-C',
            'main_engine_power': 27160,
            'design_speed': 16.0,
            'warranted_speed': 15.5,
            'warranted_consumption': 82.0,
            'classification_society': 'ABS',
            'status': 'active'
        },
        {
            'imo_number': 'IMO9456789',
            'name': 'MV Arctic Breeze',
            'vessel_type': 'LNG Carrier',
            'flag': 'Singapore',
            'built_year': 2021,
            'gross_tonnage': 98000,
            'deadweight_tonnage': 82000,
            'loa': 295.0,
            'beam': 46.4,
            'draft_design': 11.5,
            'main_engine_type': 'WinGD 5X72DF',
            'main_engine_power': 12400,
            'design_speed': 19.5,
            'warranted_speed': 19.0,
            'warranted_consumption': 130.0,
            'classification_society': 'Bureau Veritas',
            'status': 'active'
        }
    ]
    
    vessels = []
    for vd in vessels_data:
        v = Vessel(**vd, owner_id=admin.id)
        db.session.add(v)
        vessels.append(v)
    db.session.flush()
    
    # Create voyages and generate noon reports
    voyage_routes = [
        ('Singapore', 'Rotterdam', 1.3521, 103.8198, 51.9244, 4.4777, 'Iron Ore', 75000, 'Pacific Star', 'BHP Mining'),
        ('Shanghai', 'Los Angeles', 31.2304, 121.4737, 34.0522, -118.2437, 'Electronics', 45000, 'Atlantic Pioneer', 'COSCO'),
        ('Ras Tanura', 'Ulsan', 26.6408, 50.1597, 35.5665, 129.2780, 'Crude Oil', 280000, 'Ocean Titan', 'Saudi Aramco'),
    ]
    
    voyages = []
    for i, (dep, arr, dlat, dlon, alat, alon, cargo, qty, vessel_name, charterer) in enumerate(voyage_routes):
        vessel = next(v for v in vessels if vessel_name in v.name)
        
        start_date = datetime.utcnow() - timedelta(days=25 + i*5)
        
        voyage = Voyage(
            id=str(uuid.uuid4()),
            vessel_id=vessel.id,
            voyage_number=f'V{2024}{i+1:03d}',
            status='in_progress',
            departure_port=dep,
            arrival_port=arr,
            departure_lat=dlat,
            departure_lon=dlon,
            arrival_lat=alat,
            arrival_lon=alon,
            etd=start_date,
            eta=start_date + timedelta(days=20+i*3),
            atd=start_date,
            cargo_type=cargo,
            cargo_quantity=qty,
            cargo_unit='MT',
            charterer=charterer,
            charter_party_speed=float(vessel.warranted_speed),
            charter_party_consumption=float(vessel.warranted_consumption),
            total_distance_nm=random.uniform(4000, 12000),
            total_fuel_consumed=random.uniform(800, 2500),
            avg_speed=float(vessel.warranted_speed) * random.uniform(0.92, 1.02),
            performance_score=random.uniform(72, 91),
            health_score=random.uniform(68, 88),
            freight_rate=random.uniform(15, 45)
        )
        db.session.add(voyage)
        voyages.append(voyage)
    db.session.flush()
    
    # Generate 20 days of noon reports per voyage
    for voyage in voyages:
        vessel = next(v for v in vessels if v.id == voyage.vessel_id)
        
        # Route interpolation (simplified)
        start_lat = float(voyage.departure_lat)
        start_lon = float(voyage.departure_lon)
        end_lat = float(voyage.arrival_lat)
        end_lon = float(voyage.arrival_lon)
        
        days = 20
        warranted_speed = float(vessel.warranted_speed)
        warranted_cons = float(vessel.warranted_consumption)
        rob_lsfo = 1200.0
        rob_mgo = 150.0
        
        for day in range(days):
            report_date = (voyage.atd + timedelta(days=day)).date()
            progress = day / days
            
            lat = start_lat + (end_lat - start_lat) * progress
            lon = start_lon + (end_lon - start_lon) * progress
            
            # Simulate weather variation
            bft = random.randint(1, 6)
            wind_speed = bft * 4.5 + random.uniform(-2, 2)
            wave_h = max(0.3, bft * 0.4 + random.uniform(-0.2, 0.3))
            
            # Weather factor affects performance
            weather_penalty = 1.0 + (bft - 2) * 0.02 if bft > 2 else 1.0
            
            actual_speed = warranted_speed * random.uniform(0.90, 1.02) / weather_penalty
            actual_speed = round(actual_speed, 2)
            
            me_lsfo = warranted_cons * weather_penalty * random.uniform(0.95, 1.08)
            me_mgo = warranted_cons * 0.04 * random.uniform(0.9, 1.1)
            ae_mgo = warranted_cons * 0.06 * random.uniform(0.9, 1.1)
            total_cons = me_lsfo + me_mgo + ae_mgo
            
            rob_lsfo = max(100, rob_lsfo - me_lsfo)
            rob_mgo = max(20, rob_mgo - (me_mgo + ae_mgo))
            
            dist = actual_speed * 24
            fuel_eff = dist / total_cons if total_cons > 0 else 0
            speed_var = actual_speed - warranted_speed
            cons_var = total_cons - warranted_cons
            
            report = NoonReport(
                id=str(uuid.uuid4()),
                voyage_id=voyage.id,
                vessel_id=vessel.id,
                report_date=report_date,
                report_time=time(12, 0),
                report_type='noon',
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                course=random.uniform(0, 359),
                speed_over_ground=actual_speed,
                speed_through_water=actual_speed * random.uniform(0.97, 1.03),
                distance_noon_to_noon=round(dist, 2),
                distance_to_go=round(float(voyage.total_distance_nm or 5000) * (1 - progress), 2),
                rpm=round(warranted_speed * 6.2 + random.uniform(-5, 5), 1),
                slip_percentage=round(random.uniform(1.5, 4.5), 2),
                wind_force_bft=bft,
                wind_direction=random.choice(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
                wind_speed_knots=round(wind_speed, 1),
                wave_height=round(wave_h, 2),
                swell_height=round(wave_h * 0.7, 2),
                current_speed=round(random.uniform(0.1, 1.5), 2),
                me_lsfo=round(me_lsfo, 3),
                me_mgo=round(me_mgo, 3),
                ae_mgo=round(ae_mgo, 3),
                boiler_lsfo=round(me_lsfo * 0.02, 3),
                total_lsfo_consumption=round(me_lsfo + me_lsfo * 0.02, 3),
                total_mgo_consumption=round(me_mgo + ae_mgo, 3),
                total_fuel_consumption=round(total_cons, 3),
                rob_lsfo=round(rob_lsfo, 3),
                rob_mgo=round(rob_mgo, 3),
                fresh_water_produced=round(random.uniform(18, 25), 2),
                fresh_water_consumed=round(random.uniform(12, 18), 2),
                cargo_quantity=float(voyage.cargo_quantity or 0),
                draft_fore=round(float(vessel.draft_design or 12) * random.uniform(0.85, 0.98), 2),
                draft_aft=round(float(vessel.draft_design or 12) * random.uniform(0.88, 1.0), 2),
                fuel_efficiency=round(fuel_eff, 4),
                speed_variance=round(speed_var, 2),
                consumption_variance=round(cons_var, 2),
                weather_factor=round(weather_penalty, 3)
            )
            db.session.add(report)
            
            # Add position record
            pos = VesselPosition(
                vessel_id=vessel.id,
                voyage_id=voyage.id,
                timestamp=voyage.atd + timedelta(days=day),
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                speed=actual_speed,
                course=random.uniform(0, 359)
            )
            db.session.add(pos)
    
    db.session.flush()
    
    # Generate claims
    claim_types = [
        ('speed_loss', 'critical', 'Speed loss detected: vessel averaging 0.8 knots below charter party speed', 'Speed (knots)'),
        ('excess_consumption', 'high', 'Excess fuel consumption: 8.3% above warranted consumption', 'Fuel (MT/day)'),
        ('underperformance', 'medium', 'Overall vessel underperformance due to adverse weather conditions', 'Performance (%)'),
    ]
    
    for voyage in voyages[:2]:
        vessel = next(v for v in vessels if v.id == voyage.vessel_id)
        for ct, severity, desc, unit in claim_types[:2]:
            warranted = float(vessel.warranted_consumption if 'consumption' in ct else vessel.warranted_speed)
            variance_pct = random.uniform(0.04, 0.12)
            actual = warranted * (1 + variance_pct if 'consumption' in ct else 1 - variance_pct)
            impact = variance_pct * warranted * 20 * 600 if 'consumption' in ct else variance_pct * warranted * 20 * 25000
            
            claim = Claim(
                id=str(uuid.uuid4()),
                voyage_id=voyage.id,
                vessel_id=vessel.id,
                claim_type=ct,
                detected_date=date.today() - timedelta(days=random.randint(2, 10)),
                period_start=voyage.atd.date() if voyage.atd else date.today() - timedelta(days=15),
                period_end=date.today() - timedelta(days=3),
                severity=severity,
                status='open',
                expected_value=round(warranted, 4),
                actual_value=round(actual, 4),
                variance=round(actual - warranted, 4),
                unit=unit,
                estimated_impact_usd=round(impact, 2),
                bunker_price_usd=620.0,
                hire_rate_usd=25000.0,
                description=desc
            )
            db.session.add(claim)
    
    # Generate fuel analytics
    for vessel in vessels[:3]:
        for voyage in [v for v in voyages if v.vessel_id == vessel.id]:
            warranted_cons = float(vessel.warranted_consumption)
            for day in range(20):
                period_date = (voyage.atd + timedelta(days=day)).date() if voyage.atd else date.today() - timedelta(days=20-day)
                me_cons = warranted_cons * random.uniform(0.93, 1.09)
                ae_cons = warranted_cons * 0.06 * random.uniform(0.9, 1.1)
                boiler_cons = warranted_cons * 0.02 * random.uniform(0.8, 1.2)
                total = me_cons + ae_cons + boiler_cons
                dist = float(vessel.warranted_speed or 14) * 24
                
                insights = [
                    f'Fuel consumption within normal range. Weather factor: {random.uniform(1.0, 1.12):.2f}',
                    f'Increased consumption due to Beaufort {random.randint(4, 6)} conditions.',
                    f'Optimal performance achieved. Running {random.uniform(1, 3):.1f}% below warranted.',
                    f'Minor deviation from plan. RPM optimization recommended.'
                ]
                
                fa = FuelAnalytic(
                    vessel_id=vessel.id,
                    voyage_id=voyage.id,
                    period_date=period_date,
                    period_type='daily',
                    total_consumption=round(total, 3),
                    me_consumption=round(me_cons, 3),
                    ae_consumption=round(ae_cons, 3),
                    boiler_consumption=round(boiler_cons, 3),
                    fuel_price_usd=620.0,
                    fuel_cost_usd=round(total * 620.0, 2),
                    distance_nm=round(dist, 2),
                    efficiency_nm_per_mt=round(dist / total, 4),
                    benchmark_efficiency=round(dist / (warranted_cons * 1.08), 4),
                    variance_pct=round((total - warranted_cons) / warranted_cons * 100, 2),
                    weather_impact_pct=round(random.uniform(0, 8), 2),
                    ai_insight=random.choice(insights)
                )
                db.session.add(fa)
    
    db.session.commit()
    print('Seed data generated successfully!')
