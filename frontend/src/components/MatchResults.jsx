import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Navigation, CheckCircle, MapPin } from 'lucide-react';

function buildDirectionsUrl(request, currentLat, currentLng) {
  const destinationText = request?.location_text?.trim();
  const destination = destinationText || `${request?.lat},${request?.lng}`;
  const origin = (typeof currentLat === 'number' && typeof currentLng === 'number')
    ? `${currentLat},${currentLng}`
    : null;

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
    dir_action: 'navigate',
  });

  if (origin) {
    params.set('origin', origin);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
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
        maximumAge: 10000,
      }
    );
  });
}

export default function MatchResults({ matches, volunteerId, currentLat, currentLng, onReset }) {
  const [confirmedMatch, setConfirmedMatch] = useState(null);

  const confirmMatch = async (requestId) => {
    try {
      const res = await api.post('/match/confirm', {
        volunteer_id: volunteerId,
        request_id: requestId
      });
      setConfirmedMatch(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  if (confirmedMatch) {
    const routeRequest = confirmedMatch.request;
    const routeUrl = buildDirectionsUrl(routeRequest, currentLat, currentLng);

    const handleOpenDirections = async () => {
      try {
        const latestPosition = await getCurrentLocation();
        const freshUrl = buildDirectionsUrl(routeRequest, latestPosition.lat, latestPosition.lng);
        window.open(freshUrl, '_blank');
      } catch {
        window.open(routeUrl, '_blank');
      }
    };

    return (
      <div className="p-8 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] space-y-6">
        <div className="flex items-center space-x-3 text-green-500 mb-4">
          <CheckCircle className="w-10 h-10 drop-shadow-sm" />
          <h2 className="text-2xl font-extrabold tracking-tight">Match Confirmed!</h2>
        </div>
        <div className="px-3 py-2 bg-primary-light/40 text-primary-hover text-sm font-bold rounded-xl inline-flex items-center">
          Match Score: {Number(confirmedMatch.score || 0).toFixed(1)}%
        </div>

        {/* Location info */}
        {routeRequest?.location_text && (
          <div className="flex items-start space-x-2 px-3 py-2.5 bg-blue-50/60 rounded-xl border border-blue-100/50">
            <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium leading-snug">{routeRequest.location_text}</p>
          </div>
        )}

        <div className="p-4 bg-slate-50 rounded-xl mb-4">
          <p className="text-slate-600 mb-2">NGO has been notified. Open Google Maps for live directions and ETA.</p>
        </div>
        <button 
          className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl shadow-[0_8px_20px_rgba(79,70,229,0.3)] font-bold flex items-center justify-center space-x-2 transition-transform hover:-translate-y-0.5 active:scale-95"
          onClick={handleOpenDirections}
        >
          <Navigation className="w-5 h-5" />
          <span>Open Directions in Google Maps</span>
        </button>
        <button 
          className="w-full py-3 text-slate-500 font-medium mt-2"
          onClick={onReset}
        >
          Finish & Return
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col max-h-[65vh] overflow-hidden">
      <div className="w-12 h-1.5 bg-slate-300/50 rounded-full mx-auto mb-5"></div>
      <h2 className="text-2xl font-extrabold text-slate-800 mb-4 px-2 tracking-tight">Top NGO Matches</h2>
      
      <div className="overflow-y-auto pb-4 space-y-4 px-2 custom-scrollbar">
        {matches.map((match, idx) => (
          <div key={idx} className="p-5 bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-2xl flex flex-col transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-900 text-lg leading-tight">{match.ngo_name}</h3>
              <span className="px-2.5 py-1 bg-primary-light/50 text-primary-hover text-[11px] font-bold rounded-full flex items-center shadow-sm">
                Match {Number(match.match_score || 0).toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-2">{match.task_description}</p>

            {/* Request location */}
            {match.location_text && (
              <div className="flex items-center space-x-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-600 font-medium truncate">{match.location_text}</p>
              </div>
            )}
            
            {(match.required_skills.length > 0 || match.required_assets.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-3">
                {match.required_skills.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">{s}</span>
                ))}
                {match.required_assets.map(a => (
                   <span key={a} className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded-full">{a}</span>
                ))}
              </div>
            )}
            
            <button 
              onClick={() => confirmMatch(match.id)}
              className="mt-3 w-full py-3 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary transition-all text-white rounded-xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-95"
            >
              Accept Mission
            </button>
          </div>
        ))}
      </div>
      <button className="text-sm text-slate-400 mt-2" onClick={onReset}>Cancel</button>
    </div>
  );
}
