import os
from fastapi import UploadFile

GOOGLE_STT_API_KEY = os.getenv("GOOGLE_STT_API_KEY")

async def transcribe_audio(audio_file: UploadFile) -> str:
    """
    Mock implementation of STT.
    Since we plan to use Web Speech API on the frontend, this might not even be called.
    But if the backend needs to process audio, we provide a mock.
    """
    if not GOOGLE_STT_API_KEY:
        print("MOCK STT: No GOOGLE_STT_API_KEY provided. Returning mock transcript.")
        return "I have a 4x4 vehicle, two hours free, and basic first aid skills."
    
    # In a real scenario, you would use google-cloud-speech here.
    # We will just return the same string to keep the dependencies light for the hackathon prototype.
    return "I have a 4x4 vehicle, two hours free, and basic first aid skills."
