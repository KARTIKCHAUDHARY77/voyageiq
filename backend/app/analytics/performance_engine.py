"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ - Performance Calculation Engine
Vessel performance analysis, compliance scoring, and claim detection logic
"""
import math
from typing import List, Optional
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class PerformanceResult:
    """Performance analysis result for a period."""
    speed_variance: float          # Actual - Warranted (negative = underperformance)
    consumption_variance: float    # Actual - Warranted (positive = excess)
    fuel_efficiency: float         # Distance / Fuel (nm/MT)
    performance_compliance: float  # % compliance with charter party
    weather_adjusted_speed: float  # Speed adjusted for weather conditions
    days_analyzed: int
    is_underperforming: bool
    underperformance_reason: str


def calculate_performance(
    actual_speeds: List[float],
    actual_consumptions: List[float],
    distances: List[float],
    beaufort_scales: List[int],
    warranted_speed: float,
    warranted_consumption: float,
    charter_party_speed: Optional[float] = None
) -> PerformanceResult:
    """
    Calculate comprehensive vessel performance metrics.
    
    Args:
        actual_speeds: List of daily speeds (knots)
        actual_consumptions: List of daily fuel consumptions (MT)
        distances: List of daily distances (nm)
        beaufort_scales: List of Beaufort scale readings
        warranted_speed: Charter party warranted speed (knots)
        warranted_consumption: Charter party warranted consumption (MT/day)
        charter_party_speed: Optional explicit CP speed
    
    Returns:
        PerformanceResult with all metrics
    """
    if not actual_speeds:
        return PerformanceResult(0, 0, 0, 100, warranted_speed, 0, False, "No data")
    
    cp_speed = charter_party_speed or warranted_speed
    
    # Filter good weather days (Beaufort <= 4) for fair comparison
    good_weather_mask = [bft <= 4 for bft in beaufort_scales]
    
    avg_speed = sum(actual_speeds) / len(actual_speeds)
    avg_consumption = sum(actual_consumptions) / len(actual_consumptions)
    total_distance = sum(distances)
    total_fuel = sum(actual_consumptions)
    
    # Good weather performance
    gw_speeds = [s for s, gw in zip(actual_speeds, good_weather_mask) if gw]
    gw_consumptions = [c for c, gw in zip(actual_consumptions, good_weather_mask) if gw]
    
    speed_variance = avg_speed - cp_speed
    consumption_variance = avg_consumption - warranted_consumption
    
    # Fuel efficiency (nm per MT)
    fuel_efficiency = total_distance / total_fuel if total_fuel > 0 else 0
    
    # Performance compliance %
    # Based on how close actual speed is to warranted (in good weather)
    if gw_speeds:
        gw_avg_speed = sum(gw_speeds) / len(gw_speeds)
        speed_compliance = min(100, (gw_avg_speed / cp_speed) * 100)
    else:
        speed_compliance = min(100, (avg_speed / cp_speed) * 100)
    
    # Consumption compliance
    if gw_consumptions:
        gw_avg_cons = sum(gw_consumptions) / len(gw_consumptions)
        cons_compliance = min(100, (warranted_consumption / gw_avg_cons) * 100) if gw_avg_cons > 0 else 100
    else:
        cons_compliance = min(100, (warranted_consumption / avg_consumption) * 100) if avg_consumption > 0 else 100
    
    performance_compliance = (speed_compliance * 0.6 + cons_compliance * 0.4)
    
    # Weather-adjusted speed
    avg_bft = sum(beaufort_scales) / len(beaufort_scales)
    weather_penalty = max(0, (avg_bft - 2) * 0.02) if avg_bft > 2 else 0
    weather_adjusted_speed = avg_speed / (1 - weather_penalty)
    
    # Determine if underperforming (in good weather conditions)
    is_underperforming = False
    reason = "Performance within acceptable range"
    
    if gw_speeds and (sum(gw_speeds) / len(gw_speeds)) < (cp_speed - 0.3):
        is_underperforming = True
        deficit = cp_speed - (sum(gw_speeds) / len(gw_speeds))
        reason = f"Speed {deficit:.2f} knots below charter party speed in good weather"
    elif gw_consumptions and (sum(gw_consumptions) / len(gw_consumptions)) > (warranted_consumption * 1.05):
        is_underperforming = True
        excess_pct = ((sum(gw_consumptions) / len(gw_consumptions)) - warranted_consumption) / warranted_consumption * 100
        reason = f"Fuel consumption {excess_pct:.1f}% above warranted in good weather"
    
    return PerformanceResult(
        speed_variance=round(speed_variance, 3),
        consumption_variance=round(consumption_variance, 3),
        fuel_efficiency=round(fuel_efficiency, 4),
        performance_compliance=round(performance_compliance, 2),
        weather_adjusted_speed=round(weather_adjusted_speed, 3),
        days_analyzed=len(actual_speeds),
        is_underperforming=is_underperforming,
        underperformance_reason=reason
    )


def calculate_health_score(
    fuel_efficiency_actual: float,
    fuel_efficiency_benchmark: float,
    speed_compliance: float,
    avg_beaufort: float,
    operational_score: float = 85
) -> dict:
    """
    Calculate AI Vessel Health Score (0-100).
    
    Components:
        - Fuel Efficiency (25%): actual vs benchmark efficiency
        - Speed Compliance (25%): speed vs charter party
        - Weather Handling (25%): performance during adverse weather
        - Operational (25%): overall operational indicators
    
    Returns:
        dict with total_score, grade, breakdown, recommendations
    """
    # Fuel efficiency score (0-25)
    if fuel_efficiency_benchmark > 0:
        eff_ratio = fuel_efficiency_actual / fuel_efficiency_benchmark
        fuel_score = min(25, max(0, eff_ratio * 22))
    else:
        fuel_score = 18.0
    
    # Speed compliance score (0-25)
    speed_score = min(25, max(0, (speed_compliance / 100) * 25))
    
    # Weather handling score (0-25) - higher beaufort tolerance = better score
    # Good if maintaining performance in Bft 4-5
    if avg_beaufort <= 3:
        weather_score = 22  # Easy conditions, limited data
    elif avg_beaufort <= 5:
        # In moderate weather, score based on speed compliance
        weather_score = min(25, speed_compliance * 0.22)
    else:
        # In rough weather, bonus for maintaining performance
        weather_score = min(25, speed_compliance * 0.20 + 3)
    
    # Operational score (0-25)
    op_score = min(25, max(0, (operational_score / 100) * 25))
    
    total = fuel_score + speed_score + weather_score + op_score
    total = round(min(100, max(0, total)), 1)
    
    # Grade
    if total >= 90:
        grade = 'Excellent'
        grade_color = 'green'
    elif total >= 70:
        grade = 'Good'
        grade_color = 'teal'
    elif total >= 50:
        grade = 'Average'
        grade_color = 'yellow'
    else:
        grade = 'Poor'
        grade_color = 'red'
    
    # Generate recommendations based on weakest areas
    recommendations = []
    scores = {
        'fuel_efficiency': fuel_score / 25,
        'speed_compliance': speed_score / 25,
        'weather_handling': weather_score / 25,
        'operational': op_score / 25
    }
    
    recs_map = {
        'fuel_efficiency': [
            "Optimize trim to reduce resistance and improve fuel efficiency by 2-3%",
            "Review main engine performance curves and consider RPM optimization",
            "Implement voyage-specific slow steaming to improve fuel efficiency",
            "Schedule hull and propeller cleaning to recover 4-6% efficiency"
        ],
        'speed_compliance': [
            "Review RPM settings to align actual speed with charter party speed",
            "Monitor hull fouling — speed loss may indicate cleaning is required",
            "Check main engine power output against design curves",
            "Evaluate weather routing to minimize speed loss from adverse conditions"
        ],
        'weather_handling': [
            "Implement proactive weather routing to avoid high Beaufort conditions",
            "Consider speed reduction strategy during adverse weather to save fuel",
            "Optimize ballast condition for better seakeeping in rough weather",
            "Review heavy weather procedures and captain's standing orders"
        ],
        'operational': [
            "Conduct engine room efficiency audit and optimize auxiliary systems",
            "Review cargo loading plans to optimize trim for minimum resistance",
            "Implement planned maintenance to ensure engine optimal performance",
            "Analyze idle time periods and optimize port stay efficiency"
        ]
    }
    
    # Sort by worst scores
    sorted_areas = sorted(scores.items(), key=lambda x: x[1])
    for area, score_ratio in sorted_areas[:3]:
        recs = recs_map.get(area, [])
        if recs:
            rec_idx = int((1 - score_ratio) * (len(recs) - 1))
            recommendations.append(recs[rec_idx])
    
    return {
        'total_score': total,
        'grade': grade,
        'grade_color': grade_color,
        'breakdown': {
            'fuel_efficiency': round(fuel_score, 2),
            'speed_compliance': round(speed_score, 2),
            'weather_handling': round(weather_score, 2),
            'operational': round(op_score, 2)
        },
        'recommendations': recommendations
    }


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance in nautical miles."""
    R = 3440.065  # Earth radius in nautical miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def beaufort_from_wind_speed(wind_speed_knots: float) -> int:
    """Convert wind speed (knots) to Beaufort scale."""
    thresholds = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63]
    for i, threshold in enumerate(thresholds):
        if wind_speed_knots < threshold:
            return i
    return 12
