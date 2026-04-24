"""
Google Maps Distance Matrix API service.

Fetches real driving ETA between two coordinates.
Falls back to haversine-based estimate when the API key is missing or the call fails.
"""

import math
import os
import requests

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


def _haversine_fallback(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    """Estimate driving time from straight-line distance when no API key is available."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance_km = R * c

    # Rough city-driving estimate: ~25 km/h average
    est_minutes = max(5, int(round((distance_km / 25.0) * 60.0)))
    return {
        "duration_minutes": est_minutes,
        "duration_text": f"{est_minutes} mins",
        "source": "estimate",
    }


def get_driving_eta(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> dict:
    """
    Return real driving ETA using Google Maps Distance Matrix API.

    Returns dict with keys:
        - duration_minutes (int)
        - duration_text (str)   e.g. "23 mins"
        - source (str)         "google_maps" or "estimate"
    """
    if not GOOGLE_MAPS_API_KEY:
        return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        params = {
            "origins": f"{origin_lat},{origin_lng}",
            "destinations": f"{dest_lat},{dest_lng}",
            "mode": "driving",
            "departure_time": "now",
            "key": GOOGLE_MAPS_API_KEY,
        }
        resp = requests.get(DISTANCE_MATRIX_URL, params=params, timeout=8)
        data = resp.json()

        if data.get("status") != "OK":
            print(f"Distance Matrix API status: {data.get('status')}")
            return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

        element = data["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            print(f"Distance Matrix element status: {element.get('status')}")
            return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)

        duration = element.get("duration_in_traffic") or element.get("duration", {})
        duration_seconds = duration.get("value", 0)
        duration_text = duration.get("text", "")
        duration_minutes = max(1, int(round(duration_seconds / 60.0)))

        return {
            "duration_minutes": duration_minutes,
            "duration_text": duration_text,
            "source": "google_maps",
        }

    except Exception as e:
        print(f"Distance Matrix API error: {e}")
        return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng)
