import secrets
from typing import Dict, List

from fastapi import APIRouter, Depends, File, UploadFile, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Volunteer, NGORequest
from app.services.stt import transcribe_audio
from app.services.gemini import parse_volunteer_speech
from app.services.matcher import rank_requests
from app.schemas import VolunteerResponse, VolunteerCreate, NGORequestResponse
import json

router = APIRouter(prefix="/volunteer", tags=["Volunteer"])

# In-memory token map: token -> volunteer id.
ACTIVE_VOLUNTEER_TOKENS: Dict[str, int] = {}

@router.post("/dispatch")
async def process_voice_dispatch(
    lat: float = Form(None),
    lng: float = Form(None),
    transcript: str = Form(None), 
    db: Session = Depends(get_db)
):
    # Depending on client, they might send transcript directly (Web Speech API)
    # or an audio file. We'll support transcript here directly as preferred implementation.
    
    if not transcript:
        # Fallback transcript
        transcript = "I am ready to help. I have a 4x4 vehicle and basic first aid skills, free for two hours."

    profile_data = parse_volunteer_speech(transcript)
    
    # Remove 'location' from profile_data as it is not a valid Volunteer column
    profile_data.pop('location', None)
    
    if lat is not None and lng is not None:
        profile_data['lat'] = lat
        profile_data['lng'] = lng
        
    volunteer = Volunteer(**profile_data)
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    volunteer_token = secrets.token_urlsafe(32)
    ACTIVE_VOLUNTEER_TOKENS[volunteer_token] = volunteer.id

    print(f"\n{'='*60}")
    print(f"🎤 Dispatch: \"{transcript}\"")
    print(f"📋 Parsed: skills={volunteer.skills}, assets={volunteer.assets}, hours={volunteer.availability_hours}")
    print(f"📍 Location: ({volunteer.lat}, {volunteer.lng})")
    
    # Run matching
    open_requests = db.query(NGORequest).filter(NGORequest.status == "open").all()
    top_matches = rank_requests(volunteer, open_requests)

    for score, req in top_matches:
        from app.services.matcher import _match_ratio
        sr = _match_ratio(volunteer.skills, req.required_skills)
        ar = _match_ratio(volunteer.assets, req.required_assets)
        print(f"  → {req.ngo_name}: score={score:.1f}% | skills={sr:.2f} ({req.required_skills}) | assets={ar:.2f} ({req.required_assets})")
    print(f"{'='*60}\n")
    
    # Structure response
    response_matches = []
    for score, req in top_matches:
        req_dict = req.__dict__.copy()
        req_dict['match_score'] = round(max(0.0, min(100.0, score)), 2)
        response_matches.append(req_dict)
        
    return {
        "volunteer": volunteer,
        "volunteer_token": volunteer_token,
        "matches": response_matches
    }
