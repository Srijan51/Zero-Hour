from pydantic import BaseModel
from typing import List, Optional

class VolunteerBase(BaseModel):
    intent: Optional[str] = None
    skills: List[str] = []
    assets: List[str] = []
    availability_hours: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class VolunteerCreate(VolunteerBase):
    pass

class VolunteerResponse(VolunteerBase):
    id: int

    class Config:
        from_attributes = True

class NGORequestBase(BaseModel):
    ngo_name: str
    task_description: str
    required_skills: List[str] = []
    required_assets: List[str] = []
    lat: float
    lng: float
    urgency: int = 3
    status: str = "open"

class NGORequestCreate(NGORequestBase):
    pass

class NGORequestResponse(NGORequestBase):
    id: int

    class Config:
        from_attributes = True

class MatchConfirm(BaseModel):
    volunteer_id: int
    request_id: int

class MatchResponse(BaseModel):
    id: int
    volunteer_id: int
    request_id: int
    score: float
    status: str
    request: Optional[NGORequestResponse] = None

    class Config:
        from_attributes = True
