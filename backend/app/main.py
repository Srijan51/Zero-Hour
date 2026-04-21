from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import volunteer, ngo, match

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

@app.get("/")
def read_root():
    return {"message": "Zero Hour API is running"}
