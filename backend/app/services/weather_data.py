"""
Turning weather-provider responses into values we can stand behind.

Rules this module enforces:
  * A value the provider did not give us is None. It is never 0, never a default.
    (0 m waves, 0 kn wind and "no current" are real, favourable readings; treating a
    missing reading as one of them presents a failed request as good weather.)
  * "Current" means the hour nearest to now. A reading further than MAX_GAP_HOURS from
    now is reported as stale and is not used to assess risk.
  * Every result says how complete it is: available / partial / stale / unavailable.
"""
from dataclasses import dataclass
from datetime import datetime

PROVIDER = "Open-Meteo"
MAX_GAP_HOURS = 3.0
KNOTS_PER_KMH = 0.539957

AVAILABLE, PARTIAL, STALE, UNAVAILABLE = "available", "partial", "stale", "unavailable"

# Upper bound (km/h, inclusive) of each Beaufort force 0..11. Above the last is force 12 (WMO).
_BEAUFORT_KMH = (1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117)


def beaufort_from_kmh(kmh):
    """Beaufort force 0-12 for a wind speed in km/h; None if the speed is unknown."""
    if kmh is None:
        return None
    for force, upper in enumerate(_BEAUFORT_KMH):
        if kmh <= upper:
            return force
    return 12


def kmh_to_knots(kmh):
    return None if kmh is None else round(kmh * KNOTS_PER_KMH, 2)


def risk_level(force):
    if force is None:
        return None
    if force <= 3:
        return "LOW"
    if force <= 5:
        return "MODERATE"
    if force <= 7:
        return "HIGH"
    return "EXTREME"


@dataclass(frozen=True)
class Reading:
    """One measured value, where it came from and how fresh it is."""
    value: object = None
    time: str = None          # provider timestamp (UTC, ISO)
    status: str = UNAVAILABLE

    @property
    def usable(self):
        return self.status == AVAILABLE and self.value is not None


def _parse(stamp):
    return datetime.strptime(stamp[:16], "%Y-%m-%dT%H:%M")


def _classify(value, stamp, now):
    if value is None or not stamp:
        return Reading()
    try:
        gap_hours = abs((_parse(stamp) - now).total_seconds()) / 3600
    except (ValueError, TypeError):
        return Reading()
    return Reading(value, stamp, AVAILABLE if gap_hours <= MAX_GAP_HOURS else STALE)


def hourly_reading(payload, key, now):
    """The value for the hour nearest `now`, skipping hours the provider left empty."""
    try:
        times, values = payload["hourly"]["time"], payload["hourly"][key]
    except (KeyError, TypeError):
        return Reading()
    best = None
    for stamp, value in zip(times, values):
        if value is None:
            continue
        try:
            gap = abs((_parse(stamp) - now).total_seconds())
        except (ValueError, TypeError):
            continue
        if best is None or gap < best[0]:
            best = (gap, value, stamp)
    return Reading() if best is None else _classify(best[1], best[2], now)


def current_reading(payload, key, now):
    """The provider's own 'current' value if it has one, else the nearest hourly value."""
    try:
        block = payload["current"]
        if block.get(key) is not None:
            return _classify(block[key], block.get("time"), now)
    except (KeyError, TypeError, AttributeError):
        pass
    return hourly_reading(payload, key, now)


def _source_status(readings):
    states = [r.status for r in readings]
    if all(s == UNAVAILABLE for s in states):
        return UNAVAILABLE
    if any(s == UNAVAILABLE for s in states):
        return PARTIAL
    if any(s == STALE for s in states):
        return STALE
    return AVAILABLE


def overall_status(atmosphere, marine):
    if atmosphere == UNAVAILABLE and marine == UNAVAILABLE:
        return UNAVAILABLE
    if AVAILABLE == atmosphere == marine:
        return AVAILABLE
    if STALE in (atmosphere, marine) and UNAVAILABLE not in (atmosphere, marine) and PARTIAL not in (atmosphere, marine):
        return STALE
    return PARTIAL


def summarize(atmo, marine, now):
    """Current conditions at a position. Unknown values are None; `data_status` says why."""
    wind = current_reading(atmo, "wind_speed_10m", now)
    direction = current_reading(atmo, "wind_direction_10m", now)
    rain = current_reading(atmo, "precipitation", now)
    wave = hourly_reading(marine, "wave_height", now)
    swell = hourly_reading(marine, "swell_wave_height", now)
    stream = hourly_reading(marine, "ocean_current_velocity", now)

    atmosphere_status = _source_status([wind, direction, rain])
    marine_status = _source_status([wave, swell, stream])

    kmh = wind.value if wind.usable else None
    force = beaufort_from_kmh(kmh)

    def used(reading):
        return reading.value if reading.usable else None

    return {
        "wind_speed_kmh": None if kmh is None else round(kmh, 1),
        "wind_speed_knots": kmh_to_knots(kmh),
        "wind_direction_deg": used(direction),
        "precipitation_mm": None if used(rain) is None else round(used(rain), 2),
        "wave_height_m": None if used(wave) is None else round(used(wave), 2),
        "swell_height_m": None if used(swell) is None else round(used(swell), 2),
        "ocean_current_velocity_ms": None if used(stream) is None else round(used(stream), 2),
        "beaufort_scale": force,
        "risk_level": risk_level(force),
        "data_status": {
            "overall": overall_status(atmosphere_status, marine_status),
            "atmosphere": atmosphere_status,
            "marine": marine_status,
        },
        "observed_at": {
            "wind": wind.time, "waves": wave.time, "swell": swell.time, "current": stream.time,
        },
        "provider": PROVIDER,
        "fetched_at": now.isoformat(),
    }


def recommendations(force, wave_height):
    """Advice only for conditions we actually know. Unknown never produces 'favourable'."""
    if force is None:
        return ["Wind data is unavailable or out of date for this position, so no weather assessment was made."]
    recs = []
    if force >= 6:
        recs.append("Consider altering course to reduce beam seas exposure.")
    if force >= 7:
        recs.append("Reduce speed to maintain safe vessel motion and cargo security.")
    if force >= 8:
        recs.append("Issue heavy weather advisory; secure all deck equipment and cargo lashings.")
    if wave_height is not None and wave_height > 3.5:
        recs.append("Wave heights exceed 3.5 m: monitor hull stresses and reduce speed accordingly.")
    if wave_height is not None and wave_height > 6.0:
        recs.append("Extreme swell: seek shelter or divert if operationally feasible.")
    if wave_height is None:
        recs.append("Wave data is unavailable, so sea state was not assessed.")
    if not recs:
        recs.append("Wind and wave conditions are within normal limits.")
    return recs


def daily_value(daily, key, index):
    """One day's value from a provider 'daily' block; None if the series or day is missing."""
    try:
        return daily[key][index]
    except (KeyError, IndexError, TypeError):
        return None
