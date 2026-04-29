import math
import re
import unicodedata

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

# ── Aliases: map common synonyms to canonical terms ──
ALIASES = {
    "car": "vehicle",
    "jeep": "vehicle",
    "truck": "vehicle",
    "van": "vehicle",
    "suv": "vehicle",
    "automobile": "vehicle",
    "four by four": "4x4",
    "4 by 4": "4x4",
    "4wd": "4x4",
    "awd": "4x4",
    "first aid": "first_aid",
    "firstaid": "first_aid",
    "medical": "medical",
    "paramedic": "medical",
    "doctor": "medical",
    "nurse": "medical",
    "medic": "medical",
    "boat": "boat",
    "kayak": "boat",
    "canoe": "boat",
    "raft": "boat",
    "generator": "generator",
    "genset": "generator",
    "ambulance": "ambulance",
    "swim": "swimming",
    "swimmer": "swimming",
    "swimming": "swimming",
    "construction": "construction",
    "builder": "construction",
    "heavy lifting": "heavy_lifting",
    "lifting": "heavy_lifting",
    "strong": "heavy_lifting",
    "driving": "driving",
    "drive": "driving",
    "driver": "driving",
    "logistics": "logistics",
    "organization": "organization",
    "organizer": "organization",
    "childcare": "childcare",
    "plumbing": "plumbing",
    "plumber": "plumbing",
    "electrical": "electrical",
    "electrician": "electrical",
    "technical": "technical",
    "tools": "tools",
    "carriers": "carriers",
    # Bengali aliases / transliterations
    "গাড়ি": "vehicle",
    "গাড়ি": "vehicle",
    "gari": "vehicle",
    "গাড়ী": "vehicle",
    "নৌকা": "boat",
    "নৌকো": "boat",
    "নৈকা": "boat",
    "nauka": "boat",
    "nouka": "boat",
    "সাঁতার": "swimming",
    "সাঁতারু": "swimming",
    "সাংতার": "swimming",
    "saatar": "swimming",
}

# Multi-word alias phrases to check before single-word tokenization
MULTI_WORD_ALIASES = {
    "four by four": "4x4",
    "4 by 4": "4x4",
    "first aid": "first_aid",
    "heavy lifting": "heavy_lifting",
    "construction tools": "construction",
}


def _expand_to_canonical_tokens(value):
    """Convert a skill/asset string into a set of canonical tokens."""
    if not value:
        return set()
    text = unicodedata.normalize("NFKC", str(value).lower())
    text = re.sub(r"[^0-9a-z\u0980-\u09ff]+", " ", text).strip()
    text = re.sub(r"\s+", " ", text)
    if not text:
        return set()

    tokens = set()

    # Check multi-word aliases first
    remaining = text
    for phrase, canonical in MULTI_WORD_ALIASES.items():
        if phrase in remaining:
            tokens.add(canonical)
            remaining = remaining.replace(phrase, " ")

    # Tokenize remaining words and alias each one
    for word in remaining.split():
        word = word.strip()
        if not word:
            continue
        canonical = ALIASES.get(word, word)
        tokens.add(canonical)

    return tokens


def _is_semantic_match(req_term, vol_term):
    """Check if a required term matches a volunteer term."""
    req_tokens = _expand_to_canonical_tokens(req_term)
    vol_tokens = _expand_to_canonical_tokens(vol_term)

    if not req_tokens or not vol_tokens:
        return False

    # Direct overlap: any shared canonical token = match
    if req_tokens & vol_tokens:
        return True

    # Substring containment on the canonical forms
    req_joined = " ".join(sorted(req_tokens))
    vol_joined = " ".join(sorted(vol_tokens))
    if req_joined in vol_joined or vol_joined in req_joined:
        return True

    return False


def _match_ratio(vol_list, req_list):
    """Fraction of required items that the volunteer satisfies."""
    req_items = [item for item in (req_list or []) if item and str(item).strip()]
    vol_items = [item for item in (vol_list or []) if item and str(item).strip()]

    if not req_items:
        return 1.0
    if not vol_items:
        return 0.0

    # Also build a flat set of all volunteer canonical tokens for broad matching
    vol_all_tokens = set()
    for v in vol_items:
        vol_all_tokens |= _expand_to_canonical_tokens(v)

    matched_count = 0
    for req_item in req_items:
        # First: try item-level semantic match
        if any(_is_semantic_match(req_item, vol_item) for vol_item in vol_items):
            matched_count += 1
            continue
        # Second: check if req tokens are a subset of the volunteer's full token pool
        req_tokens = _expand_to_canonical_tokens(req_item)
        if req_tokens and req_tokens <= vol_all_tokens:
            matched_count += 1

    return matched_count / len(req_items)


def compute_score(volunteer, request):
    # Proximity score ratio.
    vol_lat, vol_lng = volunteer.lat or 22.5726, volunteer.lng or 88.3639
    distance = haversine(vol_lat, vol_lng, request.lat, request.lng)
    proximity_ratio = max(0.0, min(1.0, 1 - (distance / 50.0)))

    skill_ratio = _match_ratio(volunteer.skills, request.required_skills)
    asset_ratio = _match_ratio(volunteer.assets, request.required_assets)

    req_skills = request.required_skills or []
    req_assets = request.required_assets or []

    # Weight based on what's actually requested.
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

    # Gentle penalties only when *nothing* matches — partial matches are already
    # reflected proportionally in the weighted score, no need to penalize again.
    if req_assets and asset_ratio == 0:
        score *= 0.5
    if req_skills and skill_ratio == 0:
        score *= 0.6

    # Availability hours influence: slight reduction for very low availability.
    if volunteer.availability_hours is not None:
        availability = max(0.0, float(volunteer.availability_hours))
        if request.urgency >= 4 and availability < 1.0:
            score *= 0.90
        elif request.urgency >= 3 and availability < 0.5:
            score *= 0.92

    return round(max(0.0, min(100.0, score)), 2)

def rank_requests(volunteer, requests):
    results = []
    for req in requests:
        score = compute_score(volunteer, req)
        results.append((score, req))
    results.sort(key=lambda x: x[0], reverse=True)
    return results[:3]
