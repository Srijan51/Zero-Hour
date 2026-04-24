import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Clock, AlertTriangle, CheckCircle2, Radio, LogOut, Lock, Navigation } from 'lucide-react';
import api from '../services/api';
import PlacesAutocomplete from '../components/PlacesAutocomplete';

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

  const [formData, setFormData] = useState({
    task_description: '',
    required_skills: '',
    required_assets: '',
    location_text: '',
    lat: 22.57,
    lng: 88.36,
    urgency: 3
  });
  
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);

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
      setStatus('Task Posted successfully!');
      setFormData({ ...formData, task_description: '', required_skills: '', required_assets: '', location_text: '' });
      setShowForm(false);
      fetchRequests();
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      const backendDetail = error?.response?.data?.detail;
      const message = Array.isArray(backendDetail)
        ? backendDetail.map((item) => item?.msg || item).join(', ')
        : backendDetail;
      setStatus(error?.response?.status === 401 ? 'Session expired. Please login again.' : (message || 'Failed to post task.'));
    }
  };

  const openCount = requests.filter(r => r.status === 'open').length;
  const matchedCount = requests.filter(r => r.status === 'matched').length;

  if (checkingAuth) {
    return (
      <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 pb-16 md:pb-0">
        <div className="text-sm text-slate-500 font-medium">Checking authentication...</div>
      </div>
    );
  }

  if (!token || !authenticatedNgo) {
    return (
      <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-4 pb-16 md:pb-0">
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
    <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white overflow-y-auto custom-scrollbar flex flex-col pb-16 md:pb-0">
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
          {requests.map((req, idx) => (
            <div key={req.id} className="p-4 bg-white rounded-xl shadow-sm border border-slate-50 hover:shadow-md transition-all duration-200 flex items-start justify-between group" style={{ animationDelay: `${idx * 0.05}s` }}>
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
                {req.status === 'matched' ? (
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
                {(req.google_maps_url || (req.lat !== undefined && req.lng !== undefined)) && (
                  <button
                    type="button"
                    onClick={() => window.open(req.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${req.lat},${req.lng}`, '_blank')}
                    className="mt-2 inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Route</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
