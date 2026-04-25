import React, { useState, useEffect } from 'react';
import MapView from '../components/MapView';
import VoiceCapture from '../components/VoiceCapture';
import MatchResults from '../components/MatchResults';
import api from '../services/api';
import { Activity, Users, AlertTriangle, Zap } from 'lucide-react';

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000, // Only accept positions from the last 3 seconds
      }
    );
  });
}

export default function Home() {
  const [matches, setMatches] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [stats, setStats] = useState({ open_requests: 0, total_volunteers: 0, avg_eta_minutes: 0, matched_count: 0 });
  const [currentPosition, setCurrentPosition] = useState(null);
  const [locationReady, setLocationReady] = useState(false);

  const currentLat = currentPosition?.lat ?? 22.5726;
  const currentLng = currentPosition?.lng ?? 88.3639;

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationReady(true);
      return;
    }

    // Get a fresh, accurate position on first load (minimise cache)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationReady(true);
      },
      () => {
        // Keep fallback coordinates if location permission is denied.
        setLocationReady(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000, // Only accept cached positions from the last 5 seconds
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Ignore watch failures and keep last known coordinates.
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Fetch live stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/stats');
        setStats(res.data);
      } catch (e) {
        // Fallback: try request count only
        try {
          const res = await api.get('/ngo/requests');
          setStats(prev => ({ ...prev, open_requests: res.data.length }));
        } catch { /* ignore */ }
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTranscript = async (transcript) => {
    try {
      let latestPosition = { lat: currentLat, lng: currentLng };
      try {
        latestPosition = await getCurrentLocation();
        setCurrentPosition(latestPosition);
      } catch {
        // Use last known position if fresh lookup fails.
      }

      const formData = new FormData();
      formData.append('transcript', transcript);
      formData.append('lat', String(latestPosition.lat));
      formData.append('lng', String(latestPosition.lng));

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
    <div className="relative w-full h-full flex flex-col sm:rounded-[2.5rem] overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapView 
           userLat={currentLat} 
           userLng={currentLng} 
           markerData={matches || []} 
        />
      </div>
      
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 md:right-auto md:w-[450px] z-20 p-4 pointer-events-none fade-in">
        <div className="glass-panel px-5 py-3.5 rounded-2xl flex items-center justify-between pointer-events-auto">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
              Zero<span className="text-primary">Hour</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2 bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
            <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[10px] font-black tracking-wider text-slate-700">LIVE</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="absolute top-[76px] left-0 right-0 md:right-auto md:w-[450px] z-20 px-4 pointer-events-none fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="flex space-x-2">
          <div className="flex-1 glass-panel rounded-xl px-3 py-2.5 flex items-center space-x-2.5 pointer-events-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-slate-800 leading-none">{stats.open_requests}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Needs</p>
            </div>
          </div>
          <div className="flex-1 glass-panel rounded-xl px-3 py-2.5 flex items-center space-x-2.5 pointer-events-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400/10 to-green-500/5 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-slate-800 leading-none">{stats.total_volunteers}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Volunteers</p>
            </div>
          </div>
          <div className="flex-1 glass-panel rounded-xl px-3 py-2.5 flex items-center space-x-2.5 pointer-events-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/10 to-amber-500/5 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[18px] font-extrabold text-slate-800 leading-none">{stats.matched_count}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Matched</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom/Side Panel */}
      <div className="mt-auto relative z-10 w-full pb-14 slide-up max-h-[70vh] overflow-y-auto custom-scrollbar md:mt-0 md:absolute md:right-8 md:top-8 md:w-[400px] md:max-h-[calc(100vh-4rem)] md:pb-0 md:rounded-[2.5rem] md:shadow-2xl md:bg-white/40 md:backdrop-blur-xl">
        {matches ? (
           <MatchResults 
             matches={matches} 
             volunteerId={volunteerId}
             currentLat={currentLat}
             currentLng={currentLng}
             onReset={() => setMatches(null)}
           />
        ) : (
           <VoiceCapture onTranscriptComplete={handleTranscript} />
        )}
      </div>
    </div>
  );
}
