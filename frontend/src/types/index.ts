export interface User {
  id: string
  email: string
  full_name: string
  company_name?: string
  role: 'admin' | 'operator' | 'analyst' | 'master' | 'charterer'
  avatar_url?: string
  created_at: string
}

export interface Vessel {
  id: string
  imo_number: string
  name: string
  vessel_type: string
  flag: string
  built_year: number
  gross_tonnage: number
  deadweight_tonnage: number
  loa: number
  beam: number
  draft_design: number
  main_engine_type: string
  main_engine_power: number
  design_speed: number
  warranted_speed: number
  warranted_consumption: number
  classification_society: string
  status: 'active' | 'dry_dock' | 'laid_up' | 'scrapped'
  image_url?: string
  created_at: string
}

export interface Voyage {
  id: string
  vessel_id: string
  voyage_number: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  departure_port: string
  arrival_port: string
  departure_lat?: number
  departure_lon?: number
  arrival_lat?: number
  arrival_lon?: number
  etd?: string
  eta?: string
  atd?: string
  ata?: string
  cargo_type?: string
  cargo_quantity?: number
  cargo_unit?: string
  charterer?: string
  charter_party_speed?: number
  charter_party_consumption?: number
  total_distance_nm?: number
  total_fuel_consumed?: number
  avg_speed?: number
  performance_score?: number
  health_score?: number
  vessel_name?: string
  created_at: string
}

export interface NoonReport {
  id: string
  voyage_id: string
  vessel_id: string
  report_date: string
  report_type: string
  latitude: number
  longitude: number
  speed_over_ground?: number
  distance_noon_to_noon?: number
  rpm?: number
  wind_force_bft?: number
  wind_speed_knots?: number
  wave_height?: number
  total_fuel_consumption?: number
  me_lsfo?: number
  me_mgo?: number
  ae_mgo?: number
  boiler_lsfo?: number
  rob_lsfo?: number
  rob_mgo?: number
  fuel_efficiency?: number
  speed_variance?: number
  consumption_variance?: number
  weather_factor?: number
  created_at: string
}

export interface Claim {
  id: string
  voyage_id: string
  vessel_id: string
  claim_type: string
  detected_date: string
  period_start?: string
  period_end?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'disputed' | 'resolved' | 'closed'
  expected_value?: number
  actual_value?: number
  variance?: number
  unit?: string
  estimated_impact_usd?: number
  description?: string
  created_at: string
}

export interface DashboardKPIs {
  total_distance_nm: number
  avg_speed: number
  total_fuel_consumed: number
  weather_risk_score: number
  fuel_efficiency: number
  idle_days: number
  performance_score: number
  estimated_savings_usd: number
  active_vessels: number
  active_voyages: number
  open_claims: number
  fleet_health_score: number
}

export interface VesselHealth {
  total_score: number
  grade: string
  grade_color: string
  breakdown: {
    fuel_efficiency: number
    speed_compliance: number
    weather_handling: number
    operational: number
  }
  recommendations: string[]
}

export interface FuelData {
  daily_consumption: Array<{
    date: string
    total: number
    me: number
    ae: number
    boiler: number
  }>
  monthly_trend: Array<{ month: string; consumption: number }>
  avg_efficiency: number
  total_cost_usd: number
  insights: string[]
}

export interface RouteResult {
  id: string
  route_type: string
  color_code: string
  waypoints: Array<{ lat: number; lon: number; name?: string; eta?: string }>
  total_distance_nm: number
  estimated_duration_hrs: number
  estimated_fuel_mt: number
  estimated_cost_usd: number
  weather_risk_score: number
  risk_zones?: Array<{ center: [number, number]; radius: number; level: string; color: string }>
}

export interface Port {
  name: string
  code: string
  country: string
  region: string
  lat: number
  lon: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    recommendations?: string[]
    warnings?: string[]
    ai_used?: boolean
    model?: string
  }
  created_at: string
}

export interface PerformanceMetrics {
  avg_speed: number
  avg_consumption: number
  speed_variance: number
  consumption_variance: number
  fuel_efficiency: number
  performance_compliance: number
  days_analyzed: number
  is_underperforming: boolean
  underperformance_reason: string
  speed_trend: Array<{ date: string; speed: number; warranted: number }>
  consumption_trend: Array<{ date: string; actual: number; warranted: number }>
}
