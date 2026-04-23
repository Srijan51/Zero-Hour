# Zero Hour

Zero Hour is a voice-driven volunteer dispatch PWA.

## Architecture

```text
[Volunteer] --- (Voice web API) ---> [ React PWA ] <--- (FCM Notifications) --- [NGO Dashboard]
                                         |
                                         v
                                [ FastAPI Backend ] 
                                 /               \
                  (Audio / Text) v               v (DB calls)
                    [ Gemini 1.5 Flash ]   [ PostgreSQL / SQLite ]
```

## Setup

1. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the values.
   (The backend supports a MOCK MODE if API keys are not provided!)

   Admin credentials can be configured with:
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```
   If not provided, defaults are used.

2. **Backend**:
   ```bash
   cd backend
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m app.seed   # Generate mock NGO requests
   uvicorn app.main:app --reload
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## NGO Authentication

1. Open `/register` to submit NGO details and a password.
2. An admin reviews pending requests in `/admin` and approves/rejects them.
3. Approved NGOs are stored in database and can login at `/ngo`.
4. Only authenticated NGOs can access NGO Command and broadcast new requests.

## Data Storage

NGO and admin records are stored in the backend database configured in [backend/app/database.py](backend/app/database.py).

- Default database URL: `sqlite:///./zero_hour.db`
- Default SQLite file name: `zero_hour.db` (created in the backend working directory on first run)
- Default SQLite file path in this repo: `backend/zero_hour.db`
- Override with `DATABASE_URL` to use PostgreSQL or another SQLAlchemy-supported database.

Relevant tables:

- `ngo_accounts`: approved NGO accounts and hashed passwords
- `ngo_registrations`: pending/approved/rejected NGO registration requests
- `admin_accounts`: admin users and hashed passwords
- `ngo_requests`: NGO broadcast requests

When an NGO is deleted from the Admin Panel, related NGO data is removed from the database as part of the delete flow:

- NGO account row is deleted from `ngo_accounts`
- NGO registration rows for that NGO are deleted from `ngo_registrations`
- NGO requests created by that NGO are deleted from `ngo_requests`
- Active NGO auth sessions are invalidated

## Admin Panel

1. Open `/admin`.
2. Login with admin credentials (default: `admin` / `admin123`).
3. Admins can:
   - Approve/reject NGO registration requests.
   - Add NGO accounts directly.
   - Edit NGO details and optionally reset NGO passwords.
   - Delete registered NGO accounts.
   - Use session-based toast notifications for action feedback.

Admin login UX:

- Back button is available on the admin login screen.
- Toast notifications are stored for the browser session and shown on login/dashboard screens.

## Demo Flow
1. Load Frontend. Accept Mic Permissions.
2. Speak: "I have a 4x4 vehicle and basic first aid."
3. Backend processes data using Gemini (or Mock Mode).
4. See matched NGO requests visually on the map!
