# Zero Hour — Crisis Dispatch Platform

> **Voice-driven, AI-powered volunteer dispatch for crisis response.**
> Built for the Google Solution Challenge 2026.

Zero Hour connects crisis-affected communities with nearby volunteers in real time. Volunteers speak their skills and availability, AI matches them to the closest NGO requests, and live GPS tracking ensures mission accountability from start to finish.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [User Flows](#user-flows)
- [API Reference](#api-reference)
- [Data Storage](#data-storage)
- [Demo Flow](#demo-flow)

---

## Features

### 🎙️ Voice-Driven Dispatch
- Volunteers tap a button and speak naturally: *"I have a 4x4 vehicle and first aid training, free for 4 hours"*
- Google Gemini 1.5 Flash parses the transcript into structured skills, assets, and availability
- Falls back to a mock NLP parser when no API key is configured
- Also supports manual text entry via "Type instead" for accessibility

### 🧠 Intelligent Matching Algorithm
- Weighted scoring system that evaluates **skills match**, **asset match**, and **proximity** (GPS-based)
- Semantic normalization: "car", "jeep", "SUV" all map to "vehicle"; "first aid" → "first_aid"
- Multi-word alias detection handles phrases like "4x4 vehicle", "heavy lifting", "construction tools"
- Dynamic weight adjustment: if only assets are required, they get 85% weight; if both skills + assets, they split 40/45
- Proximity calculated via haversine formula — closer volunteers score higher
- Match scores displayed as percentages with real-time ranked results

### 📍 Accurate Geolocation
- High-accuracy browser geolocation with `enableHighAccuracy: true`
- Aggressive cache freshness: `maximumAge: 3000ms` for dispatch-time position, `5000ms` for initial load
- Continuous position tracking via `watchPosition` for live updates
- Position refreshed at dispatch time to ensure the most accurate volunteer coordinates are sent to the backend

### 🛰️ Live GPS Tracking & Accountability
- After accepting a mission, the volunteer's app sends GPS coordinates to the backend **every 15 seconds**
- NGO dashboard shows a **real-time progress bar** with the volunteer's status (EN ROUTE → NEARBY → ON SITE)
- Progress is calculated from actual GPS distance, not just elapsed time
- ETA sourced from Google Maps Distance Matrix API (falls back to haversine estimate)

### 📱 Phone-Based Identity (No Login Required)
- Volunteers are **not** required to create an account — zero friction for crisis response
- Phone number and name are collected **only at "Accept Mission" time**
- Saved in `localStorage` for repeat use — only asked once per device
- NGO can see the volunteer's name and phone, with a clickable `tel:` link to call directly

### 🚨 Smart No-Show Detection
- A volunteer is flagged as a no-show **only when GPS pings stop entirely** for 5+ minutes (app closed/abandoned)
- **Not flagged** when the volunteer is still pinging but stationary (stuck in traffic) — the system distinguishes between "abandoned" and "delayed"
- Volunteers have an **"I'm delayed"** button for proactive communication with the NGO
- No-show is always just a **warning** to the NGO — never auto-cancels the mission
- NGO can click **"Re-broadcast"** to cancel the no-show match and re-open the request for other volunteers

### ✅ Dual-Confirmation Task Completion
- **Arrival gate**: "Mark Task Done" button is disabled until the volunteer is within **200 meters** of the target location (haversine-verified server-side)
- Volunteer marks task done → request status becomes **`pending_confirmation`**
- NGO sees a confirmation prompt with two options:
  - **"Confirm Done"** → mission marked completed ✓
  - **"Dispute"** → match cancelled, request re-opened for other volunteers
- This prevents volunteers from marking tasks done without actually helping

### 📊 Live Dashboard (Real Data)
- Home page stats (Active Needs, Volunteers, Matched) are fetched from the `/stats` API endpoint — **no hardcoded values**
- Stats auto-refresh every 10 seconds
- NGO dashboard shows live feed of all active requests with auto-refresh every 5 seconds

### 🏢 NGO Command Center (`/ngo`)
- Authenticated NGO accounts can **broadcast crisis requests** with:
  - Task description
  - Required skills and assets
  - Location (via Photon geocoder autocomplete)
  - Urgency level (Low → Emergency slider)
- Live feed shows all requests with status badges: **Open**, **Matched**, **Confirm?**, **Completed**
- For matched requests, the dashboard shows:
  - Volunteer name and phone (clickable)
  - Live progress bar with GPS-based tracking
  - "Volunteer reported a delay" notification
  - Cancellation and no-show alerts with a persistent re-broadcast option
  - Confirm/Dispute buttons for task completion

### 🔐 NGO Registration & Admin Approval
- NGOs register at `/register` with organization details and 80G/12A certificate numbers
- Registration goes to **pending** status
- Admins approve or reject from the Admin Panel (`/admin`)
- Only approved NGOs can log in and broadcast requests

### 🛡️ Admin Panel (`/admin`)
- Protected admin dashboard with session-based authentication
- Approve/reject pending NGO registrations
- Add NGO accounts directly (bypass registration)
- Edit NGO details and reset passwords
- Delete NGO accounts (cascading cleanup of requests, registrations, and sessions)
- Smooth slide-up and fade-in transitions

### 📱 Progressive Web App (PWA)
- Installable on mobile devices with "Add to Home Screen"
- Service worker for offline caching
- Offline banner shown when connection is lost
- Update prompt when a new version is available
- Responsive design: mobile-first with full desktop support

### 🗺️ Google Maps Integration
- Directions URL built with `origin`, `destination`, and `travelmode=driving`
- Opens directly via `window.location.href` (avoids popup blocker issues)
- Fallback anchor tag ensures the link always works even if JavaScript fails
- ETA powered by Google Maps Distance Matrix API when API key is configured

---

## Architecture

```
┌──────────────┐     Voice/Text       ┌──────────────────┐    HTTP/REST      ┌─────────────────┐
│   Volunteer  │ ──────────────────▶ |   React PWA      │ ──────────────▶  │  FastAPI Backend│
│   (Browser)  │ ◀────GPS Pings────  │   (Vite + PWA)   │ ◀─────JSON────   │  (Python 3.11+) │
└──────────────┘                      └──────────────────┘                  └────────┬────────┘
                                             │                                       │
                                             │                              ┌────────▼────────┐
                                      ┌──────▼──────┐                       │   SQLite / PG   │
                                      │  NGO Panel  │                       │   Database      │
                                      │ Admin Panel │                       └────────┬────────┘
                                      └─────────────┘                                │
                                                                            ┌────────▼────────┐
                                                                            │  Google Gemini  │
                                                                            │  (NLP Parsing)  │
                                                                            ├─────────────────┤
                                                                            │  Distance Matrix│
                                                                            │  (ETA / Routing)│
                                                                            └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| PWA | vite-plugin-pwa, Workbox |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (default), PostgreSQL (optional) |
| AI/NLP | Google Gemini 1.5 Flash |
| Maps | Google Maps Distance Matrix API, Photon Geocoder |
| Auth | Session tokens (in-memory), bcrypt password hashing |
| Icons | Lucide React |

---

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in the values. The backend supports **mock mode** if API keys are not provided.

```env
GOOGLE_GEMINI_API_KEY=       # For NLP transcript parsing (optional — mock mode available)
GOOGLE_MAPS_API_KEY=         # For real driving ETAs (optional — haversine fallback)
GOOGLE_STT_API_KEY=          # For speech-to-text (optional — uses Web Speech API as fallback)
ADMIN_USERNAME=admin         # Default admin login
ADMIN_PASSWORD=admin123      # Default admin password
```

### 2. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows
# source venv/bin/activate    # Linux/Mac
pip install -r requirements.txt
python -m app.seed            # Seed 20 mock NGO requests (optional)
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## User Flows

### Volunteer Flow
1. Open the app → Map loads with live crisis markers
2. Tap the mic and speak (or type): *"I have a vehicle and medical training"*
3. AI parses transcript → top NGO matches ranked by score
4. Tap **"Accept Mission"** → phone/name prompt (one-time)
5. GPS tracking starts → progress bar shows en route status
6. Tap **"I'm delayed"** if stuck in traffic
7. Arrive within 200m → **"Mark Task Done"** unlocks
8. Mark done → wait for NGO confirmation

### NGO Flow
1. Register at `/register` → wait for admin approval
2. Login at `/ngo` → see live request feed
3. **"Broadcast New Request"** → fill task, skills, assets, location, urgency
4. See volunteer accept → track live progress + GPS
5. Get notified of delays, cancellations, and no-shows
6. Use **"Re-broadcast"** at any time to reopen a request for other volunteers
7. **"Confirm Done"** or **"Dispute"** when volunteer marks task complete

### Admin Flow
1. Login at `/admin` with admin credentials
2. Approve/reject pending NGO registrations
3. Manage NGO accounts (add, edit, delete)

---

## API Reference

### Volunteer Dispatch
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/volunteer/dispatch` | Submit voice transcript + GPS → get matched requests |

### 4. Hosting (production)

This repository is set up to serve the frontend using Firebase Hosting and to run the backend as a containerized service (recommended: Cloud Run). The steps below show a common production workflow.

Frontend (Firebase Hosting)

1. Build the static site:

```bash
cd frontend
npm run build
```

2. Initialize hosting (one-time) and choose `dist` as the public directory:

```bash
firebase init hosting
```

3. Deploy:

```bash
firebase deploy --only hosting
```

Notes:
- The `frontend/firebase.json` file contains a rewrite rule so the SPA works with client-side routing.
- Use `frontend/.firebaserc` to store a project alias for CI/CD.

Backend (Cloud Run - recommended)

1. Build a container image (example using Google Cloud Build):

```bash
# From repository root
gcloud builds submit --tag gcr.io/PROJECT_ID/zero-hour-backend:latest backend
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy zero-hour-backend \
  --image gcr.io/PROJECT_ID/zero-hour-backend:latest \
  --platform managed --region REGION --allow-unauthenticated --port 8080
```

3. Set environment variables in Cloud Run (e.g., `GOOGLE_MAPS_API_KEY`, `ADMIN_PASSWORD`).

If you prefer another hosting provider (App Service, EC2, Railway, Fly.io), deploy the container with equivalent configuration.

Connecting frontend to backend

By default the frontend expects the API at the same origin. For production, set `FRONTEND_API_BASE_URL` in the built app (or configure a reverse proxy). When deploying to Firebase Hosting you can proxy API calls to your backend domain using `firebase.json` rewrites or configure the frontend to use the absolute Cloud Run URL.
| `admin_accounts` | Admin users with hashed passwords |

### Request Status Lifecycle

```
open → matched → pending_confirmation → completed
         ↓ (no-show / dispute)
       open (re-broadcast)
```

---

## Demo Flow

1. **Start backend**: `uvicorn app.main:app --reload`
2. **Start frontend**: `npm run dev`
3. **Volunteer**: Open `/` → Speak: *"I have a 4x4 vehicle and basic first aid"* → Accept a match → See GPS tracking
4. **NGO**: Open `/ngo` → Login → See volunteer tracked in real time → Confirm task completion
5. **Admin**: Open `/admin` → Manage NGO registrations and accounts

---

<p align="center">
  <b>Zero Hour</b> — When every second counts.
</p>
