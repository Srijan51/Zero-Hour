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
    location_text: Optional[str] = None
    google_maps_url: Optional[str] = None
    lat: float
    lng: float
    urgency: int = 3
    status: str = "open"

class NGORequestCreate(BaseModel):
    task_description: str
    required_skills: List[str] = []
    required_assets: List[str] = []
    location_text: Optional[str] = None
    google_maps_url: Optional[str] = None
    lat: float
    lng: float
    urgency: int = 3
    status: str = "open"

class NGORequestResponse(NGORequestBase):
    id: int

    class Config:
        from_attributes = True

class NGOLoginRequest(BaseModel):
    identifier: Optional[str] = None
    ngo_name: Optional[str] = None
    email: Optional[str] = None
    password: str

class NGOLoginResponse(BaseModel):
    token: str
    ngo_name: str


class NGORegistrationCreate(BaseModel):
    ngo_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    certificate_80g_number: str
    certificate_12a_number: str
    description: Optional[str] = None
    password: str


class NGORegistrationResponse(BaseModel):
    id: int
    ngo_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    certificate_80g_number: Optional[str] = None
    certificate_12a_number: Optional[str] = None
    description: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class NGOAccountResponse(BaseModel):
    id: int
    ngo_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    certificate_80g_number: Optional[str] = None
    certificate_12a_number: Optional[str] = None
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class NGOAccountCreateByAdmin(BaseModel):
    ngo_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    certificate_80g_number: str
    certificate_12a_number: str
    description: Optional[str] = None
    password: str


class NGOAccountUpdateByAdmin(BaseModel):
    ngo_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    certificate_80g_number: Optional[str] = None
    certificate_12a_number: Optional[str] = None
    description: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    username: str

class MatchConfirm(BaseModel):
    volunteer_id: int
    request_id: int

class MatchResponse(BaseModel):
    id: int
    volunteer_id: int
    request_id: int
    score: float
    status: str
    eta_minutes: Optional[int] = None
    eta_text: Optional[str] = None
    request: Optional[NGORequestResponse] = None

    class Config:
        from_attributes = True


class MatchLiveResponse(BaseModel):
    id: int
    status: str
    progress_percent: float
    eta_minutes: int
    eta_text: Optional[str] = None
    eta_arrival_time: Optional[str] = None
    status_message: str
    request: Optional[NGORequestResponse] = None
