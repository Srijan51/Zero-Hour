import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { Navigation, CheckCircle, MapPin, Phone, User, Clock, AlertTriangle, Loader2 } from 'lucide-react';

const ACTIVE_MATCH_STORAGE_KEY = 'active_match_id';

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
        maximumAge: 3000,
      }
    );
  });
}

// ─── Phone Prompt Modal ────────────────────────────────────────
function PhonePrompt({ onSubmit, onCancel }) {
  const savedPhone = localStorage.getItem('volunteer_phone') || '';
  const savedName = localStorage.getItem('volunteer_name') || '';
  const [phone, setPhone] = useState(savedPhone);
  const [name, setName] = useState(savedName);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) return;
    localStorage.setItem('volunteer_phone', phone.trim());
    localStorage.setItem('volunteer_name', name.trim());
    onSubmit({ phone: phone.trim(), name: name.trim() });
  };

  return (
    <div className="p-6 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] slide-up">
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/30">
          <Phone className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Confirm Your Identity</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto">
          Your phone number helps the NGO contact you and ensures mission accountability.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Name *</label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full pl-10 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number *</label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full pl-10 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          Confirm & Accept Mission
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 text-slate-400 text-sm font-medium"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

// ─── Live Mission Tracking Panel ───────────────────────────────
function LiveTrackingPanel({ matchId, matchData, routeUrl, onReset, onMissionFinished }) {
  const [liveStatus, setLiveStatus] = useState(null);
  const [isDelaying, setIsDelaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [delayNotified, setDelayNotified] = useState(false);
  const pingIntervalRef = useRef(null);
  const statusIntervalRef = useRef(null);

  // Send GPS pings every 15 seconds
  useEffect(() => {
    const sendPing = async () => {
      try {
        const pos = await getCurrentLocation();
        await api.post(`/match/${matchId}/checkin`, { lat: pos.lat, lng: pos.lng });
      } catch {
        // Silently fail — next ping will retry
      }
    };

    // Send first ping immediately
    sendPing();
    pingIntervalRef.current = setInterval(sendPing, 15000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [matchId]);

  // Poll live status every 5 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/match/${matchId}/live`);
        setLiveStatus(res.data);
      } catch {
        // ignore
      }
    };

    fetchStatus();
    statusIntervalRef.current = setInterval(fetchStatus, 5000);

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [matchId]);

  const handleDelay = async () => {
    setIsDelaying(true);
    try {
      await api.post(`/match/${matchId}/delay`);
      setDelayNotified(true);
    } catch { /* ignore */ }
    setIsDelaying(false);
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await api.post(`/match/${matchId}/complete`);
      // Status will update on next poll
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Cannot mark as complete yet';
      alert(detail);
    }
    setIsCompleting(false);
  };

  const handleOpenDirections = (e) => {
    e.preventDefault();
    // Open synchronously in new tab — must happen in direct click handler to avoid popup blocker
    const newTab = window.open(routeUrl, '_blank');
    // Then try to get a fresher position and update the tab URL
    getCurrentLocation().then((latestPosition) => {
      const req = matchData?.request;
      if (req && newTab) {
        const freshUrl = buildDirectionsUrl(req, latestPosition.lat, latestPosition.lng);
        try { newTab.location.href = freshUrl; } catch { /* cross-origin, ignore */ }
      }
    }).catch(() => { /* keep original URL */ });
  };

  const status = liveStatus?.status || matchData?.status || 'en_route';
  const progress = liveStatus?.progress_percent || 0;
  const arrived = liveStatus?.arrived || false;
  const statusMessage = liveStatus?.status_message || 'En route to mission...';

  // Waiting for NGO confirmation
  if (status === 'pending_confirmation') {
    return (
      <div className="p-8 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] space-y-5 slide-up">
        <div className="flex items-center space-x-3 text-amber-500 mb-2">
          <Clock className="w-10 h-10 drop-shadow-sm animate-pulse" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Awaiting Confirmation</h2>
            <p className="text-xs text-slate-400">The NGO will confirm your task completion</p>
          </div>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-sm text-amber-700 font-medium">You've marked this task as done. The NGO needs to confirm that you helped before the mission is closed.</p>
        </div>
        <button className="w-full py-3 text-slate-500 font-medium" onClick={onReset}>
          Return Home
        </button>
      </div>
    );
  }

  // Completed
  if (status === 'completed') {
    return (
      <div className="p-8 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] space-y-5 slide-up">
        <div className="flex items-center space-x-3 text-green-500 mb-2">
          <CheckCircle className="w-10 h-10 drop-shadow-sm" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Mission Complete!</h2>
            <p className="text-xs text-slate-400">Confirmed by the NGO. Thank you for your service.</p>
          </div>
        </div>
        <button
          className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-md active:scale-95 transition-all"
          onClick={() => {
            if (onMissionFinished) onMissionFinished();
            onReset();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  // Active tracking
  return (
    <div className="p-6 glass-panel rounded-t-[2.5rem] sm:rounded-[2.5rem] space-y-4 slide-up">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Mission Active</h2>
          <p className="text-xs text-slate-400 mt-0.5">{statusMessage}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide ${
          arrived ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
        }`}>
          {arrived ? '📍 ON SITE' : '🚗 EN ROUTE'}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
          <span>PROGRESS</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary to-secondary"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* Match Score & ETA */}
      <div className="flex space-x-2">
        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[18px] font-extrabold text-slate-800">{Number(matchData?.score || 0).toFixed(1)}%</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Match Score</p>
        </div>
        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[18px] font-extrabold text-slate-800">{liveStatus?.eta_text || matchData?.eta_text || '—'}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ETA</p>
        </div>
      </div>

      {/* Location */}
      {matchData?.request?.location_text && (
        <div className="flex items-start space-x-2 px-3 py-2.5 bg-blue-50/60 rounded-xl border border-blue-100/50">
          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium leading-snug">{matchData.request.location_text}</p>
        </div>
      )}

      {/* Directions Button */}
      <a
        href={routeUrl}
        onClick={handleOpenDirections}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl shadow-md font-bold flex items-center justify-center space-x-2 transition-transform hover:-translate-y-0.5 active:scale-95 no-underline"
      >
        <Navigation className="w-4 h-4" />
        <span>Open Directions</span>
      </a>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {/* I'm Delayed */}
        <button
          onClick={handleDelay}
          disabled={isDelaying || delayNotified}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
            delayNotified
              ? 'bg-amber-50 text-amber-500 border border-amber-100'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{delayNotified ? 'NGO Notified' : isDelaying ? '...' : "I'm Delayed"}</span>
        </button>

        {/* Mark Task Done */}
        <button
          onClick={handleComplete}
          disabled={isCompleting || !arrived}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
            arrived
              ? 'bg-green-500 text-white shadow-md shadow-green-500/30 hover:-translate-y-0.5'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{isCompleting ? '...' : arrived ? 'Mark Task Done' : 'Reach Location First'}</span>
        </button>
      </div>

      {!arrived && (
        <p className="text-[10px] text-slate-300 text-center font-medium">
          "Mark Task Done" unlocks when you're within 200m of the location
        </p>
      )}
    </div>
  );
}


// ─── Main Component ────────────────────────────────────────────
export default function MatchResults({ matches, volunteerId, currentLat, currentLng, onReset }) {
  const [confirmedMatch, setConfirmedMatch] = useState(null);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const clearActiveMission = () => {
    localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
  };

  useEffect(() => {
    const restoreActiveMission = async () => {
      if (confirmedMatch) return;

      const storedMatchId = localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
      if (!storedMatchId) return;

      try {
        const res = await api.get(`/match/${storedMatchId}/live`);
        const live = res.data;

        if (live.status === 'cancelled') {
          clearActiveMission();
          return;
        }

        setConfirmedMatch({
          id: live.id,
          request_id: live.request?.id,
          volunteer_id: volunteerId || undefined,
          score: 0,
          status: live.status,
          eta_minutes: live.eta_minutes,
          eta_text: live.eta_text,
          request: live.request,
          volunteer_phone: live.volunteer_phone,
          volunteer_name: live.volunteer_name,
        });
      } catch {
        clearActiveMission();
      }
    };

    restoreActiveMission();
  }, [confirmedMatch, volunteerId]);

  const handleAcceptClick = (requestId) => {
    // Check if phone AND name already saved
    const savedPhone = localStorage.getItem('volunteer_phone');
    const savedName = localStorage.getItem('volunteer_name');
    if (savedPhone && savedName) {
      // Already have identity — confirm directly
      confirmMatch(requestId, savedPhone, savedName);
    } else {
      setSelectedRequestId(requestId);
      setShowPhonePrompt(true);
    }
  };

  const confirmMatch = async (requestId, phone, name) => {
    try {
      const res = await api.post('/match/confirm', {
        volunteer_id: volunteerId,
        request_id: requestId,
        phone: phone || undefined,
        name: name || undefined,
      });
      setConfirmedMatch(res.data);
      localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, String(res.data.id));
      setShowPhonePrompt(false);
    } catch (error) {
      console.error(error);
    }
  };

  // Phone prompt
  if (showPhonePrompt) {
    return (
      <PhonePrompt
        onSubmit={({ phone, name }) => confirmMatch(selectedRequestId, phone, name)}
        onCancel={() => {
          setShowPhonePrompt(false);
          setSelectedRequestId(null);
        }}
      />
    );
  }

  // Live tracking after confirming
  if (confirmedMatch) {
    const routeRequest = confirmedMatch.request;
    const routeUrl = buildDirectionsUrl(routeRequest, currentLat, currentLng);

    return (
      <LiveTrackingPanel
        matchId={confirmedMatch.id}
        matchData={confirmedMatch}
        routeUrl={routeUrl}
        onReset={onReset}
        onMissionFinished={clearActiveMission}
      />
    );
  }

  // Match list
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
              onClick={() => handleAcceptClick(match.id)}
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
