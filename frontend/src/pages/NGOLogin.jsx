import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import api from '../services/api';

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
    const interval = setInterval(fetchRequests, 5000); // Polling every 5s for demo
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
      fetchRequests();
    } catch (error) {
      setStatus('Failed to post task.');
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto p-4 flex flex-col pt-8">
      <div className="text-center mb-6">
        <Shield className="w-12 h-12 text-primary mx-auto mb-2" />
        <h1 className="text-2xl font-bold text-slate-800">NGO Dashboard</h1>
        <p className="text-slate-500 text-sm">Post a crisis need to the live network</p>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">NGO Name</label>
            <input required type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary"
              value={formData.ngo_name} onChange={e => setFormData({...formData, ngo_name: e.target.value})} placeholder="e.g. Red Cross" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Task Description</label>
            <textarea required className="w-full mt-1 p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary" rows="2"
              value={formData.task_description} onChange={e => setFormData({...formData, task_description: e.target.value})} placeholder="What help do you need?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Skills</label>
              <input type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary"
                value={formData.required_skills} onChange={e => setFormData({...formData, required_skills: e.target.value})} placeholder="medical, driving" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Assets</label>
              <input type="text" className="w-full mt-1 p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary"
                value={formData.required_assets} onChange={e => setFormData({...formData, required_assets: e.target.value})} placeholder="vehicle, boat" />
            </div>
          </div>
          
          <button type="submit" className="w-full py-3 mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors">
            Broadcast Request
          </button>
          
          {status && <p className="text-center text-sm font-medium text-green-600 bg-green-50 p-2 rounded-lg">{status}</p>}
        </form>
      </div>

      <div className="flex-1">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Live Open Requests ({requests.length})</h2>
        <div className="space-y-3 pb-8">
          {requests.map(req => (
            <div key={req.id} className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{req.ngo_name}</h3>
                <p className="text-slate-500 text-xs mt-1">{req.task_description}</p>
              </div>
              {req.status === 'matched' ? (
                 <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded text-center leading-tight">Matched<br/>En Route</span>
              ) : (
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 animate-pulse"></span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
