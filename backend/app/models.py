from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON
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
    
    matches = relationship("Match", back_populates="volunteer")

class NGORequest(Base):
    __tablename__ = "ngo_requests"

    id = Column(Integer, primary_key=True, index=True)
    ngo_name = Column(String, index=True)
    task_description = Column(String)
    required_skills = Column(JSON, default=[])
    required_assets = Column(JSON, default=[])
    lat = Column(Float)
    lng = Column(Float)
    urgency = Column(Integer, default=3)
    status = Column(String, default="open") # open, matched, completed
    
    matches = relationship("Match", back_populates="request")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"))
    request_id = Column(Integer, ForeignKey("ngo_requests.id"))
    score = Column(Float)
    status = Column(String, default="pending") # pending, en_route, on_site, completed

    volunteer = relationship("Volunteer", back_populates="matches")
    request = relationship("NGORequest", back_populates="matches")
