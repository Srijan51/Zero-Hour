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


_ensure_ngo_certificate_columns()

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
