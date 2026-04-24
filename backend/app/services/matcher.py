import math
import re

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

def _normalize_term(value):
    if value is None:
        return ""
    normalized = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value).lower())).strip()
    aliases = {
        "four by four": "4x4",
        "4 by 4": "4x4",
        "vehicle": "vehicle",
        "car": "vehicle",
        "jeep": "vehicle",
        "ambulance": "ambulance",
        "first aid": "first aid",
        "medical": "medical",
        "boat": "boat",
        "generator": "generator",
    }
    return aliases.get(normalized, normalized)


def _token_set(value):
    normalized = _normalize_term(value)
    if not normalized:
        return set()
    return {token for token in normalized.split(" ") if token}


def _is_semantic_match(req_term, vol_term):
    if req_term == vol_term:
        return True
    if req_term in vol_term or vol_term in req_term:
        return True

    req_tokens = _token_set(req_term)
    vol_tokens = _token_set(vol_term)
    if not req_tokens or not vol_tokens:
        return False

    overlap = len(req_tokens & vol_tokens)
    min_required_overlap = max(1, min(len(req_tokens), len(vol_tokens)) // 2)
    return overlap >= min_required_overlap


def _match_ratio(vol_list, req_list):
    req_terms = [_normalize_term(item) for item in (req_list or []) if _normalize_term(item)]
    vol_terms = [_normalize_term(item) for item in (vol_list or []) if _normalize_term(item)]

    if not req_terms:
        return 1.0
    if not vol_terms:
        return 0.0

    matched_count = 0
    for req_term in req_terms:
        if any(_is_semantic_match(req_term, vol_term) for vol_term in vol_terms):
            matched_count += 1

    return matched_count / len(req_terms)

def compute_score(volunteer, request):
    # Proximity score ratio.
    vol_lat, vol_lng = volunteer.lat or 22.5726, volunteer.lng or 88.3639 # Default Kolkata roughly
    distance = haversine(vol_lat, vol_lng, request.lat, request.lng)
    proximity_ratio = max(0.0, min(1.0, 1 - (distance / 50.0)))

    skill_ratio = _match_ratio(volunteer.skills, request.required_skills)
    asset_ratio = _match_ratio(volunteer.assets, request.required_assets)

    req_skills = request.required_skills or []
    req_assets = request.required_assets or []

    # Keep percentages realistic by weighting what's actually requested.
    if req_skills and req_assets:
        skill_weight, asset_weight, proximity_weight = 40, 45, 15
    elif req_assets and not req_skills:
        skill_weight, asset_weight, proximity_weight = 0, 85, 15
    elif req_skills and not req_assets:
        skill_weight, asset_weight, proximity_weight = 85, 0, 15
    else:
        skill_weight, asset_weight, proximity_weight = 0, 0, 100

    score = (
        skill_ratio * skill_weight
        + asset_ratio * asset_weight
        + proximity_ratio * proximity_weight
    )

    # Proportional penalties — reduce score but don't obliterate it.
    if req_assets:
        if asset_ratio == 0:
            score *= 0.35
        elif asset_ratio < 1.0:
            score *= (0.7 + (asset_ratio * 0.3))
    if req_skills:
        if skill_ratio == 0:
            score *= 0.5
        elif skill_ratio < 1.0:
            score *= (0.75 + (skill_ratio * 0.25))

    # Availability hours influence: reduce score for likely under-availability.
    if volunteer.availability_hours is not None:
        availability = max(0.0, float(volunteer.availability_hours))
        if request.urgency >= 4 and availability < 1.0:
            score *= 0.85
        elif request.urgency >= 3 and availability < 0.5:
            score *= 0.9

    return round(max(0.0, min(100.0, score)), 2)

def rank_requests(volunteer, requests):
    results = []
    for req in requests:
        score = compute_score(volunteer, req)
        results.append((score, req))
    results.sort(key=lambda x: x[0], reverse=True)
    return results[:3]
