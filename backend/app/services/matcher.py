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

def compute_score(volunteer, request):
    # Proximity score (0 to 20)
    vol_lat, vol_lng = volunteer.lat or 22.5726, volunteer.lng or 88.3639 # Default Kolkata roughly
    distance = haversine(vol_lat, vol_lng, request.lat, request.lng)
    proximity_score = max(0, 20 - distance * 2)
    
    # Skills score
    vol_skills = set([s.lower() for s in volunteer.skills])
    req_skills = set([s.lower() for s in request.required_skills])
    if req_skills:
        skill_score = (len(vol_skills.intersection(req_skills)) / len(req_skills)) * 40
    else:
        skill_score = 40 if vol_skills else 0
        
    # Assets score
    vol_assets = set([a.lower() for a in volunteer.assets])
    req_assets = set([a.lower() for a in request.required_assets])
    if req_assets:
        asset_score = (len(vol_assets.intersection(req_assets)) / len(req_assets)) * 40
    else:
        asset_score = 40 if vol_assets else 0
        
    return proximity_score + skill_score + asset_score

def rank_requests(volunteer, requests):
    results = []
    for req in requests:
        score = compute_score(volunteer, req)
        results.append((score, req))
    results.sort(key=lambda x: x[0], reverse=True)
    return results[:3]
