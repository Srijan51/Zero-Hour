import React, { useState } from 'react';
import api from '../services/api';
import { MapPin, Navigation, CheckCircle } from 'lucide-react';

export default function MatchResults({ matches, volunteerId, onReset }) {
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
    return (
      <div className="p-6 bg-white shadow-2xl rounded-t-3xl border-t border-slate-200 space-y-4">
        <div className="flex items-center space-x-3 text-green-600 mb-4">
          <CheckCircle className="w-8 h-8" />
          <h2 className="text-xl font-bold">Match Confirmed!</h2>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl mb-4">
          <p className="text-slate-600 mb-2">NGO has been notified via Firebase.</p>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-1/3 transition-all"></div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center uppercase tracking-wider font-semibold">En Route</p>
        </div>
        <button 
          className="w-full py-3 bg-primary text-white rounded-xl shadow-lg font-semibold flex items-center justify-center space-x-2"
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentLat},${currentLng}`, '_blank')}
        >
          <Navigation className="w-5 h-5" />
          <span>Open in Google Maps</span>
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
    <div className="p-4 bg-white/90 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl border-t border-slate-200 flex flex-col max-h-[60vh] overflow-hidden">
      <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4"></div>
      <h2 className="text-lg font-bold text-slate-800 mb-2 px-2">Top NGO Matches</h2>
      
      <div className="overflow-y-auto pb-4 space-y-3 px-2">
        {matches.map((match, idx) => (
          <div key={idx} className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-slate-900">{match.ngo_name}</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded flex items-center">
                Match {match.match_score.toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3">{match.task_description}</p>
            
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
              className="mt-2 w-full py-2.5 bg-primary hover:bg-blue-600 transition-colors text-white rounded-xl text-sm font-semibold shadow-md border border-blue-500"
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
