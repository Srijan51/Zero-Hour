import math

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

def fuzzy_match_score(vol_list, req_list):
    if not req_list:
        return 40 if vol_list else 0
    if not vol_list:
        return 0
    
    matches = 0
    for req in req_list:
        req_lower = req.lower()
        if any(req_lower in v.lower() or v.lower() in req_lower for v in vol_list):
            matches += 1
            
    return (matches / len(req_list)) * 40

def compute_score(volunteer, request):
    # Proximity score (0 to 20)
    vol_lat, vol_lng = volunteer.lat or 22.5726, volunteer.lng or 88.3639 # Default Kolkata roughly
    distance = haversine(vol_lat, vol_lng, request.lat, request.lng)
    proximity_score = max(0, 20 - distance * 2)
    
    # Skills score
    skill_score = fuzzy_match_score(volunteer.skills, request.required_skills)
        
    # Assets score
    asset_score = fuzzy_match_score(volunteer.assets, request.required_assets)
        
    return proximity_score + skill_score + asset_score

def rank_requests(volunteer, requests):
    results = []
    for req in requests:
        score = compute_score(volunteer, req)
        results.append((score, req))
    results.sort(key=lambda x: x[0], reverse=True)
    return results[:3]
