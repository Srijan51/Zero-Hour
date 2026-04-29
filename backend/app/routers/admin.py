import os
import secrets
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminAccount, Match, NGOAccount, NGORegistration, NGORequest, Volunteer
from app.schemas import (
    AdminNGORequestResponse,
    AdminNGORequestUpdate,
    AdminLoginRequest,
    AdminLoginResponse,
    NGOAccountCreateByAdmin,
    NGOAccountResponse,
    NGOAccountUpdateByAdmin,
    NGORegistrationResponse,
)
from app.services.auth import hash_password, verify_password
from app.services.google_maps import get_eta_calibration_factor
from app.services.matcher import _expand_to_canonical_tokens, _is_semantic_match

router = APIRouter(prefix="/admin", tags=["Admin"])




def ensure_default_admin(db: Session) -> None:
    default_username = os.getenv("ADMIN_USERNAME", "admin")
    default_password = os.getenv("ADMIN_PASSWORD", "admin123")

    existing = db.query(AdminAccount).filter(AdminAccount.username == default_username).first()
    if existing:
        return

    admin = AdminAccount(
        username=default_username,
        password_hash=hash_password(default_password),
        is_superadmin=True,
    )
    db.add(admin)
    db.commit()


def _get_authenticated_admin(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> AdminAccount:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required")

    token = authorization.split(" ", 1)[1].strip()

    from app.services.session_store import get_user_id
    admin_id = get_user_id(db, token, "admin")
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired admin token")

    admin = db.query(AdminAccount).filter(AdminAccount.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired admin token")
    return admin


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminAccount).filter(AdminAccount.username == payload.username).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    from app.services.session_store import create_token
    token = create_token(db, user_type="admin", user_id=admin.id)
    return AdminLoginResponse(token=token, username=admin.username)


@router.get("/me")
def admin_me(admin: AdminAccount = Depends(_get_authenticated_admin)):
    return {"username": admin.username, "is_superadmin": admin.is_superadmin}


@router.get("/ngos", response_model=List[NGOAccountResponse])
def list_ngos(db: Session = Depends(get_db), admin: AdminAccount = Depends(_get_authenticated_admin)):
    return db.query(NGOAccount).order_by(NGOAccount.ngo_name.asc()).all()


@router.post("/ngos", response_model=NGOAccountResponse)
def create_ngo_account(payload: NGOAccountCreateByAdmin, db: Session = Depends(get_db), admin: AdminAccount = Depends(_get_authenticated_admin)):
    existing_name = db.query(NGOAccount).filter(NGOAccount.ngo_name == payload.ngo_name).first()
    if existing_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NGO name already exists")

    existing_email = db.query(NGOAccount).filter(NGOAccount.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    ngo = NGOAccount(
        ngo_name=payload.ngo_name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        certificate_80g_number=payload.certificate_80g_number,
        certificate_12a_number=payload.certificate_12a_number,
        description=payload.description,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(ngo)
    db.commit()
    db.refresh(ngo)
    return ngo


@router.delete("/ngos/{ngo_id}")
def delete_ngo_account(ngo_id: int, db: Session = Depends(get_db), admin: AdminAccount = Depends(_get_authenticated_admin)):
    ngo = db.query(NGOAccount).filter(NGOAccount.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO account not found")

    ngo_request_ids = [
        request_id
        for (request_id,) in db.query(NGORequest.id).filter(NGORequest.ngo_name == ngo.ngo_name).all()
    ]

    if ngo_request_ids:
        db.query(Match).filter(Match.request_id.in_(ngo_request_ids)).delete(synchronize_session=False)

    db.query(NGORequest).filter(NGORequest.id.in_(ngo_request_ids)).delete(synchronize_session=False)
    db.query(NGORegistration).filter(NGORegistration.ngo_name == ngo.ngo_name).delete(synchronize_session=False)

    db.delete(ngo)
    db.commit()

    from app.services.session_store import delete_all_tokens_for_user
    delete_all_tokens_for_user(db, user_type="ngo", user_id=ngo_id)

    return {"message": "NGO deleted"}


@router.put("/ngos/{ngo_id}", response_model=NGOAccountResponse)
def update_ngo_account(
    ngo_id: int,
    payload: NGOAccountUpdateByAdmin,
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    ngo = db.query(NGOAccount).filter(NGOAccount.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO account not found")

    if payload.ngo_name and payload.ngo_name != ngo.ngo_name:
        duplicate_name = db.query(NGOAccount).filter(NGOAccount.ngo_name == payload.ngo_name).first()
        if duplicate_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NGO name already exists")
        ngo.ngo_name = payload.ngo_name

    if payload.email and payload.email != ngo.email:
        duplicate_email = db.query(NGOAccount).filter(NGOAccount.email == payload.email).first()
        if duplicate_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
        ngo.email = payload.email

    if payload.phone is not None:
        ngo.phone = payload.phone
    if payload.address is not None:
        ngo.address = payload.address
    if payload.certificate_80g_number is not None:
        ngo.certificate_80g_number = payload.certificate_80g_number
    if payload.certificate_12a_number is not None:
        ngo.certificate_12a_number = payload.certificate_12a_number
    if payload.description is not None:
        ngo.description = payload.description
    if payload.is_active is not None:
        ngo.is_active = payload.is_active
    if payload.password:
        ngo.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(ngo)
    return ngo


@router.get("/registrations", response_model=List[NGORegistrationResponse])
def list_registrations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    query = db.query(NGORegistration)
    if status_filter:
        query = query.filter(NGORegistration.status == status_filter)
    return query.order_by(NGORegistration.id.desc()).all()


@router.post("/registrations/{registration_id}/approve", response_model=NGOAccountResponse)
def approve_registration(registration_id: int, db: Session = Depends(get_db), admin: AdminAccount = Depends(_get_authenticated_admin)):
    registration = db.query(NGORegistration).filter(NGORegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found")
    if registration.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration already processed")

    existing_name = db.query(NGOAccount).filter(NGOAccount.ngo_name == registration.ngo_name).first()
    if existing_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NGO name already exists")

    existing_email = db.query(NGOAccount).filter(NGOAccount.email == registration.email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    ngo = NGOAccount(
        ngo_name=registration.ngo_name,
        email=registration.email,
        phone=registration.phone,
        address=registration.address,
        certificate_80g_number=registration.certificate_80g_number,
        certificate_12a_number=registration.certificate_12a_number,
        description=registration.description,
        password_hash=registration.password_hash,
        is_active=True,
    )
    db.add(ngo)

    registration.status = "approved"
    registration.reviewed_by = admin.username

    db.commit()
    db.refresh(ngo)
    return ngo


@router.post("/registrations/{registration_id}/reject", response_model=NGORegistrationResponse)
def reject_registration(registration_id: int, db: Session = Depends(get_db), admin: AdminAccount = Depends(_get_authenticated_admin)):
    registration = db.query(NGORegistration).filter(NGORegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found")
    if registration.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration already processed")

    registration.status = "rejected"
    registration.reviewed_by = admin.username
    db.commit()
    db.refresh(registration)
    return registration


@router.get("/requests", response_model=List[AdminNGORequestResponse])
def list_all_requests(
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    ngo_name: Optional[str] = Query(default=None),
):
    query = db.query(NGORequest)
    if status_filter:
        query = query.filter(NGORequest.status == status_filter)
    if ngo_name:
        query = query.filter(NGORequest.ngo_name.ilike(f"%{ngo_name.strip()}%"))
    return query.order_by(NGORequest.id.desc()).all()


@router.put("/requests/{request_id}", response_model=AdminNGORequestResponse)
def update_request_by_admin(
    request_id: int,
    payload: AdminNGORequestUpdate,
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    req = db.query(NGORequest).filter(NGORequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    updates = payload.model_dump(exclude_unset=True)

    if "ngo_name" in updates:
        req.ngo_name = updates["ngo_name"]
    if "task_description" in updates:
        req.task_description = updates["task_description"]
    if "required_skills" in updates:
        req.required_skills = updates["required_skills"]
    if "required_assets" in updates:
        req.required_assets = updates["required_assets"]
    if "lat" in updates:
        req.lat = updates["lat"]
    if "lng" in updates:
        req.lng = updates["lng"]
    if "urgency" in updates:
        req.urgency = updates["urgency"]
    if "status" in updates:
        req.status = updates["status"]

    if "location_text" in updates:
        req.location_text = updates["location_text"]

    if "google_maps_url" in updates:
        req.google_maps_url = updates["google_maps_url"]
    elif "location_text" in updates and updates.get("location_text"):
        req.google_maps_url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(updates['location_text'])}"

    db.commit()
    db.refresh(req)
    return req


@router.delete("/requests/{request_id}")
def delete_request_by_admin(
    request_id: int,
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    req = db.query(NGORequest).filter(NGORequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    db.query(Match).filter(Match.request_id == request_id).delete(synchronize_session=False)
    db.delete(req)
    db.commit()

    return {"message": "Request deleted", "request_id": request_id}


@router.get("/eta-stats")
def eta_stats(
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    feedback_matches = (
        db.query(Match)
        .filter(
            Match.status == "completed",
            Match.eta_feedback_given == True,
            Match.actual_arrival_minutes.isnot(None),
            Match.eta_minutes.isnot(None),
            Match.eta_minutes > 0,
        )
        .order_by(Match.id.desc())
        .limit(50)
        .all()
    )

    sample_size = len(feedback_matches)
    if sample_size:
        ratios = [float(m.actual_arrival_minutes or 0) / float(m.eta_minutes or 1) for m in feedback_matches if (m.actual_arrival_minutes or 0) > 0 and (m.eta_minutes or 0) > 0]
        avg_ratio = sum(ratios) / len(ratios) if ratios else 1.0
    else:
        avg_ratio = 1.0

    return {
        "average_accuracy": round(avg_ratio, 3),
        "sample_size": sample_size,
        "calibration_factor": round(get_eta_calibration_factor(db), 3),
    }


@router.get("/analytics")
def admin_analytics(
    db: Session = Depends(get_db),
    admin: AdminAccount = Depends(_get_authenticated_admin),
):
    completed_matches = (
        db.query(Match)
        .filter(Match.status == "completed")
        .order_by(Match.id.asc())
        .all()
    )
    completed_requests = (
        db.query(NGORequest)
        .filter(NGORequest.status == "completed")
        .order_by(NGORequest.id.asc())
        .all()
    )

    total_missions_completed = len(completed_matches)

    response_times = []
    arrival_times = []
    missions_by_day_map = Counter()

    for match in completed_matches:
        req = match.request
        if req and req.created_at and match.created_at:
            created = req.created_at
            matched = match.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            else:
                created = created.astimezone(timezone.utc)
            if matched.tzinfo is None:
                matched = matched.replace(tzinfo=timezone.utc)
            else:
                matched = matched.astimezone(timezone.utc)
            response_times.append(max(0.0, (matched - created).total_seconds() / 60.0))

        if match.arrived_at and match.created_at:
            created = match.created_at
            arrived = match.arrived_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            else:
                created = created.astimezone(timezone.utc)
            if arrived.tzinfo is None:
                arrived = arrived.replace(tzinfo=timezone.utc)
            else:
                arrived = arrived.astimezone(timezone.utc)
            arrival_times.append(max(0.0, (arrived - created).total_seconds() / 60.0))

        if match.updated_at:
            day = match.updated_at.astimezone(timezone.utc).date() if match.updated_at.tzinfo else match.updated_at.date()
            missions_by_day_map[day.isoformat()] += 1

    avg_response_time_minutes = round(sum(response_times) / len(response_times), 2) if response_times else 0.0
    avg_arrival_time_minutes = round(sum(arrival_times) / len(arrival_times), 2) if arrival_times else 0.0

    urgency_distribution = {str(i): 0 for i in range(1, 6)}
    for req in db.query(NGORequest).all():
        key = str(max(1, min(5, int(req.urgency or 3))))
        urgency_distribution[key] = urgency_distribution.get(key, 0) + 1

    # Skill gaps: for completed requests, count required skills that none of the volunteers satisfy.
    volunteers = db.query(Volunteer).all()
    volunteer_skill_tokens = []
    for volunteer in volunteers:
        tokens = set()
        for skill in (volunteer.skills or []):
            tokens |= _expand_to_canonical_tokens(skill)
        volunteer_skill_tokens.append(tokens)

    skill_gap_counter = Counter()
    for req in completed_requests:
        for required_skill in (req.required_skills or []):
            if not required_skill:
                continue
            if not any(_is_semantic_match(required_skill, skill) for volunteer in volunteers for skill in (volunteer.skills or [])):
                skill_gap_counter[str(required_skill)] += 1

    top_skill_gaps = [
        {"skill": skill, "unmet_count": count}
        for skill, count in skill_gap_counter.most_common(5)
    ]

    volunteer_completion_counts = Counter()
    for match in completed_matches:
        volunteer_completion_counts[match.volunteer_id] += 1

    volunteers_with_completed = len(volunteer_completion_counts)
    volunteers_repeat = sum(1 for count in volunteer_completion_counts.values() if count >= 2)
    volunteer_repeat_rate = round((volunteers_repeat / volunteers_with_completed) * 100.0, 2) if volunteers_with_completed else 0.0

    missions_by_day = [
        {"date": day, "count": missions_by_day_map.get(day, 0)}
        for day in [
            (datetime.now(timezone.utc).date() - timedelta(days=delta)).isoformat()
            for delta in range(13, -1, -1)
        ]
    ]

    return {
        "total_missions_completed": total_missions_completed,
        "avg_response_time_minutes": avg_response_time_minutes,
        "avg_arrival_time_minutes": avg_arrival_time_minutes,
        "top_skill_gaps": top_skill_gaps,
        "missions_by_day": missions_by_day,
        "volunteer_repeat_rate": volunteer_repeat_rate,
        "urgency_distribution": urgency_distribution,
    }
