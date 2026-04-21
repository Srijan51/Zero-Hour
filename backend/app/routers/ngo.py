from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NGORequest
from app.schemas import NGORequestCreate, NGORequestResponse
from typing import List

router = APIRouter(prefix="/ngo", tags=["NGO"])

@router.post("/requests", response_model=NGORequestResponse)
def create_ngo_request(req: NGORequestCreate, db: Session = Depends(get_db)):
    db_req = NGORequest(**req.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@router.get("/requests", response_model=List[NGORequestResponse])
def get_all_requests(db: Session = Depends(get_db)):
    return db.query(NGORequest).filter(NGORequest.status == "open").all()
