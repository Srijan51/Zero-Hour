import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, MapPin, Send, History, AlertCircle, UserCheck } from 'lucide-react';
import { Urgency, NGORequest } from '../types';
import { cn } from '../lib/utils';

interface NGODashboardProps {
  requests: any[]; // Changed to 'any' to handle the backend schema smoothly
  onNewRequest: (req: any) => void;
}

export default function NGODashboard({ requests, onNewRequest }: NGODashboardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string}[]>([]);
  const [rebroadcastEnabled, setRebroadcastEnabled] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    ngoName: '',
    taskType: '',
    description: '',
    urgency: 3 as Urgency,
    skills: '',
    assets: '',
    address: ''
  });

  useEffect(() => {
    const handleDispatch = (e: any) => {
      const { volunteerName, requestId } = e.detail;
      const req = requests.find(r => r.id === requestId);
      if (req) {
        const id = Math.random().toString(36).substr(2, 5);
        setNotifications(prev => [...prev, { id, text: `${volunteerName} en route to ${req.task_description || 'Mission'}` }]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 6000);
      }
    };

    const handleCancel = (e: any) => {
      const { volunteerName, requestId } = e.detail;
      const req = requests.find(r => r.id === requestId);
      if (req) {
        const id = Math.random().toString(36).substr(2, 5);
        setNotifications(prev => [...prev, { id, text: `${volunteerName} cancelled mission for ${req.task_description || 'Mission'}` }]);
        setRebroadcastEnabled(prev => ({ ...prev, [requestId]: true }));
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 6000);
      }
    };

    window.addEventListener('volunteer-dispatched', handleDispatch as any);
    window.addEventListener('volunteer-cancelled', handleCancel as any);
    return () => {
      window.removeEventListener('volunteer-dispatched', handleDispatch as any);
      window.removeEventListener('volunteer-cancelled', handleCancel as any);
    };
  }, [requests]);

  const handleRebroadcast = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;
    
    fetch('/api/rebroadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    }).catch(() => {});

    const id = Math.random().toString(36).substr(2, 5);
    setNotifications(prev => [...prev, { id, text: `Rebroadcast sent for ${req.task_description || 'Mission'}` }]);
    setRebroadcastEnabled(prev => ({ ...prev, [requestId]: false }));
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // FIXED: Form payload now perfectly matches the backend NGORequestCreate schema
    onNewRequest({
      task_description: `${formData.taskType} - ${formData.description}`,
      urgency: formData.urgency,
      required_skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      required_assets: formData.assets.split(',').map(a => a.trim()).filter(Boolean),
      location_text: formData.address,
      lat: 22.57, // Default coordinate, updates automatically in a real scenario
      lng: 88.36
    });
    setIsAdding(false);
    setFormData({ ngoName: '', taskType: '', description: '', urgency: 3, skills: '', assets: '', address: '' });
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-100 overflow-hidden relative">
      <div className="absolute top-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(notif => (
            <motion.div
              key={notif.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto border border-blue-400"
            >
              <UserCheck className="w-5 h-5" />
              <p className="text-xs font-bold uppercase tracking-widest">{notif.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm mb-10 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">Agency Command</h2>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-widest mt-1">Live Response Hub</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-12 pt-6 border-t border-slate-100">
          {[
            { label: 'Active Requests', value: requests.length, color: 'text-slate-900' },
            { label: 'Total Matches', value: requests.filter(r => r.status === 'matched').length, color: 'text-blue-600' },
            { label: 'En Route', value: requests.filter(r => r.status === 'en_route').length, color: 'text-green-600' }
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{stat.label}</p>
              <p className={`text-3xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-12">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Live Operations feed</h3>
        {requests.map((req, i) => (
          <motion.div
            key={req.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border",
                (req.urgency || 3) >= 5 ? "bg-red-50 border-red-100 text-red-600" : "bg-slate-50 border-slate-100 text-slate-400"
              )}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                {/* FIXED: Now reads the correct fields from the backend JSON response */}
                <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-1">{req.task_description || "Emergency Request"}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {req.location_text || "Location pending"}</span>
                  <span className="opacity-30">•</span>
                  <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> {new Date(req.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</p>
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{req.status || "open"}</span>
               </div>
               <div>
                 <button
                   onClick={() => handleRebroadcast(req.id)}
                   className={`py-2 px-3 rounded-2xl font-bold text-[10px] flex items-center gap-2 transition-all ${rebroadcastEnabled[req.id] ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : 'bg-slate-50 border border-slate-100 text-slate-600'}`}
                 >
                   <Send className="w-4 h-4" />
                   Rebroadcast
                 </button>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isAdding && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-xl rounded-[3rem] p-12 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100"
          >
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Signal Emergency</h3>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Broadcast to Volunteer Network</p>
              </div>
              <button onClick={() => setIsAdding(false)} className="bg-slate-50 p-4 rounded-2xl hover:bg-slate-100 transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Emergency Type (e.g. Flood Extraction)</label>
                  <input 
                    required
                    value={formData.taskType}
                    onChange={e => setFormData({...formData, taskType: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Mission Details</label>
                <textarea 
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                 <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Primary Address</label>
                    <input 
                      required
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Urgency</label>
                    <select 
                      value={formData.urgency}
                      onChange={e => setFormData({...formData, urgency: parseInt(e.target.value) as Urgency})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    >
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>Level {v}</option>)}
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Required Skills (Comma separated)</label>
                  <input 
                    placeholder="e.g. First Aid, Swimming"
                    value={formData.skills}
                    onChange={e => setFormData({...formData, skills: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Required Assets</label>
                  <input 
                    placeholder="e.g. Boat, 4x4"
                    value={formData.assets}
                    onChange={e => setFormData({...formData, assets: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] transition-all hover:bg-blue-700 shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4"
              >
                <Send className="w-5 h-5" />
                Initialize Dispatch Signal
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}