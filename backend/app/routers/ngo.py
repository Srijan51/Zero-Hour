import secrets
from urllib.parse import quote_plus
from typing import Dict, List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NGOAccount, NGORegistration, NGORequest
from app.schemas import (
    NGOLoginRequest,
    NGOLoginResponse,
    NGORegistrationCreate,
    NGORegistrationResponse,
    NGORequestCreate,
    NGORequestResponse,
)
from app.services.auth import hash_password, verify_password

router = APIRouter(prefix="/ngo", tags=["NGO"])

# In-memory token map: token -> NGO account id.



def _get_authenticated_ngo(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> NGOAccount:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = authorization.split(" ", 1)[1].strip()

    from app.services.session_store import get_user_id
    ngo_id = get_user_id(db, token, "ngo")
    if not ngo_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    ngo = db.query(NGOAccount).filter(NGOAccount.id == ngo_id, NGOAccount.is_active == True).first()
    if not ngo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return ngo


@router.post("/register", response_model=NGORegistrationResponse)
def register_ngo(payload: NGORegistrationCreate, db: Session = Depends(get_db)):
    existing_ngo = db.query(NGOAccount).filter(NGOAccount.ngo_name == payload.ngo_name).first()
    if existing_ngo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NGO name already exists")

    existing_email = db.query(NGOAccount).filter(NGOAccount.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    pending = db.query(NGORegistration).filter(
        NGORegistration.ngo_name == payload.ngo_name,
        NGORegistration.status == "pending",
    ).first()
    if pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A pending request already exists")

    registration = NGORegistration(
        ngo_name=payload.ngo_name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        certificate_80g_number=payload.certificate_80g_number,
        certificate_12a_number=payload.certificate_12a_number,
        description=payload.description,
        password_hash=hash_password(payload.password),
        status="pending",
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)
    return registration


@router.post("/login", response_model=NGOLoginResponse)
def ngo_login(payload: NGOLoginRequest, db: Session = Depends(get_db)):
    identifier = (payload.identifier or payload.ngo_name or payload.email or "").strip()
    ngo = db.query(NGOAccount).filter(
        NGOAccount.is_active == True,
        or_(NGOAccount.ngo_name == identifier, NGOAccount.email == identifier),
    ).first()
    if not ngo or not verify_password(payload.password, ngo.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid NGO credentials")

    from app.services.session_store import create_token
    token = create_token(db, user_type="ngo", user_id=ngo.id)
    return NGOLoginResponse(token=token, ngo_name=ngo.ngo_name)


@router.get("/me")
def ngo_me(ngo: NGOAccount = Depends(_get_authenticated_ngo)):
    return {"ngo_name": ngo.ngo_name, "id": ngo.id}

@router.post("/requests", response_model=NGORequestResponse)
def create_ngo_request(req: NGORequestCreate, db: Session = Depends(get_db), ngo: NGOAccount = Depends(_get_authenticated_ngo)):
    request_data = req.model_dump()
    if request_data.get("location_text") and not request_data.get("google_maps_url"):
        request_data["google_maps_url"] = f"https://www.google.com/maps/search/?api=1&query={quote_plus(request_data['location_text'])}"
    # Server-side binding ensures only authenticated NGOs can post under their own name.
    request_data["ngo_name"] = ngo.ngo_name
    db_req = NGORequest(**request_data)
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@router.get("/requests", response_model=List[NGORequestResponse])
def get_all_requests(db: Session = Depends(get_db), ngo: NGOAccount = Depends(_get_authenticated_ngo)):
    return db.query(NGORequest).filter(
        NGORequest.ngo_name == ngo.ngo_name,
        NGORequest.status.in_(["open", "matched", "pending_confirmation"])
    ).all()


@router.delete("/requests/{request_id}")
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    ngo: NGOAccount = Depends(_get_authenticated_ngo),
):
    req = db.query(NGORequest).filter(NGORequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.ngo_name != ngo.ngo_name:
        raise HTTPException(status_code=403, detail="You can only delete your own requests")

    # Cancel associated matches
    from app.models import Match
    db.query(Match).filter(Match.request_id == request_id).delete()
    db.delete(req)
    db.commit()
    return {"ok": True, "deleted_id": request_id}
