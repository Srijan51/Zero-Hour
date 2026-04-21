# Zero Hour

Zero Hour is a voice-driven volunteer dispatch PWA built for the Google Solution Challenge 2026.

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

2. **Backend**:
   ```bash
   cd backend
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

## Demo Flow
1. Load Frontend. Accept Mic Permissions.
2. Speak: "I have a 4x4 vehicle and basic first aid."
3. Backend processes data using Gemini (or Mock Mode).
4. See matched NGO requests visually on the map!
