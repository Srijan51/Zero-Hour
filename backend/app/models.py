from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True, index=True)
    intent = Column(String, nullable=True)
    skills = Column(JSON, default=[])
    assets = Column(JSON, default=[])
    availability_hours = Column(Float, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    phone = Column(String, nullable=True)
    name = Column(String, nullable=True)
    
    matches = relationship("Match", back_populates="volunteer")

class NGORequest(Base):
    __tablename__ = "ngo_requests"

    id = Column(Integer, primary_key=True, index=True)
    ngo_name = Column(String, index=True)
    task_description = Column(String)
    required_skills = Column(JSON, default=[])
    required_assets = Column(JSON, default=[])
    location_text = Column(String, nullable=True)
    google_maps_url = Column(String, nullable=True)
    lat = Column(Float)
    lng = Column(Float)
    urgency = Column(Integer, default=3)
    status = Column(String, default="open") # open, matched, pending_confirmation, completed
    
    matches = relationship("Match", back_populates="request")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"))
    request_id = Column(Integer, ForeignKey("ngo_requests.id"))
    score = Column(Float)
    status = Column(String, default="pending") # pending, en_route, nearby, on_site, pending_confirmation, completed, cancelled
    eta_minutes = Column(Integer, nullable=True)
    eta_text = Column(String, nullable=True)
    volunteer_lat = Column(Float, nullable=True)      # Latest GPS ping from volunteer
    volunteer_lng = Column(Float, nullable=True)      # Latest GPS ping from volunteer
    last_ping_at = Column(DateTime(timezone=True), nullable=True)  # When last GPS was received
    no_show_flagged = Column(Boolean, default=False)   # True when pings stopped for 5+ min
    arrived_at = Column(DateTime(timezone=True), nullable=True)    # When volunteer reached ~200m of target
    delay_notified_at = Column(DateTime(timezone=True), nullable=True)  # When volunteer tapped "I'm delayed"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    volunteer = relationship("Volunteer", back_populates="matches")
    request = relationship("NGORequest", back_populates="matches")


class NGOAccount(Base):
    __tablename__ = "ngo_accounts"

    id = Column(Integer, primary_key=True, index=True)
    ngo_name = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    certificate_80g_number = Column(String, nullable=True)
    certificate_12a_number = Column(String, nullable=True)
    description = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NGORegistration(Base):
    __tablename__ = "ngo_registrations"

    id = Column(Integer, primary_key=True, index=True)
    ngo_name = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    certificate_80g_number = Column(String, nullable=True)
    certificate_12a_number = Column(String, nullable=True)
    description = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    reviewed_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AdminAccount(Base):
    __tablename__ = "admin_accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_superadmin = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
