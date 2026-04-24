from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Match, Volunteer, NGORequest
from app.schemas import MatchConfirm, MatchLiveResponse, MatchResponse
from app.services.matcher import compute_score, haversine
from app.services.google_maps import get_driving_eta
from typing import List

router = APIRouter(prefix="/match", tags=["Match"])


def _compute_live_state(match: Match, request: NGORequest):
    created_at = match.created_at
    if not created_at:
        created_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    created_ts = created_at.astimezone(timezone.utc) if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    elapsed_minutes = max(0, (now - created_ts).total_seconds() / 60)

    # Use the stored Google Maps ETA when available; fall back to haversine estimate.
    if match.eta_minutes and match.eta_minutes > 0:
        travel_minutes = float(match.eta_minutes)
        eta_display = match.eta_text or f"{match.eta_minutes} mins"
    else:
        distance_km = haversine(match.volunteer.lat or 22.5726, match.volunteer.lng or 88.3639, request.lat, request.lng)
        avg_speed_kmh = 28 if (request.urgency or 3) >= 4 else 35
        travel_minutes = max(5.0, (distance_km / avg_speed_kmh) * 60.0)
        eta_display = f"{int(round(travel_minutes))} mins"

    progress_percent = min(100.0, (elapsed_minutes / travel_minutes) * 100.0)
    remaining_minutes = max(0, int(round(travel_minutes - elapsed_minutes)))
    eta_arrival_time = (now + timedelta(minutes=remaining_minutes)).isoformat()

    if progress_percent < 25:
        return "en_route", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer en route — ETA {eta_display}"
    if progress_percent < 65:
        return "en_route", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer on the way — {eta_display} remaining"
    if progress_percent < 90:
        return "nearby", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer nearby — arriving in {eta_display}"
    if progress_percent < 100:
        return "on_site", progress_percent, remaining_minutes, eta_arrival_time, eta_display, "Volunteer has reached the mission location"
    return "completed", 100.0, 0, now.isoformat(), eta_display, "Mission marked completed"

@router.post("/confirm", response_model=MatchResponse)
def confirm_match(confirm: MatchConfirm, db: Session = Depends(get_db)):
    # Simple validation
    vol = db.query(Volunteer).filter(Volunteer.id == confirm.volunteer_id).first()
    req = db.query(NGORequest).filter(NGORequest.id == confirm.request_id).first()
    
    if not vol or not req:
        raise HTTPException(status_code=404, detail="Volunteer or Request not found")

    computed_score = round(max(0.0, min(100.0, compute_score(vol, req))), 2)

    # Fetch real driving ETA from Google Maps Distance Matrix API.
    eta_result = get_driving_eta(
        vol.lat or 22.5726,
        vol.lng or 88.3639,
        req.lat,
        req.lng,
    )

    new_match = Match(
        volunteer_id=vol.id,
        request_id=req.id,
        score=computed_score,
        status="en_route",
        eta_minutes=eta_result["duration_minutes"],
        eta_text=eta_result["duration_text"],
    )
    req.status = "matched"
    
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    db.refresh(req)
    new_match.request = req
    
    # Mocking FCM push to NGO
    print(f"FCM Notification sent to NGO {req.ngo_name}: Volunteer accepted task {req.task_description}")
    print(f"ETA: {eta_result['duration_text']} (source: {eta_result['source']})")
    
    return new_match


@router.get("/{match_id}/live", response_model=MatchLiveResponse)
def get_match_live_status(match_id: int, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    status, progress_percent, eta_minutes, eta_arrival_time, eta_text, status_message = _compute_live_state(match, req)
    if match.status != status:
        match.status = status
    if req.status != "completed" and status == "completed":
        req.status = "completed"
    elif req.status == "open":
        req.status = "matched"
    db.commit()
    db.refresh(match)
    db.refresh(req)

    return MatchLiveResponse(
        id=match.id,
        status=status,
        progress_percent=round(progress_percent, 2),
        eta_minutes=eta_minutes,
        eta_text=eta_text,
        eta_arrival_time=eta_arrival_time,
        status_message=status_message,
        request=req,
    )

@router.get("/volunteer/{vol_id}", response_model=List[MatchResponse])
def get_volunteer_matches(vol_id: int, db: Session = Depends(get_db)):
    return db.query(Match).filter(Match.volunteer_id == vol_id).all()
