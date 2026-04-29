from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class VolunteerBase(BaseModel):
    intent: Optional[str] = None
    skills: List[str] = []
    assets: List[str] = []
    availability_hours: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    name: Optional[str] = None

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
    volunteers_needed: int = 1
    volunteers_matched: int = 0
    last_escalated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

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
    volunteers_needed: int = 1

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


class AdminNGORequestUpdate(BaseModel):
    ngo_name: Optional[str] = None
    task_description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    required_assets: Optional[List[str]] = None
    location_text: Optional[str] = None
    google_maps_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    urgency: Optional[int] = None
    status: Optional[str] = None


class AdminNGORequestResponse(NGORequestResponse):
    class Config:
        from_attributes = True

class MatchConfirm(BaseModel):
    volunteer_id: int
    request_id: int
    phone: Optional[str] = None
    name: Optional[str] = None

class CheckinRequest(BaseModel):
    lat: float
    lng: float


class EtaFeedbackRequest(BaseModel):
    on_time: bool
    actual_minutes: Optional[int] = None

class MatchResponse(BaseModel):
    id: int
    volunteer_id: int
    request_id: int
    score: float
    status: str
    created_at: Optional[datetime] = None
    eta_minutes: Optional[int] = None
    eta_text: Optional[str] = None
    volunteer_lat: Optional[float] = None
    volunteer_lng: Optional[float] = None
    no_show_flagged: bool = False
    arrived_at: Optional[datetime] = None
    delay_notified_at: Optional[datetime] = None
    actual_arrival_minutes: Optional[int] = None
    eta_feedback_given: bool = False
    request: Optional[NGORequestResponse] = None
    volunteer_phone: Optional[str] = None
    volunteer_name: Optional[str] = None

    class Config:
        from_attributes = True


class MatchLiveResponse(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None
    progress_percent: float
    eta_minutes: int
    eta_text: Optional[str] = None
    eta_arrival_time: Optional[str] = None
    status_message: str
    volunteer_lat: Optional[float] = None
    volunteer_lng: Optional[float] = None
    no_show_flagged: bool = False
    delay_notified_at: Optional[datetime] = None
    actual_arrival_minutes: Optional[int] = None
    eta_feedback_given: bool = False
    arrived: bool = False
    volunteer_phone: Optional[str] = None
    volunteer_name: Optional[str] = None
    request: Optional[NGORequestResponse] = None
