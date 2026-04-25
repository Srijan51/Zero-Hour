import os
import json
from google import genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

def parse_volunteer_speech(transcript: str) -> dict:
    if not GEMINI_API_KEY:
        print("MOCK GEMINI: No GEMINI_API_KEY provided. Returning mock structured data.")
        return {
            "intent": "help",
            "skills": ["first aid"],
            "assets": ["4x4 vehicle"],
            "availability_hours": 2.0,
            "location": None
        }

    prompt = f"""
You are a volunteer profile parser for a crisis dispatch system.
Extract structured data from the user's speech. Return ONLY valid JSON, no markdown:
{{
"intent": "help",
"skills": ["list of skills"],
"assets": ["list of physical assets"],
"availability_hours": <number or null>,
"location": null
}}

IMPORTANT: Use ONLY these canonical terms for skills and assets when applicable:
- Skills: "first aid", "medical", "driving", "swimming", "construction", "heavy lifting", "childcare", "animal handling", "logistics", "plumbing", "electrical", "technical", "organization"
- Assets: "vehicle", "4x4 vehicle", "boat", "generator", "ambulance", "tools", "carriers"

Map user language to these terms. For example:
- "car" / "jeep" / "SUV" / "truck" → "vehicle"
- "four-wheel drive" / "4WD" / "off-road vehicle" → "4x4 vehicle"
- "I can drive" → skill: "driving"
- "medical training" / "paramedic" / "nurse" / "doctor" → "medical"
- "first aid kit" → skill: "first aid"
- "I can swim" → skill: "swimming"
- "construction experience" → skill: "construction"

If a field is not mentioned, use null or empty array. Never return anything outside the JSON object.

Speech: "{transcript}"
"""
    try:
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt,
        )
        # Strip markdown if present
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        # Graceful fallback on error
        return {
            "intent": "help",
            "skills": [],
            "assets": [],
            "availability_hours": None,
            "location": None
        }
