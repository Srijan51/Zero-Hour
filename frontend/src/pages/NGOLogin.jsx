import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Clock, AlertTriangle, CheckCircle2, Radio, LogOut, Lock, Navigation, Phone, User, RotateCcw, XCircle, Trash2 } from 'lucide-react';
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
    urgency: 3
  });
  
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteRequestId, setPendingDeleteRequestId] = useState(null);

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

  const fetchRequests = async () => {
    try {
      const res = await api.get('/ngo/requests');
      setRequests(res.data);
    } catch (e) {
      console.error(e);
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
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthStatus('Authenticating...');

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
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ngoAuthToken');
    localStorage.removeItem('ngoName');
    setToken('');
    setAuthenticatedNgo('');
    setShowForm(false);
    setStatus('');
    setRequests([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting...');
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
    }
  };

  const openCount = requests.filter(r => r.status === 'open').length;
  const matchedCount = requests.filter(r => ['matched', 'pending_confirmation'].includes(r.status)).length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  // Track live match data for matched requests
  const [matchDataMap, setMatchDataMap] = useState({});

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
      const activeRequests = requests.filter(r => ['matched', 'pending_confirmation'].includes(r.status));
      const newMap = {};
      for (const req of activeRequests) {
        try {
          const res = await api.get(`/match/request/${req.id}`);
          const activeMatch = pickPreferredMatch((res.data || []).filter(m => m.status !== 'cancelled'));
          if (activeMatch) {
            // Fetch live status for this match
            try {
              const liveRes = await api.get(`/match/${activeMatch.id}/live`);
              newMap[req.id] = { ...activeMatch, live: liveRes.data };
            } catch {
              newMap[req.id] = activeMatch;
            }
          }
        } catch { /* ignore */ }
      }
      setMatchDataMap(newMap);
    };

    if (requests.length > 0) {
      fetchMatchData();
      const interval = setInterval(fetchMatchData, 5000);
      return () => clearInterval(interval);
    }
  }, [token, requests]);

  const handleNgoConfirm = async (matchId) => {
    try {
      await api.post(`/match/${matchId}/ngo-confirm`);
      addToast('Mission confirmed as complete!', 'success');
      fetchRequests();
    } catch (err) {
      addToast('Failed to confirm completion.', 'error');
    }
  };

  const handleNgoDispute = async (matchId) => {
    try {
      await api.post(`/match/${matchId}/ngo-dispute`);
      addToast('Match disputed — request re-opened.', 'warning');
      fetchRequests();
    } catch (err) {
      addToast('Failed to dispute.', 'error');
    }
  };

  const handleRebroadcast = async (matchId) => {
    try {
      await api.post(`/match/${matchId}/rebroadcast`);
      addToast('Request re-broadcasted for new volunteers.', 'info');
      fetchRequests();
    } catch (err) {
      addToast('Failed to re-broadcast.', 'error');
    }
  };

  const requestDeleteRequest = (requestId) => {
    setPendingDeleteRequestId(requestId);
  };

  const confirmDeleteRequest = async () => {
    if (!pendingDeleteRequestId) return;
    try {
      await api.delete(`/ngo/requests/${pendingDeleteRequestId}`);
      addToast('Request deleted successfully.', 'success');
      setPendingDeleteRequestId(null);
      fetchRequests();
    } catch (err) {
      addToast('Failed to delete request.', 'error');
    }
  };

  if (checkingAuth) {
    return (
      <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 pb-16 md:pb-0">
        <div className="text-sm text-slate-500 font-medium">Checking authentication...</div>
      </div>
    );
  }

  if (!token || !authenticatedNgo) {
    return (
      <div className="h-full w-full login-bg overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-4 pb-16 md:pb-0">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 slide-up">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
              <Lock className="w-5 h-5 text-white" />
            </div>
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

            <button type="submit" className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
              Authenticate
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
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
              
              <button type="submit" className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
                Broadcast Request
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.15em]">Live Feed ({requests.length})</h2>
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-medium">
            <Clock className="w-3 h-3" />
            <span>Auto-refresh 5s</span>
          </div>
        </div>
        
        <div className="space-y-2.5 pb-4 md:overflow-y-auto md:custom-scrollbar md:pr-2 flex-1 min-h-0">
          {requests.length === 0 && (
            <div className="text-center py-12 text-slate-300">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No active requests</p>
              <p className="text-xs mt-1">Create your first crisis request above</p>
            </div>
          )}
          {requests.map((req, idx) => {
            const matchInfo = matchDataMap[req.id];
            const live = matchInfo?.live;
            const isMatched = ['matched', 'pending_confirmation'].includes(req.status);
            const isPending = req.status === 'pending_confirmation';
            const isCompleted = req.status === 'completed';

            return (
            <div key={req.id} className={`p-4 bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 group ${
              live?.no_show_flagged ? 'border-rose-200 bg-rose-50/30' : isPending ? 'border-amber-200 bg-amber-50/30' : 'border-slate-50'
            }`} style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{req.ngo_name}</h3>
                    {req.urgency >= 4 && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{req.task_description}</p>
                  {req.location_text && (
                    <p className="text-slate-400 text-[11px] mt-1">Location: {req.location_text}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    {req.required_skills?.slice(0, 2).map(s => (
                      <span key={s} className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                    {req.required_assets?.slice(0, 1).map(a => (
                      <span key={a} className="text-[9px] font-semibold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-3">
                  {isCompleted ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg border border-green-100">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Completed</span>
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg border border-amber-100 animate-pulse">
                      <Clock className="w-3 h-3" />
                      <span>Confirm?</span>
                    </span>
                  ) : isMatched ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Matched</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 text-blue-500 text-[10px] font-bold rounded-lg border border-blue-100">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>Open</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Volunteer info + live tracking for matched requests */}
              {isMatched && matchInfo && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                  {/* Volunteer identity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{live?.volunteer_name || matchInfo.volunteer_name || 'Volunteer'}</p>
                        {(live?.volunteer_phone || matchInfo.volunteer_phone) && (
                          <a href={`tel:${live?.volunteer_phone || matchInfo.volunteer_phone}`} className="text-[10px] text-primary font-semibold no-underline flex items-center space-x-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{live?.volunteer_phone || matchInfo.volunteer_phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[9px] font-bold tracking-wide ${
                      live?.arrived ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {live?.arrived ? '📍 ON SITE' : '🚗 EN ROUTE'}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-slate-300 mb-1">
                      <span>{live?.status_message || 'Tracking...'}</span>
                      <span>{Math.round(live?.progress_percent || 0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${Math.min(100, live?.progress_percent || 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Delay notification */}
                  {live?.delay_notified_at && (
                    <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600">Volunteer reported a delay</span>
                    </div>
                  )}

                  {/* No-show warning */}
                  {live?.no_show_flagged && (
                    <div className="flex items-center justify-between px-2.5 py-2 bg-rose-50 rounded-lg border border-rose-200">
                      <div className="flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[10px] font-bold text-rose-600">No GPS signal — volunteer may not be responding</span>
                      </div>
                      <button
                        onClick={() => handleRebroadcast(matchInfo.id)}
                        className="flex items-center space-x-1 px-2 py-1 bg-rose-500 text-white text-[9px] font-bold rounded-md hover:bg-rose-600 transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Re-broadcast</span>
                      </button>
                    </div>
                  )}

                  {/* Pending confirmation actions */}
                  {isPending && (
                    <div className="flex space-x-2 mt-1">
                      <button
                        onClick={() => handleNgoConfirm(matchInfo.id)}
                        className="flex-1 py-2 bg-green-500 text-white text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 hover:bg-green-600 transition-colors active:scale-95"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Confirm Done</span>
                      </button>
                      <button
                        onClick={() => handleNgoDispute(matchInfo.id)}
                        className="flex-1 py-2 bg-white text-rose-500 text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 border border-rose-200 hover:bg-rose-50 transition-colors active:scale-95"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Dispute</span>
                      </button>
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
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
