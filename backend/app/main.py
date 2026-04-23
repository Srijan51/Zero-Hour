from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, SessionLocal, engine
from app.routers import admin, match, ngo, volunteer
from app.routers.admin import ensure_default_admin

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zero Hour API")

# Configure CORS for PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, set to FRONTEND_URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(volunteer.router)
app.include_router(ngo.router)
app.include_router(match.router)
app.include_router(admin.router)


@app.on_event("startup")
def setup_default_admin():
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Zero Hour API is running"}
