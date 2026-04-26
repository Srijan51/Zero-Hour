from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.database import Base, SessionLocal, engine
from app.routers import admin, match, ngo, volunteer
from app.routers.admin import ensure_default_admin

# Create database tables
Base.metadata.create_all(bind=engine)


def _ensure_ngo_certificate_columns() -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    
    ngo_account_columns = {column["name"] for column in inspector.get_columns("ngo_accounts")}
    ngo_registration_columns = {column["name"] for column in inspector.get_columns("ngo_registrations")}
    ngo_request_columns = {column["name"] for column in inspector.get_columns("ngo_requests")}
    match_columns = {column["name"] for column in inspector.get_columns("matches")}

    with engine.begin() as connection:
        if "certificate_80g_number" not in ngo_account_columns:
            connection.execute(text("ALTER TABLE ngo_accounts ADD COLUMN certificate_80g_number VARCHAR"))
        if "certificate_12a_number" not in ngo_account_columns:
            connection.execute(text("ALTER TABLE ngo_accounts ADD COLUMN certificate_12a_number VARCHAR"))
        if "certificate_80g_number" not in ngo_registration_columns:
            connection.execute(text("ALTER TABLE ngo_registrations ADD COLUMN certificate_80g_number VARCHAR"))
        if "certificate_12a_number" not in ngo_registration_columns:
            connection.execute(text("ALTER TABLE ngo_registrations ADD COLUMN certificate_12a_number VARCHAR"))

        if "location_text" not in ngo_request_columns:
            connection.execute(text("ALTER TABLE ngo_requests ADD COLUMN location_text VARCHAR"))
        if "google_maps_url" not in ngo_request_columns:
            connection.execute(text("ALTER TABLE ngo_requests ADD COLUMN google_maps_url VARCHAR"))

        if "created_at" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN created_at DATETIME"))
        if "updated_at" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN updated_at DATETIME"))

        connection.execute(text("UPDATE matches SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
        connection.execute(text("UPDATE matches SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))

        if "eta_minutes" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN eta_minutes INTEGER"))
        if "eta_text" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN eta_text VARCHAR"))

        # Volunteer accountability columns
        volunteer_columns = {column["name"] for column in inspector.get_columns("volunteers")}
        if "phone" not in volunteer_columns:
            connection.execute(text("ALTER TABLE volunteers ADD COLUMN phone VARCHAR"))
        if "name" not in volunteer_columns:
            connection.execute(text("ALTER TABLE volunteers ADD COLUMN name VARCHAR"))

        # Match tracking columns
        if "volunteer_lat" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN volunteer_lat FLOAT"))
        if "volunteer_lng" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN volunteer_lng FLOAT"))
        if "last_ping_at" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN last_ping_at DATETIME"))
        if "no_show_flagged" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN no_show_flagged BOOLEAN DEFAULT 0"))
        if "arrived_at" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN arrived_at DATETIME"))
        if "delay_notified_at" not in match_columns:
            connection.execute(text("ALTER TABLE matches ADD COLUMN delay_notified_at DATETIME"))

        # Migrate legacy 90G values into the new 80G columns when present.
        if "certificate_90g_number" in ngo_account_columns:
            connection.execute(text(
                """
                UPDATE ngo_accounts
                SET certificate_80g_number = certificate_90g_number
                WHERE (certificate_80g_number IS NULL OR certificate_80g_number = '')
                  AND certificate_90g_number IS NOT NULL
                  AND certificate_90g_number != ''
                """
            ))
        if "certificate_90g_number" in ngo_registration_columns:
            connection.execute(text(
                """
                UPDATE ngo_registrations
                SET certificate_80g_number = certificate_90g_number
                WHERE (certificate_80g_number IS NULL OR certificate_80g_number = '')
                  AND certificate_90g_number IS NOT NULL
                  AND certificate_90g_number != ''
                """
            ))

def _ensure_volunteer_columns() -> None:
    inspector = inspect(engine)
    
    
    if "volunteers" in inspector.get_table_names():
        volunteer_columns = {column["name"] for column in inspector.get_columns("volunteers")}
        
        with engine.begin() as connection:
            if "phone" not in volunteer_columns:
                connection.execute(text("ALTER TABLE volunteers ADD COLUMN phone VARCHAR"))
            if "name" not in volunteer_columns:
                connection.execute(text("ALTER TABLE volunteers ADD COLUMN name VARCHAR"))

_ensure_ngo_certificate_columns()
_ensure_volunteer_columns()


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


@app.get("/stats")
def get_stats():
    """Return live platform statistics from the database."""
    from datetime import datetime, timedelta, timezone
    from app.models import Match, NGORequest, Volunteer

    db = SessionLocal()
    try:
        open_requests = db.query(NGORequest).filter(NGORequest.status == "open").count()
        matched_count = db.query(NGORequest).filter(NGORequest.status == "matched").count()

        # Count volunteers from the last 24 hours (active volunteers)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        total_volunteers = db.query(Volunteer).count()

        # Average match time: use the latest 20 matches to compute average creation gap
        recent_matches = (
            db.query(Match)
            .filter(Match.eta_minutes.isnot(None))
            .order_by(Match.id.desc())
            .limit(20)
            .all()
        )
        if recent_matches:
            avg_eta = sum(m.eta_minutes for m in recent_matches if m.eta_minutes) / len(recent_matches)
        else:
            avg_eta = 0

        return {
            "open_requests": open_requests,
            "matched_count": matched_count,
            "total_volunteers": total_volunteers,
            "avg_eta_minutes": round(avg_eta, 1),
        }
    finally:
        db.close()
