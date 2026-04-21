from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Match, Volunteer, NGORequest
from app.schemas import MatchConfirm, MatchResponse
from typing import List

router = APIRouter(prefix="/match", tags=["Match"])

@router.post("/confirm", response_model=MatchResponse)
def confirm_match(confirm: MatchConfirm, db: Session = Depends(get_db)):
    # Simple validation
    vol = db.query(Volunteer).filter(Volunteer.id == confirm.volunteer_id).first()
    req = db.query(NGORequest).filter(NGORequest.id == confirm.request_id).first()
    
    if not vol or not req:
        raise HTTPException(status_code=404, detail="Volunteer or Request not found")

    # In reality, score would be saved from the matching step. We'll set a default high score since it's confirmed.
    new_match = Match(
        volunteer_id=vol.id,
        request_id=req.id,
        score=100.0,
        status="en_route"
    )
    req.status = "matched"
    
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    # Mocking FCM push to NGO
    print(f"FCM Notification sent to NGO {req.ngo_name}: Volunteer accepted task {req.task_description}")
    
    return new_match

@router.get("/volunteer/{vol_id}", response_model=List[MatchResponse])
def get_volunteer_matches(vol_id: int, db: Session = Depends(get_db)):
    return db.query(Match).filter(Match.volunteer_id == vol_id).all()
