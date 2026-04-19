export type Urgency = 1 | 2 | 3 | 4 | 5;

export interface NGORequest {
  id: string;
  ngoName: string;
  taskType: string;
  description: string;
  skillsRequired: string[];
  assetsRequired: string[];
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  urgency: Urgency;
  createdAt: number;
}

export interface VolunteerProfile {
  id: string;
  name: string;
  intent: 'help' | 'other';
  skills: string[];
  assets: string[];
  availability_hours: number;
  location: {
    lat: number;
    lng: number;
  };
  area?: string;
}

export interface MatchResult {
  request: NGORequest;
  score: number;
  distance: number;
}

export type AppScreen = 'home' | 'voice' | 'results' | 'confirmation' | 'dashboard';
