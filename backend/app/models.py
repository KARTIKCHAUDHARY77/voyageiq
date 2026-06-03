"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
"""
VoyageIQ AI - SQLAlchemy ORM Models
"""
import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


def generate_uuid():
    return str(uuid.uuid4())


class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    company_name = db.Column(db.String(255))
    role = db.Column(db.String(50), default='operator')
    avatar_url = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'company_name': self.company_name,
            'role': self.role,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Vessel(db.Model):
    __tablename__ = 'vessels'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    imo_number = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    vessel_type = db.Column(db.String(100), nullable=False)
    flag = db.Column(db.String(100))
    built_year = db.Column(db.Integer)
    gross_tonnage = db.Column(db.Numeric(12, 2))
    deadweight_tonnage = db.Column(db.Numeric(12, 2))
    loa = db.Column(db.Numeric(8, 2))
    beam = db.Column(db.Numeric(8, 2))
    draft_design = db.Column(db.Numeric(6, 2))
    main_engine_type = db.Column(db.String(255))
    main_engine_power = db.Column(db.Numeric(10, 2))
    design_speed = db.Column(db.Numeric(6, 2))
    warranted_speed = db.Column(db.Numeric(6, 2))
    warranted_consumption = db.Column(db.Numeric(8, 2))
    classification_society = db.Column(db.String(100))
    owner_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    status = db.Column(db.String(50), default='active')
    image_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    voyages = db.relationship('Voyage', backref='vessel', lazy='dynamic')
    noon_reports = db.relationship('NoonReport', backref='vessel', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'imo_number': self.imo_number,
            'name': self.name,
            'vessel_type': self.vessel_type,
            'flag': self.flag,
            'built_year': self.built_year,
            'gross_tonnage': float(self.gross_tonnage) if self.gross_tonnage else None,
            'deadweight_tonnage': float(self.deadweight_tonnage) if self.deadweight_tonnage else None,
            'loa': float(self.loa) if self.loa else None,
            'beam': float(self.beam) if self.beam else None,
            'draft_design': float(self.draft_design) if self.draft_design else None,
            'main_engine_type': self.main_engine_type,
            'main_engine_power': float(self.main_engine_power) if self.main_engine_power else None,
            'design_speed': float(self.design_speed) if self.design_speed else None,
            'warranted_speed': float(self.warranted_speed) if self.warranted_speed else None,
            'warranted_consumption': float(self.warranted_consumption) if self.warranted_consumption else None,
            'classification_society': self.classification_society,
            'status': self.status,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Voyage(db.Model):
    __tablename__ = 'voyages'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'), nullable=False)
    voyage_number = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='in_progress')
    departure_port = db.Column(db.String(255), nullable=False)
    arrival_port = db.Column(db.String(255), nullable=False)
    departure_lat = db.Column(db.Numeric(10, 8))
    departure_lon = db.Column(db.Numeric(11, 8))
    arrival_lat = db.Column(db.Numeric(10, 8))
    arrival_lon = db.Column(db.Numeric(11, 8))
    etd = db.Column(db.DateTime)
    eta = db.Column(db.DateTime)
    atd = db.Column(db.DateTime)
    ata = db.Column(db.DateTime)
    cargo_type = db.Column(db.String(255))
    cargo_quantity = db.Column(db.Numeric(12, 2))
    cargo_unit = db.Column(db.String(50))
    charterer = db.Column(db.String(255))
    charter_party_speed = db.Column(db.Numeric(6, 2))
    charter_party_consumption = db.Column(db.Numeric(8, 2))
    total_distance_nm = db.Column(db.Numeric(10, 2))
    sea_distance_nm = db.Column(db.Numeric(10, 2))
    total_fuel_consumed = db.Column(db.Numeric(10, 2))
    avg_speed = db.Column(db.Numeric(6, 2))
    performance_score = db.Column(db.Numeric(5, 2))
    health_score = db.Column(db.Numeric(5, 2))
    freight_rate = db.Column(db.Numeric(12, 2))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    noon_reports = db.relationship('NoonReport', backref='voyage', lazy='dynamic')
    claims = db.relationship('Claim', backref='voyage', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'vessel_id': self.vessel_id,
            'voyage_number': self.voyage_number,
            'status': self.status,
            'departure_port': self.departure_port,
            'arrival_port': self.arrival_port,
            'departure_lat': float(self.departure_lat) if self.departure_lat else None,
            'departure_lon': float(self.departure_lon) if self.departure_lon else None,
            'arrival_lat': float(self.arrival_lat) if self.arrival_lat else None,
            'arrival_lon': float(self.arrival_lon) if self.arrival_lon else None,
            'etd': self.etd.isoformat() if self.etd else None,
            'eta': self.eta.isoformat() if self.eta else None,
            'atd': self.atd.isoformat() if self.atd else None,
            'ata': self.ata.isoformat() if self.ata else None,
            'cargo_type': self.cargo_type,
            'cargo_quantity': float(self.cargo_quantity) if self.cargo_quantity else None,
            'cargo_unit': self.cargo_unit,
            'charterer': self.charterer,
            'charter_party_speed': float(self.charter_party_speed) if self.charter_party_speed else None,
            'charter_party_consumption': float(self.charter_party_consumption) if self.charter_party_consumption else None,
            'total_distance_nm': float(self.total_distance_nm) if self.total_distance_nm else None,
            'total_fuel_consumed': float(self.total_fuel_consumed) if self.total_fuel_consumed else None,
            'avg_speed': float(self.avg_speed) if self.avg_speed else None,
            'performance_score': float(self.performance_score) if self.performance_score else None,
            'health_score': float(self.health_score) if self.health_score else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class NoonReport(db.Model):
    __tablename__ = 'noon_reports'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'), nullable=False)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'), nullable=False)
    report_date = db.Column(db.Date, nullable=False)
    report_time = db.Column(db.Time, nullable=False)
    report_type = db.Column(db.String(50), default='noon')
    
    # Position
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    position_description = db.Column(db.String(255))
    
    # Navigation
    course = db.Column(db.Numeric(6, 2))
    speed_over_ground = db.Column(db.Numeric(6, 2))
    speed_through_water = db.Column(db.Numeric(6, 2))
    distance_noon_to_noon = db.Column(db.Numeric(8, 2))
    distance_to_go = db.Column(db.Numeric(10, 2))
    rpm = db.Column(db.Numeric(6, 2))
    slip_percentage = db.Column(db.Numeric(5, 2))
    me_power = db.Column(db.Numeric(10, 2))
    
    # Weather
    wind_force_bft = db.Column(db.Integer)
    wind_direction = db.Column(db.String(10))
    wind_speed_knots = db.Column(db.Numeric(6, 2))
    wave_height = db.Column(db.Numeric(5, 2))
    swell_height = db.Column(db.Numeric(5, 2))
    swell_direction = db.Column(db.String(10))
    current_speed = db.Column(db.Numeric(5, 2))
    current_direction = db.Column(db.String(10))
    visibility = db.Column(db.Integer)
    sea_state = db.Column(db.String(50))
    
    # Fuel Consumption (MT)
    me_lsfo = db.Column(db.Numeric(8, 3))
    me_mgo = db.Column(db.Numeric(8, 3))
    ae_lsfo = db.Column(db.Numeric(8, 3))
    ae_mgo = db.Column(db.Numeric(8, 3))
    boiler_lsfo = db.Column(db.Numeric(8, 3))
    boiler_mgo = db.Column(db.Numeric(8, 3))
    total_lsfo_consumption = db.Column(db.Numeric(8, 3))
    total_mgo_consumption = db.Column(db.Numeric(8, 3))
    total_fuel_consumption = db.Column(db.Numeric(8, 3))
    
    # ROB
    rob_lsfo = db.Column(db.Numeric(10, 3))
    rob_mgo = db.Column(db.Numeric(10, 3))
    rob_lube_oil = db.Column(db.Numeric(8, 3))
    fresh_water_produced = db.Column(db.Numeric(8, 2))
    fresh_water_consumed = db.Column(db.Numeric(8, 2))
    fresh_water_rob = db.Column(db.Numeric(8, 2))
    
    # Cargo
    cargo_quantity = db.Column(db.Numeric(12, 2))
    draft_fore = db.Column(db.Numeric(6, 2))
    draft_aft = db.Column(db.Numeric(6, 2))
    
    # Engine Parameters
    scavenge_pressure = db.Column(db.Numeric(6, 2))
    exhaust_temp_avg = db.Column(db.Numeric(6, 2))
    turbo_rpm = db.Column(db.Numeric(8, 2))
    
    # Calculated
    fuel_efficiency = db.Column(db.Numeric(8, 4))
    speed_variance = db.Column(db.Numeric(6, 2))
    consumption_variance = db.Column(db.Numeric(6, 2))
    weather_factor = db.Column(db.Numeric(5, 3))
    
    raw_data = db.Column(db.JSON)
    uploaded_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'voyage_id': self.voyage_id,
            'vessel_id': self.vessel_id,
            'report_date': self.report_date.isoformat() if self.report_date else None,
            'report_type': self.report_type,
            'latitude': float(self.latitude) if self.latitude else None,
            'longitude': float(self.longitude) if self.longitude else None,
            'speed_over_ground': float(self.speed_over_ground) if self.speed_over_ground else None,
            'distance_noon_to_noon': float(self.distance_noon_to_noon) if self.distance_noon_to_noon else None,
            'rpm': float(self.rpm) if self.rpm else None,
            'wind_force_bft': self.wind_force_bft,
            'wind_speed_knots': float(self.wind_speed_knots) if self.wind_speed_knots else None,
            'wave_height': float(self.wave_height) if self.wave_height else None,
            'total_fuel_consumption': float(self.total_fuel_consumption) if self.total_fuel_consumption else None,
            'me_lsfo': float(self.me_lsfo) if self.me_lsfo else None,
            'me_mgo': float(self.me_mgo) if self.me_mgo else None,
            'ae_mgo': float(self.ae_mgo) if self.ae_mgo else None,
            'boiler_lsfo': float(self.boiler_lsfo) if self.boiler_lsfo else None,
            'rob_lsfo': float(self.rob_lsfo) if self.rob_lsfo else None,
            'rob_mgo': float(self.rob_mgo) if self.rob_mgo else None,
            'fuel_efficiency': float(self.fuel_efficiency) if self.fuel_efficiency else None,
            'speed_variance': float(self.speed_variance) if self.speed_variance else None,
            'consumption_variance': float(self.consumption_variance) if self.consumption_variance else None,
            'weather_factor': float(self.weather_factor) if self.weather_factor else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Claim(db.Model):
    __tablename__ = 'claims'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'), nullable=False)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'), nullable=False)
    claim_type = db.Column(db.String(100), nullable=False)
    detected_date = db.Column(db.Date, nullable=False)
    period_start = db.Column(db.Date)
    period_end = db.Column(db.Date)
    severity = db.Column(db.String(20), default='medium')
    status = db.Column(db.String(50), default='open')
    expected_value = db.Column(db.Numeric(12, 4))
    actual_value = db.Column(db.Numeric(12, 4))
    variance = db.Column(db.Numeric(12, 4))
    unit = db.Column(db.String(50))
    estimated_impact_usd = db.Column(db.Numeric(14, 2))
    bunker_price_usd = db.Column(db.Numeric(10, 2))
    hire_rate_usd = db.Column(db.Numeric(12, 2))
    description = db.Column(db.Text)
    supporting_data = db.Column(db.JSON)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'voyage_id': self.voyage_id,
            'vessel_id': self.vessel_id,
            'claim_type': self.claim_type,
            'detected_date': self.detected_date.isoformat() if self.detected_date else None,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'severity': self.severity,
            'status': self.status,
            'expected_value': float(self.expected_value) if self.expected_value else None,
            'actual_value': float(self.actual_value) if self.actual_value else None,
            'variance': float(self.variance) if self.variance else None,
            'unit': self.unit,
            'estimated_impact_usd': float(self.estimated_impact_usd) if self.estimated_impact_usd else None,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FuelAnalytic(db.Model):
    __tablename__ = 'fuel_analytics'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'), nullable=False)
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'))
    period_date = db.Column(db.Date, nullable=False)
    period_type = db.Column(db.String(20), default='daily')
    total_consumption = db.Column(db.Numeric(10, 3))
    me_consumption = db.Column(db.Numeric(10, 3))
    ae_consumption = db.Column(db.Numeric(10, 3))
    boiler_consumption = db.Column(db.Numeric(10, 3))
    fuel_price_usd = db.Column(db.Numeric(10, 2))
    fuel_cost_usd = db.Column(db.Numeric(14, 2))
    distance_nm = db.Column(db.Numeric(10, 2))
    efficiency_nm_per_mt = db.Column(db.Numeric(8, 4))
    benchmark_efficiency = db.Column(db.Numeric(8, 4))
    variance_pct = db.Column(db.Numeric(6, 2))
    weather_impact_pct = db.Column(db.Numeric(6, 2))
    ai_insight = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'vessel_id': self.vessel_id,
            'voyage_id': self.voyage_id,
            'period_date': self.period_date.isoformat() if self.period_date else None,
            'period_type': self.period_type,
            'total_consumption': float(self.total_consumption) if self.total_consumption else None,
            'me_consumption': float(self.me_consumption) if self.me_consumption else None,
            'ae_consumption': float(self.ae_consumption) if self.ae_consumption else None,
            'boiler_consumption': float(self.boiler_consumption) if self.boiler_consumption else None,
            'fuel_cost_usd': float(self.fuel_cost_usd) if self.fuel_cost_usd else None,
            'distance_nm': float(self.distance_nm) if self.distance_nm else None,
            'efficiency_nm_per_mt': float(self.efficiency_nm_per_mt) if self.efficiency_nm_per_mt else None,
            'variance_pct': float(self.variance_pct) if self.variance_pct else None,
            'weather_impact_pct': float(self.weather_impact_pct) if self.weather_impact_pct else None,
            'ai_insight': self.ai_insight
        }


class VesselPosition(db.Model):
    __tablename__ = 'vessel_positions'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'), nullable=False)
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'))
    timestamp = db.Column(db.DateTime, nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    speed = db.Column(db.Numeric(6, 2))
    course = db.Column(db.Numeric(6, 2))
    source = db.Column(db.String(50), default='noon_report')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'vessel_id': self.vessel_id,
            'voyage_id': self.voyage_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'latitude': float(self.latitude) if self.latitude else None,
            'longitude': float(self.longitude) if self.longitude else None,
            'speed': float(self.speed) if self.speed else None,
            'course': float(self.course) if self.course else None
        }


class Route(db.Model):
    __tablename__ = 'routes'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'))
    origin_port = db.Column(db.String(255), nullable=False)
    destination_port = db.Column(db.String(255), nullable=False)
    route_type = db.Column(db.String(50), default='optimal')
    waypoints = db.Column(db.JSON, nullable=False)
    total_distance_nm = db.Column(db.Numeric(10, 2))
    estimated_duration_hrs = db.Column(db.Numeric(10, 2))
    estimated_fuel_mt = db.Column(db.Numeric(10, 2))
    estimated_cost_usd = db.Column(db.Numeric(14, 2))
    weather_risk_score = db.Column(db.Numeric(5, 2))
    risk_zones = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'origin_port': self.origin_port,
            'destination_port': self.destination_port,
            'route_type': self.route_type,
            'waypoints': self.waypoints,
            'total_distance_nm': float(self.total_distance_nm) if self.total_distance_nm else None,
            'estimated_duration_hrs': float(self.estimated_duration_hrs) if self.estimated_duration_hrs else None,
            'estimated_fuel_mt': float(self.estimated_fuel_mt) if self.estimated_fuel_mt else None,
            'estimated_cost_usd': float(self.estimated_cost_usd) if self.estimated_cost_usd else None,
            'weather_risk_score': float(self.weather_risk_score) if self.weather_risk_score else None,
            'risk_zones': self.risk_zones,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CopilotConversation(db.Model):
    __tablename__ = 'copilot_conversations'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'))
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('CopilotMessage', backref='conversation', lazy='dynamic', order_by='CopilotMessage.created_at')


class CopilotMessage(db.Model):
    __tablename__ = 'copilot_messages'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    conversation_id = db.Column(db.String(36), db.ForeignKey('copilot_conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    metadata = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ReportUpload(db.Model):
    __tablename__ = 'report_uploads'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    vessel_id = db.Column(db.String(36), db.ForeignKey('vessels.id'))
    voyage_id = db.Column(db.String(36), db.ForeignKey('voyages.id'))
    uploaded_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    file_name = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50))
    file_url = db.Column(db.Text)
    parse_status = db.Column(db.String(50), default='pending')
    parsed_records = db.Column(db.Integer, default=0)
    errors = db.Column(db.JSON)
    raw_parsed_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_name': self.file_name,
            'file_type': self.file_type,
            'parse_status': self.parse_status,
            'parsed_records': self.parsed_records,
            'errors': self.errors,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
