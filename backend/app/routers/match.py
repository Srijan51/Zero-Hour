from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Match, NGOAccount, NGORequest, Volunteer
from app.schemas import CheckinRequest, MatchConfirm, MatchLiveResponse, MatchResponse
from app.services.matcher import compute_score, haversine
from app.services.google_maps import get_driving_eta
from typing import List

router = APIRouter(prefix="/match", tags=["Match"])

# Distance threshold (km) for arrival detection (~200 m)
ARRIVAL_THRESHOLD_KM = 0.2
# No-show: pings stopped for this many minutes
NO_SHOW_PING_TIMEOUT_MIN = 5
# Volunteers can self-cancel only shortly after accepting.
VOLUNTEER_CANCEL_WINDOW_SECONDS = 120


def _get_authenticated_ngo(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> NGOAccount:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NGO authentication required")
    token = authorization.split(" ", 1)[1].strip()

    from app.services.session_store import get_user_id
    ngo_id = get_user_id(db, token, "ngo")
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired NGO token")

    ngo = db.query(NGOAccount).filter(NGOAccount.id == ngo_id, NGOAccount.is_active == True).first()
    if not ngo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired NGO token")
    return ngo


def _get_authenticated_volunteer_id(
    x_volunteer_token: str = Header(default="", alias="X-Volunteer-Token"),
    db: Session = Depends(get_db),
) -> int:
    token = (x_volunteer_token or "").strip()

    from app.services.session_store import get_user_id
    volunteer_id = get_user_id(db, token, "volunteer")
    if not volunteer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Volunteer authentication required")
    return volunteer_id 


def _ensure_ngo_owns_request(ngo: NGOAccount, request: NGORequest) -> None:
    if request.ngo_name != ngo.ngo_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage your own requests")


def _ensure_volunteer_owns_match(volunteer_id: int, match: Match) -> None:
    if match.volunteer_id != volunteer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage your own mission")


def _check_no_show(match: Match) -> bool:
    """A volunteer is flagged as no-show only when GPS pings STOP entirely.
    If pings are still arriving (even if position isn't changing = stuck in traffic),
    the volunteer is NOT flagged."""
    if match.status in ("pending_confirmation", "completed", "cancelled"):
        return False
    if not match.last_ping_at:
        # No pings received at all — check time since match creation
        created = match.created_at
        if not created:
            return False
        created_utc = created.replace(tzinfo=timezone.utc) if not created.tzinfo else created.astimezone(timezone.utc)
        minutes_since_create = (datetime.now(timezone.utc) - created_utc).total_seconds() / 60
        return minutes_since_create > NO_SHOW_PING_TIMEOUT_MIN
    # Last ping exists — check if it's stale
    last = match.last_ping_at
    last_utc = last.replace(tzinfo=timezone.utc) if not last.tzinfo else last.astimezone(timezone.utc)
    minutes_since_ping = (datetime.now(timezone.utc) - last_utc).total_seconds() / 60
    return minutes_since_ping > NO_SHOW_PING_TIMEOUT_MIN


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

    # If we have live GPS from pings, compute distance-based progress
    if match.volunteer_lat is not None and match.volunteer_lng is not None:
        current_distance = haversine(match.volunteer_lat, match.volunteer_lng, request.lat, request.lng)
        initial_distance = haversine(match.volunteer.lat or 22.5726, match.volunteer.lng or 88.3639, request.lat, request.lng)
        if initial_distance > 0.01:
            progress_percent = min(100.0, max(0.0, (1 - (current_distance / initial_distance)) * 100.0))
        else:
            progress_percent = 100.0
    else:
        progress_percent = min(100.0, (elapsed_minutes / travel_minutes) * 100.0)

    remaining_minutes = max(0, int(round(travel_minutes - elapsed_minutes)))
    eta_arrival_time = (now + timedelta(minutes=remaining_minutes)).isoformat()

    # Override status based on match status (which may be set by checkin/complete)
    status = match.status
    if status == "pending_confirmation":
        return "pending_confirmation", progress_percent, 0, now.isoformat(), eta_display, "Volunteer marked task done — awaiting NGO confirmation"
    if status == "completed":
        return "completed", 100.0, 0, now.isoformat(), eta_display, "Mission completed and confirmed"
    if status == "cancelled":
        return "cancelled", 0, 0, now.isoformat(), eta_display, "Mission cancelled"

    if match.arrived_at:
        return "on_site", 100.0, 0, now.isoformat(), eta_display, "Volunteer has reached the mission location"
    if progress_percent < 25:
        return "en_route", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer en route — ETA {eta_display}"
    if progress_percent < 65:
        return "en_route", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer on the way — {eta_display} remaining"
    if progress_percent < 90:
        return "nearby", progress_percent, remaining_minutes, eta_arrival_time, eta_display, f"Volunteer nearby — arriving in {eta_display}"
    return "on_site", progress_percent, remaining_minutes, eta_arrival_time, eta_display, "Volunteer has reached the mission location"


@router.post("/confirm", response_model=MatchResponse)
def confirm_match(
    confirm: MatchConfirm,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    if volunteer_id != confirm.volunteer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Volunteer identity mismatch")

    vol = db.query(Volunteer).filter(Volunteer.id == confirm.volunteer_id).first()
    req = db.query(NGORequest).filter(NGORequest.id == confirm.request_id).first()
    
    if not vol or not req:
        raise HTTPException(status_code=404, detail="Volunteer or Request not found")

    # Save phone/name on the volunteer record
    if confirm.phone:
        vol.phone = confirm.phone
    if confirm.name:
        vol.name = confirm.name

    computed_score = round(max(0.0, min(100.0, compute_score(vol, req))), 2)

    eta_result = get_driving_eta(
        vol.lat or 22.5726,
        vol.lng or 88.3639,
        req.lat,
        req.lng,
    )

    now = datetime.now(timezone.utc)
    new_match = Match(
        volunteer_id=vol.id,
        request_id=req.id,
        score=computed_score,
        status="en_route",
        eta_minutes=eta_result["duration_minutes"],
        eta_text=eta_result["duration_text"],
        created_at=now,
        updated_at=now,
    )
    req.status = "matched"
    
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    db.refresh(req)
    db.refresh(vol)
    new_match.request = req
    
    print(f"FCM Notification sent to NGO {req.ngo_name}: Volunteer {vol.name or 'Anonymous'} ({vol.phone or 'no phone'}) accepted task {req.task_description}")
    print(f"ETA: {eta_result['duration_text']} (source: {eta_result['source']})")
    
    response = MatchResponse.model_validate(new_match)
    response.volunteer_phone = vol.phone
    response.volunteer_name = vol.name
    return response


@router.post("/{match_id}/checkin")
def checkin(
    match_id: int,
    payload: CheckinRequest,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    """Receive a GPS ping from the volunteer. Updates position and detects arrival."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    _ensure_volunteer_owns_match(volunteer_id, match)

    if match.status in ("completed", "cancelled"):
        return {"status": match.status, "arrived": match.arrived_at is not None}

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Update GPS position and ping timestamp
    match.volunteer_lat = payload.lat
    match.volunteer_lng = payload.lng
    match.last_ping_at = datetime.now(timezone.utc)

    # Clear no-show flag since we just received a ping
    if match.no_show_flagged:
        match.no_show_flagged = False

    # Check arrival (within ~200m of target)
    distance_to_target = haversine(payload.lat, payload.lng, req.lat, req.lng)
    arrived = distance_to_target <= ARRIVAL_THRESHOLD_KM

    if arrived and not match.arrived_at:
        match.arrived_at = datetime.now(timezone.utc)
        match.status = "on_site"
        print(f"🎯 Volunteer arrived at mission location (distance: {distance_to_target*1000:.0f}m)")

    db.commit()

    return {
        "status": match.status,
        "arrived": match.arrived_at is not None,
        "distance_km": round(distance_to_target, 3),
        "no_show_flagged": False,
    }


@router.post("/{match_id}/delay")
def notify_delay(
    match_id: int,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    """Volunteer taps 'I'm delayed' — stores timestamp for NGO visibility."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    _ensure_volunteer_owns_match(volunteer_id, match)

    match.delay_notified_at = datetime.now(timezone.utc)
    db.commit()

    print(f"⏳ Volunteer notified delay for match {match_id}")
    return {"ok": True, "delay_notified_at": match.delay_notified_at.isoformat()}


@router.post("/{match_id}/cancel")
def volunteer_cancel(
    match_id: int,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    """Allow a volunteer to cancel a just-accepted mission within two minutes."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    _ensure_volunteer_owns_match(volunteer_id, match)

    if match.status in ("pending_confirmation", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Match already finalized")

    created_at = match.created_at or datetime.now(timezone.utc)
    created_utc = created_at.astimezone(timezone.utc) if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    elapsed_seconds = (datetime.now(timezone.utc) - created_utc).total_seconds()
    if elapsed_seconds > VOLUNTEER_CANCEL_WINDOW_SECONDS:
        raise HTTPException(status_code=400, detail="Cancellation window has expired")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    match.status = "cancelled"
    if req and req.status in ("matched", "pending_confirmation"):
        req.status = "open"

    db.commit()

    print(f"Volunteer cancelled match {match_id}; request re-opened")
    return {"ok": True, "status": "cancelled"}


@router.post("/{match_id}/complete")
def volunteer_complete(
    match_id: int,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    """Volunteer marks task as done. Status → pending_confirmation. NGO must confirm."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    _ensure_volunteer_owns_match(volunteer_id, match)

    if match.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Match already finalized")

    # Gate: volunteer must have arrived (within 200m) to mark complete
    if not match.arrived_at:
        raise HTTPException(status_code=400, detail="You must be at the mission location to mark task as done")

    match.status = "pending_confirmation"
    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if req:
        req.status = "pending_confirmation"
    db.commit()

    print(f"✅ Volunteer marked match {match_id} as complete — awaiting NGO confirmation")
    return {"ok": True, "status": "pending_confirmation"}


@router.post("/{match_id}/ngo-confirm")
def ngo_confirm_completion(
    match_id: int,
    db: Session = Depends(get_db),
    ngo: NGOAccount = Depends(_get_authenticated_ngo),
):
    """NGO confirms the volunteer actually helped. Finalizes the mission."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_ngo_owns_request(ngo, req)

    if match.status != "pending_confirmation":
        raise HTTPException(status_code=400, detail="Match is not awaiting confirmation")

    match.status = "completed"
    req.status = "completed"
    db.commit()

    print(f"🎉 NGO confirmed completion for match {match_id}")
    return {"ok": True, "status": "completed"}


@router.post("/{match_id}/ngo-dispute")
def ngo_dispute(
    match_id: int,
    db: Session = Depends(get_db),
    ngo: NGOAccount = Depends(_get_authenticated_ngo),
):
    """NGO disputes completion — volunteer didn't actually help. Re-opens the request."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_ngo_owns_request(ngo, req)

    match.status = "cancelled"
    req.status = "open"
    db.commit()

    print(f"❌ NGO disputed match {match_id} — request re-opened")
    return {"ok": True, "status": "open"}


@router.post("/{match_id}/rebroadcast")
def rebroadcast(
    match_id: int,
    db: Session = Depends(get_db),
    ngo: NGOAccount = Depends(_get_authenticated_ngo),
):
    """NGO cancels a no-show match and re-opens the request for other volunteers."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_ngo_owns_request(ngo, req)

    match.status = "cancelled"
    req.status = "open"
    db.commit()

    print(f"📡 Re-broadcast: match {match_id} cancelled, request re-opened")
    return {"ok": True, "status": "open"}


@router.get("/{match_id}/live", response_model=MatchLiveResponse)
def get_match_live_status(
    match_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(default=""),
    x_volunteer_token: str = Header(default="", alias="X-Volunteer-Token"),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    req = db.query(NGORequest).filter(NGORequest.id == match.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    from app.services.session_store import get_user_id as _get_uid

    ngo_authenticated = False
    token = (authorization or "").strip()
    if token.startswith("Bearer "):
        ngo_token = token.split(" ", 1)[1].strip()
        ngo_id = _get_uid(db, ngo_token, "ngo")
        if ngo_id:
            ngo = db.query(NGOAccount).filter(NGOAccount.id == ngo_id, NGOAccount.is_active == True).first()
            if ngo and ngo.ngo_name == req.ngo_name:
                ngo_authenticated = True

    volunteer_token = (x_volunteer_token or "").strip()
    volunteer_id = _get_uid(db, volunteer_token, "volunteer")
    volunteer_authenticated = volunteer_id == match.volunteer_id

    if not ngo_authenticated and not volunteer_authenticated:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized access to live mission")

    # Check no-show (pings stopped)
    is_no_show = _check_no_show(match)
    if is_no_show and not match.no_show_flagged:
        match.no_show_flagged = True
    elif not is_no_show and match.no_show_flagged:
        match.no_show_flagged = False

    status, progress_percent, eta_minutes, eta_arrival_time, eta_text, status_message = _compute_live_state(match, req)
    if match.status not in ("pending_confirmation", "completed", "cancelled") and match.status != status:
        match.status = status

    db.commit()
    db.refresh(match)

    vol = match.volunteer

    return MatchLiveResponse(
        id=match.id,
        status=status,
        created_at=match.created_at,
        progress_percent=round(progress_percent, 2),
        eta_minutes=eta_minutes,
        eta_text=eta_text,
        eta_arrival_time=eta_arrival_time,
        status_message=status_message,
        volunteer_lat=match.volunteer_lat,
        volunteer_lng=match.volunteer_lng,
        no_show_flagged=match.no_show_flagged,
        delay_notified_at=match.delay_notified_at,
        arrived=match.arrived_at is not None,
        volunteer_phone=vol.phone if vol else None,
        volunteer_name=vol.name if vol else None,
        request=req,
    )


@router.get("/request/{request_id}", response_model=List[MatchResponse])
def get_matches_for_request(
    request_id: int,
    db: Session = Depends(get_db),
    ngo: NGOAccount = Depends(_get_authenticated_ngo),
):
    """Get all matches for a specific request (used by NGO dashboard)."""
    req = db.query(NGORequest).filter(NGORequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_ngo_owns_request(ngo, req)

    matches = db.query(Match).filter(
        Match.request_id == request_id,
        Match.status != "cancelled",
    ).order_by(Match.id.desc()).all()
    results = []
    for m in matches:
        vol = m.volunteer
        resp = MatchResponse.model_validate(m)
        resp.volunteer_phone = vol.phone if vol else None
        resp.volunteer_name = vol.name if vol else None
        results.append(resp)
    return results


@router.get("/volunteer/{vol_id}", response_model=List[MatchResponse])
def get_volunteer_matches(
    vol_id: int,
    db: Session = Depends(get_db),
    volunteer_id: int = Depends(_get_authenticated_volunteer_id),
):
    if vol_id != volunteer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own matches")
    return db.query(Match).filter(Match.volunteer_id == vol_id).all()
