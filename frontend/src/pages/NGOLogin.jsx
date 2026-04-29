import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Clock, AlertTriangle, CheckCircle2, Radio, LogOut, Navigation, Phone, User, RotateCcw, XCircle, Trash2, Loader2 } from 'lucide-react';
import api from '../services/api';
import PlacesAutocomplete from '../components/PlacesAutocomplete';
import { ToastContainer, useToasts } from '../components/Toast';

const URGENCY_LABELS = {
  1: { label: 'Low', color: 'bg-slate-100 text-slate-500' },
  2: { label: 'Moderate', color: 'bg-blue-100 text-blue-600' },
  3: { label: 'High', color: 'bg-amber-100 text-amber-600' },
  4: { label: 'Critical', color: 'bg-orange-100 text-orange-600' },
  5: { label: 'Emergency', color: 'bg-rose-100 text-rose-600' },
};

const NGO_MATCH_CACHE_KEY = 'ngo_match_data_cache';
const NGO_LIVE_POLL_MS = 1500;
const ETA_FEEDBACK_OPTIONS = {
  on_time: { label: 'On time ✓', multiplier: 1.0, on_time: true },
  late_10: { label: 'Late (10-20 min)', multiplier: 1.25, on_time: false },
  late_20: { label: 'Late (20+ min)', multiplier: 1.5, on_time: false },
  early: { label: 'Early', multiplier: 0.8, on_time: false },
};

function buildDirectionsUrlFrom(volLat, volLng, req) {
  const dest = req.location_text?.trim() || (req.lat !== undefined && req.lng !== undefined ? `${req.lat},${req.lng}` : '');
  const params = new URLSearchParams({ api: '1', destination: dest, travelmode: 'driving', dir_action: 'navigate' });
  if (volLat !== undefined && volLng !== undefined && volLat !== null && volLng !== null) {
    params.set('origin', `${volLat},${volLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function NGOLogin() {
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [token, setToken] = useState(localStorage.getItem('ngoAuthToken') || '');
  const [authenticatedNgo, setAuthenticatedNgo] = useState(localStorage.getItem('ngoName') || '');
  const [authStatus, setAuthStatus] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toasts, addToast, removeToast } = useToasts();

  const [formData, setFormData] = useState({
    task_description: '',
    required_skills: '',
    required_assets: '',
    location_text: '',
    lat: 0,
    lng: 0,
    urgency: 3,
    volunteers_needed: 1,
  });
  
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteRequestId, setPendingDeleteRequestId] = useState(null);
  const [etaFeedbackMatchId, setEtaFeedbackMatchId] = useState(null);
  const [etaFeedbackChoice, setEtaFeedbackChoice] = useState('on_time');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetchingRequests, setIsFetchingRequests] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const seenDelayByRequestRef = useRef({});
  const seenCancelledByRequestRef = useRef({});

  // Get accurate browser location for the NGO form
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }));
      },
      () => {
        // Fallback to Kolkata if permission denied
        setFormData(prev => ({
          ...prev,
          lat: 22.5726,
          lng: 88.3639,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchRequests = async ({ silent = false } = {}) => {
    if (!silent) setIsFetchingRequests(true);
    try {
      const res = await api.get('/ngo/requests', { headers: authHeaders });
      setRequests(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setIsFetchingRequests(false);
    }
  };

  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        const res = await api.get('/ngo/me', { headers: authHeaders });
        setAuthenticatedNgo(res.data.ngo_name);
      } catch (e) {
        localStorage.removeItem('ngoAuthToken');
        localStorage.removeItem('ngoName');
        setToken('');
        setAuthenticatedNgo('');
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAuth();
  }, [token]);

  useEffect(() => {
    if (!token) {
      setRequests([]);
      return;
    }

    fetchRequests();
    const interval = setInterval(() => fetchRequests({ silent: true }), NGO_LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthStatus('Authenticating...');
    setIsLoggingIn(true);

    try {
      const res = await api.post('/ngo/login', credentials);
      const authToken = res.data.token;
      const ngoName = res.data.ngo_name;

      localStorage.setItem('ngoAuthToken', authToken);
      localStorage.setItem('ngoName', ngoName);
      setToken(authToken);
      setAuthenticatedNgo(ngoName);
      setCredentials({ identifier: '', password: '' });
      setAuthStatus('');
    } catch (error) {
      setAuthStatus('Invalid NGO credentials. Access denied.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ngoAuthToken');
    localStorage.removeItem('ngoName');
    localStorage.removeItem(NGO_MATCH_CACHE_KEY);
    setToken('');
    setAuthenticatedNgo('');
    setShowForm(false);
    setStatus('');
    setRequests([]);
    setMatchDataMap({});
    seenDelayByRequestRef.current = {};
    seenCancelledByRequestRef.current = {};
  };

  const submitEtaFeedbackAndConfirm = async (matchInfo, live) => {
    if (!matchInfo?.id) return;
    const choice = ETA_FEEDBACK_OPTIONS[etaFeedbackChoice] || ETA_FEEDBACK_OPTIONS.on_time;
    const etaMinutes = Number(live?.eta_minutes || matchInfo?.eta_minutes || 0);
    const actualMinutes = etaMinutes > 0 ? Math.max(1, Math.round(etaMinutes * choice.multiplier)) : null;

    try {
      setPendingAction(`confirm-${matchInfo.id}`);
      await api.post(
        `/match/${matchInfo.id}/eta-feedback`,
        { on_time: choice.on_time, actual_minutes: actualMinutes },
        { headers: authHeaders }
      );
      await api.post(`/match/${matchInfo.id}/ngo-confirm`, {}, { headers: authHeaders });
      addToast('ETA feedback saved and mission confirmed.', 'success');
      setEtaFeedbackMatchId(null);
      setEtaFeedbackChoice('on_time');
      fetchRequests();
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to confirm completion.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting...');
    setIsSubmittingRequest(true);
    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        required_assets: formData.required_assets.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.post('/ngo/requests', payload, { headers: authHeaders });
      setStatus('');
      addToast('Request broadcasted successfully!', 'success');
      setFormData({ ...formData, task_description: '', required_skills: '', required_assets: '', location_text: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error) {
      const backendDetail = error?.response?.data?.detail;
      const message = Array.isArray(backendDetail)
        ? backendDetail.map((item) => item?.msg || item).join(', ')
        : backendDetail;
      if (error?.response?.status === 401) {
        setStatus('Session expired. Please login again.');
      } else {
        setStatus('');
        addToast(message || 'Failed to post task.', 'error');
      }
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const openCount = requests.filter(r => r.status === 'open').length;
  const matchedCount = requests.filter(r => ['matched', 'pending_confirmation'].includes(r.status)).length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  // Track live match data for matched requests
  const [matchDataMap, setMatchDataMap] = useState(() => {
    try {
      const raw = localStorage.getItem(NGO_MATCH_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const matchDataMapRef = useRef(matchDataMap);

  useEffect(() => {
    matchDataMapRef.current = matchDataMap;
    try {
      localStorage.setItem(NGO_MATCH_CACHE_KEY, JSON.stringify(matchDataMap));
    } catch {
      // ignore storage errors
    }
  }, [matchDataMap]);

  const pickPreferredMatch = (matchList) => {
    if (!Array.isArray(matchList) || matchList.length === 0) return null;

    const statusPriority = {
      pending_confirmation: 0,
      on_site: 1,
      nearby: 2,
      en_route: 3,
      pending: 4,
      matched: 5,
      completed: 6,
      cancelled: 7,
    };

    const sorted = [...matchList].sort((a, b) => {
      const aPriority = statusPriority[a.status] ?? 99;
      const bPriority = statusPriority[b.status] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (b.id || 0) - (a.id || 0);
    });

    return sorted[0] || null;
  };

  useEffect(() => {
    if (!token) return;

    const fetchMatchData = async () => {
      const activeRequests = requests.filter(r => !['completed', 'cancelled'].includes(r.status));
      const activeRequestIds = new Set(activeRequests.map((req) => req.id));
      const updatedEntries = {};
      for (const req of activeRequests) {
        try {
          const res = await api.get(`/match/request/${req.id}`, { headers: authHeaders });
          const allMatches = res.data || [];
          const activeMatch = pickPreferredMatch(allMatches.filter(m => m.status !== 'cancelled'));
          if (activeMatch) {
            // Fetch live status for this match
            try {
              const liveRes = await api.get(`/match/${activeMatch.id}/live`, { headers: authHeaders });
              const delayAt = liveRes?.data?.delay_notified_at;
              if (delayAt) {
                const lastSeen = seenDelayByRequestRef.current[req.id];
                if (lastSeen !== delayAt) {
                  addToast(
                    `Delay reported by ${liveRes?.data?.volunteer_name || activeMatch.volunteer_name || 'volunteer'} for ${req.task_description.slice(0, 36)}${req.task_description.length > 36 ? '...' : ''}`,
                    'warning'
                  );
                  seenDelayByRequestRef.current[req.id] = delayAt;
                }
              }

              if (liveRes?.data?.status === 'cancelled') {
                const cancelKey = liveRes?.data?.updated_at || `${activeMatch.id}-cancelled`;
                const lastCancel = seenCancelledByRequestRef.current[req.id];
                if (lastCancel !== cancelKey) {
                  addToast(
                    `Volunteer cancelled for ${req.task_description.slice(0, 36)}${req.task_description.length > 36 ? '...' : ''}. Please rebroadcast.`,
                    'warning'
                  );
                  seenCancelledByRequestRef.current[req.id] = cancelKey;
                }
              }

              updatedEntries[req.id] = { ...activeMatch, live: liveRes.data };
            } catch {
              updatedEntries[req.id] = activeMatch;
            }
          } else {
            const latestCancelledMatch = allMatches.find(m => m.status === 'cancelled');
            if (latestCancelledMatch) {
              const cachedMatch = matchDataMapRef.current[req.id];
              const cancelKey = `${latestCancelledMatch.id}-cancelled`;
              const lastCancel = seenCancelledByRequestRef.current[req.id];
              if (lastCancel !== cancelKey) {
                addToast(
                  `Volunteer cancelled. Match ended for ${req.task_description.slice(0, 36)}${req.task_description.length > 36 ? '...' : ''}. Request is open again.`,
                  'warning'
                );
                seenCancelledByRequestRef.current[req.id] = cancelKey;
              }
              updatedEntries[req.id] = {
                ...(cachedMatch?.id === latestCancelledMatch.id ? cachedMatch : latestCancelledMatch),
                live: {
                  ...(cachedMatch?.live || {}),
                  status: 'cancelled',
                  progress_percent: 0,
                  arrived: false,
                  status_message: 'Volunteer cancelled. Request is being rebroadcast.',
                },
              };
            } else {
              updatedEntries[req.id] = null;
            }
          }
        } catch { /* ignore */ }
      }
      setMatchDataMap((prev) => {
        const next = { ...prev, ...updatedEntries };
        Object.keys(next).forEach((key) => {
          if (!activeRequestIds.has(Number(key)) || next[key] === null) {
            delete next[key];
          }
        });
        return next;
      });
    };

    if (requests.length > 0) {
      fetchMatchData();
      const interval = setInterval(fetchMatchData, NGO_LIVE_POLL_MS);
      return () => clearInterval(interval);
    }
  }, [token, requests, addToast]);

  const handleNgoConfirm = async (matchId) => {
    setEtaFeedbackMatchId(matchId);
    setEtaFeedbackChoice('on_time');
  };

  const handleNgoDispute = async (matchId) => {
    try {
      setPendingAction(`dispute-${matchId}`);
      await api.post(`/match/${matchId}/ngo-dispute`, {}, { headers: authHeaders });
      addToast('Match disputed — request re-opened.', 'warning');
      fetchRequests();
    } catch (err) {
      addToast('Failed to dispute.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRebroadcast = async (matchId, requestId) => {
    try {
      const actionKey = matchId ? `rebroadcast-${matchId}` : `rebroadcast-request-${requestId}`;
      setPendingAction(actionKey);
      if (matchId) {
        await api.post(`/match/${matchId}/rebroadcast`, {}, { headers: authHeaders });
      } else if (requestId) {
        await api.post('/api/rebroadcast', { requestId }, { headers: authHeaders });
      } else {
        throw new Error('No match or request specified');
      }
      addToast('Request re-broadcasted for new volunteers.', 'info');
      fetchRequests();
    } catch (err) {
      addToast('Failed to re-broadcast.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const requestDeleteRequest = (requestId) => {
    setPendingDeleteRequestId(requestId);
  };

  const confirmDeleteRequest = async () => {
    if (!pendingDeleteRequestId) return;
    try {
      setPendingAction(`delete-request-${pendingDeleteRequestId}`);
      await api.delete(`/ngo/requests/${pendingDeleteRequestId}`, { headers: authHeaders });
      addToast('Request deleted successfully.', 'success');
      setPendingDeleteRequestId(null);
      fetchRequests();
    } catch (err) {
      addToast('Failed to delete request.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  if (checkingAuth) {
    return (
      <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 pb-16 md:pb-0">
        <div className="flex flex-col items-center space-y-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <div className="text-sm font-medium">Checking authentication...</div>
        </div>
      </div>
    );
  }

  if (!token || !authenticatedNgo) {
    return (
      <div className="h-full w-full login-bg overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-4 pb-16 md:pb-0">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 slide-up">
          <div className="flex items-center space-x-3 mb-4">
            <img
              src="/logo.jpeg"
              alt="Zero Hour"
              className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-primary/20 border border-slate-100"
            />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">NGO Command Login</h1>
              <p className="text-slate-500 text-xs font-medium">Authenticate to access broadcast controls</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NGO Name or Email</label>
              <input
                required
                type="text"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={credentials.identifier}
                onChange={e => setCredentials({ ...credentials, identifier: e.target.value })}
                placeholder="Enter NGO name or registered email"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                required
                type="password"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={credentials.password}
                onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="Enter NGO password"
              />
            </div>

            <button type="submit" disabled={isLoggingIn} className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-2">
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isLoggingIn ? 'Authenticating...' : 'Authenticate'}</span>
            </button>
          </form>

          {authStatus && (
            <div className="mt-3 text-center text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              {authStatus}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Register NGO
            </Link>
            <Link to="/admin" className="font-semibold text-slate-500 hover:text-slate-700 transition-colors">
              Admin Access
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full panel-bg overflow-y-auto custom-scrollbar flex flex-col pb-16 md:pb-0">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-8 pb-10 md:pb-16 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/15 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 md:max-w-6xl md:mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img
                src="/logo.jpeg"
                alt="Zero Hour"
                className="w-11 h-11 rounded-xl object-cover shadow-lg shadow-primary/20 border border-white/20 bg-white"
              />
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">NGO Command</h1>
                <p className="text-slate-400 text-xs font-medium">{authenticatedNgo}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/20 text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-semibold">Logout</span>
            </button>

            {/* Stats Row (Desktop alignment) */}
            <div className="hidden md:flex space-x-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10 min-w-[120px]">
                <p className="text-3xl font-extrabold text-white">{requests.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10 min-w-[120px]">
                <div className="flex items-center space-x-1.5">
                  <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                  <p className="text-3xl font-extrabold text-white">{openCount}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10 min-w-[120px]">
                <p className="text-3xl font-extrabold text-emerald-400">{matchedCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matched</p>
              </div>
            </div>
          </div>

          {/* Stats Row (Mobile) */}
          <div className="flex space-x-3 mt-5 md:hidden">
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
              <p className="text-2xl font-extrabold text-white">{requests.length}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</p>
            </div>
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
              <div className="flex items-center space-x-1.5">
                <Radio className="w-3 h-3 text-green-400 animate-pulse" />
                <p className="text-2xl font-extrabold text-white">{openCount}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open</p>
            </div>
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
              <p className="text-2xl font-extrabold text-emerald-400">{matchedCount}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matched</p>
            </div>
          </div>
        </div>
      </div>

      <div className="md:grid md:grid-cols-12 md:gap-8 md:max-w-6xl md:mx-auto md:w-full md:px-6 md:pt-6 flex-1 min-h-0">
        {/* Create New Request Button / Form */}
        <div className="px-4 md:px-0 mt-4 md:mt-0 relative z-10 md:col-span-5">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-2xl shadow-[0_8px_20px_rgba(79,70,229,0.3)] flex items-center justify-center space-x-2 transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Broadcast New Request</span>
          </button>
        ) : (
          <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-100 slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">New Crisis Request</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Cancel</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Task Description</label>
                <textarea required className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all" rows="2"
                  value={formData.task_description} onChange={e => setFormData({...formData, task_description: e.target.value})} placeholder="What help do you need?" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Skills</label>
                  <input type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    value={formData.required_skills} onChange={e => setFormData({...formData, required_skills: e.target.value})} placeholder="medical, driving" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Assets</label>
                  <input type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    value={formData.required_assets} onChange={e => setFormData({...formData, required_assets: e.target.value})} placeholder="vehicle, boat" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volunteers Needed</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.volunteers_needed}
                  onChange={e => setFormData({...formData, volunteers_needed: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10)))})}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Broadcast Location</label>
                <PlacesAutocomplete
                  value={formData.location_text}
                  onChange={(text, lat, lng) => {
                    const update = { ...formData, location_text: text };
                    if (lat !== null && lng !== null) {
                      update.lat = lat;
                      update.lng = lng;
                    }
                    setFormData(update);
                  }}
                  placeholder="Search for a location..."
                />
              </div>

              {/* Urgency Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Urgency Level</label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${URGENCY_LABELS[formData.urgency].color}`}>
                    {URGENCY_LABELS[formData.urgency].label}
                  </span>
                </div>
                <input
                  type="range" min="1" max="5" step="1"
                  value={formData.urgency}
                  onChange={e => setFormData({...formData, urgency: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[8px] text-slate-300 font-bold mt-0.5">
                  <span>LOW</span><span>MOD</span><span>HIGH</span><span>CRIT</span><span>EMER</span>
                </div>
              </div>
              
              <button type="submit" disabled={isSubmittingRequest} className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-2">
                {isSubmittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSubmittingRequest ? 'Broadcasting...' : 'Broadcast Request'}</span>
              </button>
            </form>
          </div>
        )}

        {status && (
          <div className="mt-3 text-center text-sm font-semibold text-green-600 bg-green-50 p-3 rounded-xl border border-green-100 flex items-center justify-center space-x-2 slide-up">
            <CheckCircle2 className="w-4 h-4" />
            <span>{status}</span>
          </div>
        )}
      </div>

      {/* Live Requests Feed */}
      <div className="flex-1 px-4 md:px-0 mt-6 md:mt-0 md:col-span-7 min-h-0 flex flex-col pb-4 md:pb-0">
        <div className="flex items-center justify-between mb-3 rounded-2xl bg-white/70 border border-white/70 shadow-sm px-4 py-3 backdrop-blur">
          <div>
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.15em]">Live Feed ({requests.length})</h2>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active request operations</p>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1.5">
            {isFetchingRequests ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
            <span>{isFetchingRequests ? 'Refreshing requests...' : 'Auto-refresh 5s'}</span>
          </div>
        </div>
        
        <div className="space-y-3 pb-4 md:overflow-y-auto md:custom-scrollbar md:pr-2 flex-1 min-h-0">
          {isFetchingRequests && requests.length === 0 && (
            <div className="text-center py-12 text-slate-400 flex flex-col items-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading requests...</p>
            </div>
          )}
          {!isFetchingRequests && requests.length === 0 && (
            <div className="text-center py-12 text-slate-300">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No active requests</p>
              <p className="text-xs mt-1">Create your first crisis request above</p>
            </div>
          )}
          {requests.map((req, idx) => {
            const matchInfo = matchDataMap[req.id];
            const live = matchInfo?.live;
            const isMatched = Boolean(matchInfo?.id);
            const isPending = live?.status === 'pending_confirmation' || req.status === 'pending_confirmation';
            const isCompleted = req.status === 'completed';
            const isCancelled = live?.status === 'cancelled';

            return (
            <div key={req.id} className={`relative overflow-hidden p-4 bg-white/95 rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] border hover:shadow-[0_16px_42px_rgba(15,23,42,0.1)] transition-all duration-200 group ${
              live?.no_show_flagged ? 'border-rose-200 bg-rose-50/40' : isCancelled ? 'border-slate-200 bg-slate-50/60' : isPending ? 'border-amber-200 bg-amber-50/40' : 'border-white/70'
            }`} style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className={`absolute inset-y-0 left-0 w-1 ${
                live?.no_show_flagged ? 'bg-rose-400' : isCancelled ? 'bg-slate-400' : isPending ? 'bg-amber-400' : isMatched ? 'bg-emerald-400' : 'bg-blue-400'
              }`} />
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-extrabold text-slate-800 text-sm truncate">{req.ngo_name}</h3>
                    {req.urgency >= 4 && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                    )}
                    {req.urgency === 5 && req.last_escalated_at && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                        ⚠ Auto-escalated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-xs mt-0.5 leading-relaxed line-clamp-2">{req.task_description}</p>
                  {req.location_text && (
                    <p className="text-slate-400 text-[11px] mt-1.5 font-medium">Location: {req.location_text}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                    {req.required_skills?.slice(0, 2).map(s => (
                      <span key={s} className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full">{s}</span>
                    ))}
                    {req.required_assets?.slice(0, 1).map(a => (
                      <span key={a} className="text-[9px] font-bold text-amber-500 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">{a}</span>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span>{(req.volunteers_matched || 0)} / {(req.volunteers_needed || 1)} volunteers confirmed</span>
                      {req.status === 'filled' ? (
                        <span className="text-emerald-600">Filled</span>
                      ) : (
                        <span className="text-slate-400">Open</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                        style={{ width: `${Math.min(100, ((req.volunteers_matched || 0) / Math.max(1, req.volunteers_needed || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-3">
                  {req.status === 'filled' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Filled</span>
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Completed</span>
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100 shadow-sm animate-pulse">
                      <Clock className="w-3 h-3" />
                      <span>Confirm?</span>
                    </span>
                  ) : isMatched ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Matched</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 text-blue-500 text-[10px] font-bold rounded-full border border-blue-100 shadow-sm">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>Open</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Volunteer info + live tracking for matched requests */}
              {isMatched && (
                <div className="mt-4 ml-2 p-3 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-3">
                  {/* Volunteer identity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{live?.volunteer_name || matchInfo?.volunteer_name || 'Volunteer'}</p>
                        {(live?.volunteer_phone || matchInfo?.volunteer_phone) && (
                          <a href={`tel:${live?.volunteer_phone || matchInfo?.volunteer_phone}`} className="text-[10px] text-primary font-semibold no-underline flex items-center space-x-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{live?.volunteer_phone || matchInfo?.volunteer_phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide border ${
                      isCancelled ? 'bg-slate-100 text-slate-500' : live?.arrived ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {isCancelled ? 'REBROADCASTING' : live?.arrived ? '📍 ON SITE' : '🚗 EN ROUTE'}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1.5">
                      <span className="truncate pr-2">{live?.status_message || 'Refreshing live progress...'}</span>
                      <span className="text-slate-500">{Math.round(live?.progress_percent || 0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${Math.min(100, live?.progress_percent || 0)}%` }}
                      />
                    </div>
                  </div>

                  {!live && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-2 bg-white rounded-xl border border-slate-100">
                      <Clock className="w-3 h-3 text-slate-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-500">Live tracker reconnecting...</span>
                    </div>
                  )}

                  {/* Delay notification */}
                  {live?.delay_notified_at && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-2 bg-amber-50 rounded-xl border border-amber-100">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600">Volunteer reported a delay</span>
                    </div>
                  )}

                  {/* No-show warning */}
                  {live?.no_show_flagged && (
                    <div className="flex items-center justify-between px-2.5 py-2.5 bg-rose-50 rounded-xl border border-rose-200">
                      <div className="flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[10px] font-bold text-rose-600">No GPS signal — volunteer may not be responding</span>
                      </div>
                    </div>
                  )}

                  {/* Live route (open volunteer -> request directions) */}
                  <div className="mt-2">
                    <a
                      href={buildDirectionsUrlFrom(live?.volunteer_lat, live?.volunteer_lng, req)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center space-x-1 px-3 py-2 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 no-underline hover:bg-slate-200 transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Live Route</span>
                    </a>
                  </div>

                  {/* Always-visible rebroadcast control (falls back to request-level rebroadcast) */}
                  <div className="flex items-center justify-end mt-2">
                    <button
                      onClick={() => handleRebroadcast(matchInfo?.id, req.id)}
                      disabled={pendingAction === `rebroadcast-${matchInfo?.id}` || pendingAction === `rebroadcast-request-${req.id}`}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {(pendingAction === `rebroadcast-${matchInfo?.id}` || pendingAction === `rebroadcast-request-${req.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      <span>{(pendingAction === `rebroadcast-${matchInfo?.id}` || pendingAction === `rebroadcast-request-${req.id}`) ? 'Re-broadcasting...' : 'Re-broadcast'}</span>
                    </button>
                  </div>

                  {/* Pending confirmation actions */}
                  {isPending && (
                    <div className="flex space-x-2 mt-1">
                      <button
                        onClick={() => matchInfo?.id && handleNgoConfirm(matchInfo.id)}
                        disabled={!matchInfo?.id}
                        className="flex-1 py-2 bg-green-500 text-white text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 hover:bg-green-600 transition-colors active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        {pendingAction === `confirm-${matchInfo?.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{pendingAction === `confirm-${matchInfo?.id}` ? 'Confirming...' : 'Confirm Done'}</span>
                      </button>
                      <button
                        onClick={() => matchInfo?.id && handleNgoDispute(matchInfo.id)}
                        disabled={!matchInfo?.id}
                        className="flex-1 py-2 bg-white text-rose-500 text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 border border-rose-200 hover:bg-rose-50 transition-colors active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        {pendingAction === `dispute-${matchInfo?.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        <span>{pendingAction === `dispute-${matchInfo?.id}` ? 'Disputing...' : 'Dispute'}</span>
                      </button>
                    </div>
                  )}

                  {isPending && etaFeedbackMatchId === matchInfo?.id && (
                    <div className="mt-2 p-3 rounded-xl bg-white border border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Did the volunteer arrive within the estimated time?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(ETA_FEEDBACK_OPTIONS).map(([key, option]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEtaFeedbackChoice(key)}
                            className={`px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                              etaFeedbackChoice === key
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => submitEtaFeedbackAndConfirm(matchInfo, live)}
                          disabled={pendingAction === `confirm-${matchInfo?.id}`}
                          className="flex-1 py-2 bg-green-600 text-white text-[11px] font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-2"
                        >
                          {pendingAction === `confirm-${matchInfo?.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          <span>{pendingAction === `confirm-${matchInfo?.id}` ? 'Saving...' : 'Save feedback & confirm'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEtaFeedbackMatchId(null)}
                          className="px-3 py-2 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Route link + Delete for non-matched requests */}
              {!isMatched && (
                <div className="mt-2 flex items-center space-x-2">
                  {(req.google_maps_url || (req.lat !== undefined && req.lng !== undefined)) && (
                    <a
                      href={req.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${req.lat},${req.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 no-underline hover:bg-slate-200 transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Route</span>
                    </a>
                  )}
                  <button
                    onClick={() => handleRebroadcast(null, req.id)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-lg border border-rose-600 hover:bg-rose-600 transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={pendingAction === `rebroadcast-request-${req.id}`}
                  >
                    {pendingAction === `rebroadcast-request-${req.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    <span>{pendingAction === `rebroadcast-request-${req.id}` ? 'Re-broadcasting...' : 'Re-broadcast'}</span>
                  </button>
                  <button
                    onClick={() => requestDeleteRequest(req.id)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white text-rose-400 text-[10px] font-bold rounded-lg border border-rose-100 hover:bg-rose-50 hover:text-rose-500 transition-colors active:scale-95"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {/* Delete for matched/pending requests — shown subtly at the bottom */}
              {isMatched && (
                <div className="mt-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => requestDeleteRequest(req.id)}
                    className="inline-flex items-center space-x-1 px-2 py-1 text-rose-300 text-[9px] font-bold rounded hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>Delete Request</span>
                  </button>
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>
      </div>

      {pendingDeleteRequestId && (
        <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-xl p-5 slide-up">
            <h3 className="text-base font-extrabold text-slate-800">Delete Request?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This will delete the request and cancel any active volunteer matches linked to it.
            </p>
            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPendingDeleteRequestId(null)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRequest}
                disabled={pendingAction === `delete-request-${pendingDeleteRequestId}`}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-75 disabled:cursor-not-allowed inline-flex items-center space-x-2"
              >
                {pendingAction === `delete-request-${pendingDeleteRequestId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{pendingAction === `delete-request-${pendingDeleteRequestId}` ? 'Deleting...' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
