import React, { useState, useEffect } from 'react';
import { Shield, Plus, Clock, MapPin, AlertTriangle, CheckCircle2, Radio, ChevronDown } from 'lucide-react';
import api from '../services/api';

const URGENCY_LABELS = {
  1: { label: 'Low', color: 'bg-slate-100 text-slate-500' },
  2: { label: 'Moderate', color: 'bg-blue-100 text-blue-600' },
  3: { label: 'High', color: 'bg-amber-100 text-amber-600' },
  4: { label: 'Critical', color: 'bg-orange-100 text-orange-600' },
  5: { label: 'Emergency', color: 'bg-rose-100 text-rose-600' },
};

export default function NGOLogin() {
  const [formData, setFormData] = useState({
    ngo_name: '',
    task_description: '',
    required_skills: '',
    required_assets: '',
    lat: 22.57,
    lng: 88.36,
    urgency: 3
  });
  
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/ngo/requests');
      setRequests(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting...');
    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        required_assets: formData.required_assets.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.post('/ngo/requests', payload);
      setStatus('Task Posted successfully!');
      setFormData({...formData, task_description: '', required_skills: '', required_assets: ''});
      setShowForm(false);
      fetchRequests();
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Failed to post task.');
    }
  };

  const openCount = requests.filter(r => r.status === 'open').length;
  const matchedCount = requests.filter(r => r.status === 'matched').length;

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
                <p className="text-slate-400 text-xs font-medium">Crisis management dashboard</p>
              </div>
            </div>

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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NGO Name</label>
                <input required type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.ngo_name} onChange={e => setFormData({...formData, ngo_name: e.target.value})} placeholder="e.g. Red Cross Kolkata" />
              </div>
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
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
