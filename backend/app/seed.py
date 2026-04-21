import random
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import NGORequest

Base.metadata.create_all(bind=engine)

# Set roughly around Kolkata region
# Center: 22.5726° N, 88.3639° E
LAT_START = 22.50
LAT_END = 22.65
LNG_START = 88.30
LNG_END = 88.42

dummy_requests = [
    {"ngo": "Red Cross Kolkata", "task": "Flood relief — need vehicle to transport supplies", "skills": ["driving"], "assets": ["vehicle"]},
    {"ngo": "Doctors Without Borders", "task": "Medical camp — need first aid trained volunteer", "skills": ["first aid", "medical"], "assets": []},
    {"ngo": "Save the Children", "task": "Evacuation assistance for local orphanage", "skills": ["childcare"], "assets": ["boat", "vehicle"]},
    {"ngo": "Kolkata Rescue", "task": "Food distribution in flooded streets", "skills": ["swimming", "logistics"], "assets": []},
    {"ngo": "Hope Foundation", "task": "Emergency shelter setup", "skills": ["construction", "heavy lifting"], "assets": ["tools"]},
    {"ngo": "Animal Welfare Board", "task": "Rescue stranded pets", "skills": ["animal handling"], "assets": ["vehicle", "carriers"]},
    {"ngo": "Rotary Club", "task": "Deliver water purifiers", "skills": [], "assets": ["4x4 vehicle"]},
    {"ngo": "Goonj", "task": "Sort clothes and materials", "skills": ["organization"], "assets": []},
    {"ngo": "Oxfam India", "task": "Setup temporary sanitation facilities", "skills": ["plumbing", "construction"], "assets": []},
    {"ngo": "Care India", "task": "Generator operator needed for hospital", "skills": ["technical", "electrical"], "assets": ["generator"]},
]

def seed_data():
    db = SessionLocal()
    existing = db.query(NGORequest).count()
    if existing > 0:
        print("Data already seeded.")
        return
    
    for i in range(20):
        template = random.choice(dummy_requests)
        req = NGORequest(
            ngo_name=f"{template['ngo']} (Station {i+1})",
            task_description=template['task'],
            required_skills=template['skills'],
            required_assets=template['assets'],
            lat=random.uniform(LAT_START, LAT_END),
            lng=random.uniform(LNG_START, LNG_END),
            urgency=random.randint(2, 5),
            status="open"
        )
        db.add(req)
        
    db.commit()
    print("Successfully seeded 20 NGO requests.")

if __name__ == "__main__":
    seed_data()
