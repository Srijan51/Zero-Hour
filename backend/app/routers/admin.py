import os
import secrets
from urllib.parse import quote_plus
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminAccount, Match, NGOAccount, NGORegistration, NGORequest
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
