import random
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models import NGOAccount, NGORequest
from app.routers.admin import ensure_default_admin  # <-- Added this import
from app.services.auth import hash_password

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

dummy_ngos = [
    {
        "ngo_name": "Red Cross Kolkata",
        "email": "redcross.kolkata@example.com",
        "phone": "+91-9000000001",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-RCK-001",
        "certificate_12a_number": "12A-RCK-001",
        "description": "Disaster response and relief coordination.",
    },
    {
        "ngo_name": "Doctors Without Borders",
        "email": "msf.india@example.com",
        "phone": "+91-9000000002",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-MSF-002",
        "certificate_12a_number": "12A-MSF-002",
        "description": "Emergency medical aid and field health camps.",
    },
    {
        "ngo_name": "Save the Children",
        "email": "save.children@example.com",
        "phone": "+91-9000000003",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-STC-003",
        "certificate_12a_number": "12A-STC-003",
        "description": "Child welfare, evacuation support, and shelter relief.",
    },
    {
        "ngo_name": "Kolkata Rescue",
        "email": "kolkata.rescue@example.com",
        "phone": "+91-9000000004",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-KR-004",
        "certificate_12a_number": "12A-KR-004",
        "description": "Local rescue and flood response network.",
    },
    {
        "ngo_name": "Hope Foundation",
        "email": "hope.foundation@example.com",
        "phone": "+91-9000000005",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-HF-005",
        "certificate_12a_number": "12A-HF-005",
        "description": "Shelter setup, logistics, and emergency support.",
    },
    {
        "ngo_name": "Animal Welfare Board",
        "email": "animal.welfare@example.com",
        "phone": "+91-9000000006",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-AWB-006",
        "certificate_12a_number": "12A-AWB-006",
        "description": "Animal rescue and care during disasters.",
    },
    {
        "ngo_name": "Rotary Club",
        "email": "rotary.club@example.com",
        "phone": "+91-9000000007",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-RC-007",
        "certificate_12a_number": "12A-RC-007",
        "description": "Community relief and infrastructure support.",
    },
    {
        "ngo_name": "Goonj",
        "email": "goonj@example.com",
        "phone": "+91-9000000008",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-GOONJ-008",
        "certificate_12a_number": "12A-GOONJ-008",
        "description": "Clothing, materials, and relief distribution.",
    },
    {
        "ngo_name": "Oxfam India",
        "email": "oxfam.india@example.com",
        "phone": "+91-9000000009",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-OXFAM-009",
        "certificate_12a_number": "12A-OXFAM-009",
        "description": "Water, sanitation, and emergency response.",
    },
    {
        "ngo_name": "Care India",
        "email": "care.india@example.com",
        "phone": "+91-9000000010",
        "address": "Kolkata, West Bengal",
        "certificate_80g_number": "80G-CI-010",
        "certificate_12a_number": "12A-CI-010",
        "description": "Health, logistics, and disaster support.",
    },
]

def seed_data():
    db = SessionLocal()
    try:
        # 1. Create the default admin if it doesn't exist.
        print("Checking for default admin account...")
        try:
            ensure_default_admin(db)
            print("Admin account is ready.")
        except Exception as e:
            print(f"Error creating admin: {e}")

        # 2. Seed mock NGO accounts for the admin panel.
        inserted_ngos = 0
        for profile in dummy_ngos:
            existing_ngo = db.query(NGOAccount).filter(
                (NGOAccount.ngo_name == profile["ngo_name"]) | (NGOAccount.email == profile["email"])
            ).first()
            if existing_ngo:
                continue

            ngo = NGOAccount(
                ngo_name=profile["ngo_name"],
                email=profile["email"],
                phone=profile["phone"],
                address=profile["address"],
                certificate_80g_number=profile["certificate_80g_number"],
                certificate_12a_number=profile["certificate_12a_number"],
                description=profile["description"],
                password_hash=hash_password("seeded-demo-password"),
                is_active=True,
            )
            db.add(ngo)
            inserted_ngos += 1

        # 3. Existing NGO request seeding logic.
        existing_requests = db.query(NGORequest).count()
        if existing_requests > 0:
            print("NGO Request data already seeded.")
        else:
            for i in range(10):
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
        if inserted_ngos > 0:
            print(f"Successfully seeded {inserted_ngos} NGO accounts.")
        if existing_requests == 0:
            print("Successfully seeded 10 NGO requests.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()