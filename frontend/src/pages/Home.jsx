import React, { useState } from 'react';
import MapView from '../components/MapView';
import VoiceCapture from '../components/VoiceCapture';
import MatchResults from '../components/MatchResults';
import api from '../services/api';

export default function Home() {
  const [matches, setMatches] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  
  // Dummy location for Kolkata since getting exact geolocation might fail in some dev envs
  const currentLat = 22.5726;
  const currentLng = 88.3639;

  const handleTranscript = async (transcript) => {
    try {
      const formData = new FormData();
      formData.append('transcript', transcript);
      formData.append('lat', currentLat);
      formData.append('lng', currentLng);

      const response = await api.post('/volunteer/dispatch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setVolunteerId(response.data.volunteer.id);
      setMatches(response.data.matches);
    } catch (error) {
      console.error("Dispatch error", error);
      alert("Failed to connect to backend. Make sure the server is running!");
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <div className="absolute inset-0 z-0 bg-slate-200">
        <MapView 
           userLat={currentLat} 
           userLng={currentLng} 
           markerData={matches || []} 
        />
      </div>
      
      <div className="mt-auto relative z-10 w-full">
        {matches ? (
           <MatchResults 
             matches={matches} 
             volunteerId={volunteerId}
             onReset={() => setMatches(null)}
           />
        ) : (
           <VoiceCapture onTranscriptComplete={handleTranscript} />
        )}
      </div>
    </div>
  );
}
