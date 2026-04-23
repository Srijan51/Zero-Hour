import os
import secrets
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminAccount, NGOAccount, NGORegistration, NGORequest
from app.routers.ngo import ACTIVE_TOKENS
from app.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    NGOAccountCreateByAdmin,
    NGOAccountResponse,
    NGOAccountUpdateByAdmin,
    NGORegistrationResponse,
)
from app.services.auth import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["Admin"])

# In-memory token map: token -> admin id.
ACTIVE_ADMIN_TOKENS: Dict[str, int] = {}


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
    admin_id = ACTIVE_ADMIN_TOKENS.get(token)
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

    token = secrets.token_urlsafe(32)
    ACTIVE_ADMIN_TOKENS[token] = admin.id
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

    db.query(NGORequest).filter(NGORequest.ngo_name == ngo.ngo_name).delete(synchronize_session=False)
    db.query(NGORegistration).filter(NGORegistration.ngo_name == ngo.ngo_name).delete(synchronize_session=False)

    db.delete(ngo)
    db.commit()

    tokens_to_remove = [token for token, token_ngo_id in ACTIVE_TOKENS.items() if token_ngo_id == ngo_id]
    for token in tokens_to_remove:
        del ACTIVE_TOKENS[token]

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
