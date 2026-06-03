-- ===========================================
-- VoyageIQ AI - Database Schema
-- Maritime Intelligence Platform
-- ===========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- USERS & AUTH
-- ===========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'analyst', 'master', 'charterer')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- VESSELS
-- ===========================================
CREATE TABLE vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    imo_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    vessel_type VARCHAR(100) NOT NULL,  -- Bulker, Tanker, Container, LNG, etc.
    flag VARCHAR(100),
    built_year INTEGER,
    gross_tonnage DECIMAL(12,2),
    deadweight_tonnage DECIMAL(12,2),
    loa DECIMAL(8,2),  -- Length Overall (m)
    beam DECIMAL(8,2),
    draft_design DECIMAL(6,2),
    main_engine_type VARCHAR(255),
    main_engine_power DECIMAL(10,2),  -- kW
    design_speed DECIMAL(6,2),        -- knots
    warranted_speed DECIMAL(6,2),     -- knots
    warranted_consumption DECIMAL(8,2), -- MT/day
    classification_society VARCHAR(100),
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'dry_dock', 'laid_up', 'scrapped')),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- VOYAGES
-- ===========================================
CREATE TABLE voyages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    voyage_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    departure_port VARCHAR(255) NOT NULL,
    arrival_port VARCHAR(255) NOT NULL,
    departure_lat DECIMAL(10,8),
    departure_lon DECIMAL(11,8),
    arrival_lat DECIMAL(10,8),
    arrival_lon DECIMAL(11,8),
    etd TIMESTAMP,
    eta TIMESTAMP,
    atd TIMESTAMP,  -- Actual Time of Departure
    ata TIMESTAMP,  -- Actual Time of Arrival
    cargo_type VARCHAR(255),
    cargo_quantity DECIMAL(12,2),
    cargo_unit VARCHAR(50),
    charterer VARCHAR(255),
    charter_party_speed DECIMAL(6,2),
    charter_party_consumption DECIMAL(8,2),
    total_distance_nm DECIMAL(10,2),
    sea_distance_nm DECIMAL(10,2),
    total_fuel_consumed DECIMAL(10,2),
    avg_speed DECIMAL(6,2),
    performance_score DECIMAL(5,2),
    health_score DECIMAL(5,2),
    freight_rate DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- NOON REPORTS (Core performance data)
-- ===========================================
CREATE TABLE noon_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES vessels(id),
    report_date DATE NOT NULL,
    report_time TIME NOT NULL,
    report_type VARCHAR(50) DEFAULT 'noon' CHECK (report_type IN ('noon', 'cosp', 'eosp', 'arrival', 'departure', 'noon_port')),
    
    -- Position
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    position_description VARCHAR(255),
    
    -- Navigation
    course DECIMAL(6,2),
    speed_over_ground DECIMAL(6,2),
    speed_through_water DECIMAL(6,2),
    distance_noon_to_noon DECIMAL(8,2),
    distance_to_go DECIMAL(10,2),
    rpm DECIMAL(6,2),
    slip_percentage DECIMAL(5,2),
    me_power DECIMAL(10,2),  -- kW
    
    -- Weather
    wind_force_bft INTEGER,  -- Beaufort scale
    wind_direction VARCHAR(10),
    wind_speed_knots DECIMAL(6,2),
    wave_height DECIMAL(5,2),  -- meters
    swell_height DECIMAL(5,2),
    swell_direction VARCHAR(10),
    current_speed DECIMAL(5,2),
    current_direction VARCHAR(10),
    visibility INTEGER,  -- nautical miles
    sea_state VARCHAR(50),
    
    -- Fuel Consumption (MT)
    me_lsfo DECIMAL(8,3),
    me_mgo DECIMAL(8,3),
    ae_lsfo DECIMAL(8,3),
    ae_mgo DECIMAL(8,3),
    boiler_lsfo DECIMAL(8,3),
    boiler_mgo DECIMAL(8,3),
    total_lsfo_consumption DECIMAL(8,3),
    total_mgo_consumption DECIMAL(8,3),
    total_fuel_consumption DECIMAL(8,3),
    
    -- ROB (Remaining on Board) MT
    rob_lsfo DECIMAL(10,3),
    rob_mgo DECIMAL(10,3),
    rob_lube_oil DECIMAL(8,3),
    fresh_water_produced DECIMAL(8,2),
    fresh_water_consumed DECIMAL(8,2),
    fresh_water_rob DECIMAL(8,2),
    
    -- Cargo
    cargo_quantity DECIMAL(12,2),
    draft_fore DECIMAL(6,2),
    draft_aft DECIMAL(6,2),
    
    -- Engine Parameters
    scavenge_pressure DECIMAL(6,2),
    exhaust_temp_avg DECIMAL(6,2),
    turbo_rpm DECIMAL(8,2),
    
    -- Calculated Performance
    fuel_efficiency DECIMAL(8,4),  -- nm/MT
    speed_variance DECIMAL(6,2),
    consumption_variance DECIMAL(6,2),
    weather_factor DECIMAL(5,3),
    
    raw_data JSONB,  -- original parsed data
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- VESSEL POSITIONS (Track)
-- ===========================================
CREATE TABLE vessel_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID NOT NULL REFERENCES vessels(id),
    voyage_id UUID REFERENCES voyages(id),
    timestamp TIMESTAMP NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    speed DECIMAL(6,2),
    course DECIMAL(6,2),
    source VARCHAR(50) DEFAULT 'noon_report',  -- ais, noon_report, manual
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- CLAIMS
-- ===========================================
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voyage_id UUID NOT NULL REFERENCES voyages(id),
    vessel_id UUID NOT NULL REFERENCES vessels(id),
    claim_type VARCHAR(100) NOT NULL,  -- underperformance, speed_loss, excess_consumption, off_hire
    detected_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'disputed', 'resolved', 'closed')),
    
    -- Performance data
    expected_value DECIMAL(12,4),
    actual_value DECIMAL(12,4),
    variance DECIMAL(12,4),
    unit VARCHAR(50),
    
    -- Financial impact
    estimated_impact_usd DECIMAL(14,2),
    bunker_price_usd DECIMAL(10,2),
    hire_rate_usd DECIMAL(12,2),
    
    description TEXT,
    supporting_data JSONB,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- WEATHER DATA
-- ===========================================
CREATE TABLE weather_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(50) DEFAULT 'open_meteo',
    wind_speed_kmh DECIMAL(8,2),
    wind_direction DECIMAL(6,2),
    wave_height_m DECIMAL(6,2),
    swell_height_m DECIMAL(6,2),
    current_speed_ms DECIMAL(6,2),
    current_direction DECIMAL(6,2),
    visibility_km DECIMAL(8,2),
    pressure_hpa DECIMAL(8,2),
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'moderate', 'high', 'extreme')),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- ROUTES (Optimization)
-- ===========================================
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voyage_id UUID REFERENCES voyages(id),
    origin_port VARCHAR(255) NOT NULL,
    destination_port VARCHAR(255) NOT NULL,
    route_type VARCHAR(50) DEFAULT 'optimal' CHECK (route_type IN ('optimal', 'fastest', 'eco', 'safest')),
    waypoints JSONB NOT NULL,  -- [{lat, lon, port_name, eta}]
    total_distance_nm DECIMAL(10,2),
    estimated_duration_hrs DECIMAL(10,2),
    estimated_fuel_mt DECIMAL(10,2),
    estimated_cost_usd DECIMAL(14,2),
    weather_risk_score DECIMAL(5,2),
    risk_zones JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- FUEL ANALYTICS
-- ===========================================
CREATE TABLE fuel_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID NOT NULL REFERENCES vessels(id),
    voyage_id UUID REFERENCES voyages(id),
    period_date DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'daily' CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly', 'voyage')),
    total_consumption DECIMAL(10,3),
    me_consumption DECIMAL(10,3),
    ae_consumption DECIMAL(10,3),
    boiler_consumption DECIMAL(10,3),
    fuel_price_usd DECIMAL(10,2),
    fuel_cost_usd DECIMAL(14,2),
    distance_nm DECIMAL(10,2),
    efficiency_nm_per_mt DECIMAL(8,4),
    benchmark_efficiency DECIMAL(8,4),
    variance_pct DECIMAL(6,2),
    weather_impact_pct DECIMAL(6,2),
    ai_insight TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- AI COPILOT CONVERSATIONS
-- ===========================================
CREATE TABLE copilot_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    vessel_id UUID REFERENCES vessels(id),
    voyage_id UUID REFERENCES voyages(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE copilot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- REPORT UPLOADS
-- ===========================================
CREATE TABLE report_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID REFERENCES vessels(id),
    voyage_id UUID REFERENCES voyages(id),
    uploaded_by UUID REFERENCES users(id),
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),  -- pdf, excel, csv
    file_url TEXT,
    parse_status VARCHAR(50) DEFAULT 'pending' CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed')),
    parsed_records INTEGER DEFAULT 0,
    errors JSONB,
    raw_parsed_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- ML MODEL PREDICTIONS
-- ===========================================
CREATE TABLE fuel_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID NOT NULL REFERENCES vessels(id),
    voyage_id UUID REFERENCES voyages(id),
    prediction_date TIMESTAMP DEFAULT NOW(),
    speed_knots DECIMAL(6,2),
    rpm DECIMAL(6,2),
    wind_speed DECIMAL(6,2),
    wave_height DECIMAL(5,2),
    current_speed DECIMAL(5,2),
    distance_nm DECIMAL(10,2),
    predicted_fuel_mt DECIMAL(10,3),
    actual_fuel_mt DECIMAL(10,3),
    deviation_pct DECIMAL(6,2),
    model_version VARCHAR(50),
    confidence_score DECIMAL(5,3),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_noon_reports_voyage ON noon_reports(voyage_id);
CREATE INDEX idx_noon_reports_vessel ON noon_reports(vessel_id);
CREATE INDEX idx_noon_reports_date ON noon_reports(report_date);
CREATE INDEX idx_vessel_positions_vessel ON vessel_positions(vessel_id);
CREATE INDEX idx_vessel_positions_timestamp ON vessel_positions(timestamp);
CREATE INDEX idx_claims_voyage ON claims(voyage_id);
CREATE INDEX idx_claims_severity ON claims(severity);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_fuel_analytics_vessel ON fuel_analytics(vessel_id);
CREATE INDEX idx_fuel_analytics_date ON fuel_analytics(period_date);
CREATE INDEX idx_voyages_vessel ON voyages(vessel_id);
CREATE INDEX idx_voyages_status ON voyages(status);

-- ===========================================
-- SEED DATA - Demo Users
-- ===========================================
INSERT INTO users (email, password_hash, full_name, company_name, role) VALUES
('admin@voyageiq.com', crypt('password123', gen_salt('bf')), 'Admin User', 'VoyageIQ Demo', 'admin'),
('captain@oceancargo.com', crypt('password123', gen_salt('bf')), 'Capt. James Harbor', 'Ocean Cargo Lines', 'master'),
('analyst@oceancargo.com', crypt('password123', gen_salt('bf')), 'Sarah Chen', 'Ocean Cargo Lines', 'analyst');

-- ===========================================
-- SEED DATA - Demo Vessels
-- ===========================================
INSERT INTO vessels (imo_number, name, vessel_type, flag, built_year, gross_tonnage, deadweight_tonnage, loa, beam, draft_design, main_engine_type, main_engine_power, design_speed, warranted_speed, warranted_consumption, classification_society, status) VALUES
('IMO9876543', 'MV Pacific Star', 'Bulk Carrier', 'Panama', 2018, 43500, 81000, 229.0, 32.26, 14.5, 'MAN B&W 6S60ME-C', 11060, 14.5, 14.0, 28.5, 'DNV GL', 'active'),
('IMO9234567', 'MV Atlantic Pioneer', 'Container Ship', 'Marshall Islands', 2019, 95000, 115000, 300.0, 48.2, 14.5, 'MAN B&W 12G95ME-C', 68640, 22.0, 21.0, 185.0, 'Lloyd''s Register', 'active'),
('IMO9345678', 'MT Ocean Titan', 'VLCC Tanker', 'Liberia', 2020, 162000, 320000, 333.0, 60.0, 21.0, 'MAN B&W 7G80ME-C', 27160, 16.0, 15.5, 82.0, 'ABS', 'active'),
('IMO9456789', 'MV Arctic Breeze', 'LNG Carrier', 'Singapore', 2021, 98000, 82000, 295.0, 46.4, 11.5, 'WinGD 5X72DF', 12400, 19.5, 19.0, 130.0, 'Bureau Veritas', 'dry_dock');
