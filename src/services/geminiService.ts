import { GoogleGenAI, Type } from "@google/genai";
import { VolunteerProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseVolunteerInput(transcript: string): Promise<VolunteerProfile> {
  const prompt = `
    Analyze the following volunteer availability transcript and extract structured information.
    Transcript: "${transcript}"
    
    Extract:
    - intent: either 'help' or 'other'
    - skills: an array of skills mentioned (e.g., 'first aid', 'driving', 'cooking')
    - assets: an array of physical assets mentioned (e.g., '4x4 vehicle', 'boat', 'drone')
    - availability_hours: estimated number of hours available (default to 1 if not mentioned)
    - area: any location or landmark mentioned (e.g., 'Park Street', 'near the stadium', 'Salt Lake')
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["intent", "skills", "assets", "availability_hours", "area"],
        properties: {
          intent: { type: Type.STRING, enum: ["help", "other"] },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          assets: { type: Type.ARRAY, items: { type: Type.STRING } },
          availability_hours: { type: Type.NUMBER },
          area: { type: Type.STRING },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text);
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: 'Volunteer',
    intent: parsed.intent,
    skills: parsed.skills,
    assets: parsed.assets,
    availability_hours: parsed.availability_hours,
    area: parsed.area,
    location: { lat: 22.5726, lng: 88.3639 }, // Mock current location
  };
}
