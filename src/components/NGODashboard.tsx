import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, MapPin, Send, History, AlertCircle, UserCheck } from 'lucide-react';
import { Urgency, NGORequest } from '../types';
import { cn } from '../lib/utils';

interface NGODashboardProps {
  requests: NGORequest[];
  onNewRequest: (req: Partial<NGORequest>) => void;
}

export default function NGODashboard({ requests, onNewRequest }: NGODashboardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string}[]>([]);
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
        setNotifications(prev => [...prev, { id, text: `${volunteerName} en route to ${req.taskType}` }]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 6000);
      }
    };

    window.addEventListener('volunteer-dispatched', handleDispatch as any);
    return () => window.removeEventListener('volunteer-dispatched', handleDispatch as any);
  }, [requests]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNewRequest({
      ngoName: formData.ngoName,
      taskType: formData.taskType,
      description: formData.description,
      urgency: formData.urgency,
      skillsRequired: formData.skills.split(',').map(s => s.trim()),
      assetsRequired: formData.assets.split(',').map(a => a.trim()),
      location: { lat: 22.57, lng: 88.36, address: formData.address }
    });
    setIsAdding(false);
    setFormData({
      ngoName: '',
      taskType: '',
      description: '',
      urgency: 3,
      skills: '',
      assets: '',
      address: ''
    });
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-100 overflow-hidden relative">
      {/* Real-time Notifications */}
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

      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">Agency Command</h2>
          <p className="text-sm font-medium text-blue-600 uppercase tracking-widest mt-1">Silvercreek Flood Response Hub</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white p-5 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Stats Rail */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        {[
          { label: 'Active Requests', value: requests.length, color: 'text-slate-900' },
          { label: 'Total Matches', value: '12', color: 'text-blue-600' },
          { label: 'En Route', value: '4', color: 'text-green-600' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2">{stat.label}</p>
            <p className={cn("text-4xl font-black tracking-tight", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-12">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Live Operations feed</h3>
        {requests.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border",
                req.urgency >= 5 ? "bg-red-50 border-red-100 text-red-600" : "bg-slate-50 border-slate-100 text-slate-400"
              )}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-1">{req.taskType}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {req.location.address}</span>
                  <span className="opacity-30">•</span>
                  <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</p>
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Searching AI Pool</span>
               </div>
               <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Plus className="w-4 h-4 text-slate-300" />
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Request Modal */}
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
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Reporting Agency</label>
                  <input 
                    required
                    value={formData.ngoName}
                    onChange={e => setFormData({...formData, ngoName: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Emergency Type</label>
                  <input 
                    required
                    placeholder="e.g. Flood Extraction"
                    value={formData.taskType}
                    onChange={e => setFormData({...formData, taskType: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Mission Description</label>
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
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-3 block">Primary Address / coordinates</label>
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
