import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Navigation, MapPin, Phone, Info, ChevronRight } from 'lucide-react';
import { MatchResult } from '../types';

interface VolunteerConfirmationProps {
  match: MatchResult;
  onDone: () => void;
}

const statusSteps = [
  { label: 'Dispatch Confirmed', completed: true },
  { label: 'En Route', completed: true },
  { label: 'On Site', completed: false },
  { label: 'Task Complete', completed: false },
];

export default function VolunteerConfirmation({ match, onDone }: VolunteerConfirmationProps) {
  const [canCancel, setCanCancel] = useState(true);
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanCancel(false);
      return;
    }
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;

  const handleCancel = () => {
    // Notify NGO dashboard that this volunteer cancelled
    try {
      window.dispatchEvent(new CustomEvent('volunteer-cancelled', { detail: { volunteerName: 'Rapid Volunteer', requestId: match.request.id } }));
    } catch (e) {
      // ignore if not available
    }
    onDone();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-slate-50"
    >
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
          backgroundSize: '24px 24px' 
        }} />
        
        <div className="flex items-center gap-6 mb-10 relative z-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">You're Dispatched!</h2>
            <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">Est. Arrival: 12 Minutes</p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
          <button className="flex-1 flex items-center justify-center gap-3 bg-blue-600 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
            <Navigation className="w-4 h-4" />
            Launch Navigation
          </button>
          <button className="flex-1 flex items-center justify-center gap-3 bg-white/5 border border-white/10 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
            <Phone className="w-4 h-4" />
            Contact Site Coordinator
          </button>
        </div>
      </div>

      <div className="flex-1 p-10 overflow-y-auto">
        {/* Combined NGO + Status Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-8">
          <div className="flex items-start gap-5 flex-1">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100">
              <MapPin className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-2xl text-slate-900 tracking-tight mb-1">{match.request.ngoName}</p>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{match.request.location.address}</p>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6">Mission Status</h3>
            <div className="space-y-6 relative">
              <div className="absolute left-[5.5px] top-2 bottom-2 w-[1px] bg-slate-100" />
              {statusSteps.map((step, i) => (
                <div key={i} className="flex gap-6 items-center relative z-10">
                  <div className={`w-3 h-3 rounded-full border-2 ${
                    step.completed ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                  }`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    step.completed ? 'text-slate-900' : 'text-slate-200'
                  }`}>
                    {step.label}
                  </span>
                  {i === 1 && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                      <span className="text-[9px] font-bold text-blue-600 uppercase">Live Tracking</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Briefing */}
        <div className="bg-blue-50/50 rounded-[2rem] p-8 border border-blue-100">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-blue-100">
               <Info className="w-4 h-4 text-blue-600" />
             </div>
             <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">On-Site Briefing</h4>
           </div>
           <p className="text-sm font-medium leading-relaxed text-slate-700">
             {match.request.description} Please ensure your {match.request.assetsRequired.join(', ') || 'essential gear'} is ready for deployment. Site coordinator will verify ID upon arrival.
           </p>
        </div>
      </div>

            {canCancel && (
        <div className="p-10 pt-0 mt-auto">
          <button 
            onClick={onDone}
            className="w-full py-5 bg-white border border-slate-200 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-red-500 hover:text-red-700 hover:border-red-200 transition-all flex flex-col items-center gap-1"
          >
            <span>Cancel Mission</span>
            <span className="text-[8px] text-slate-400">Window closes in {timeString}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}