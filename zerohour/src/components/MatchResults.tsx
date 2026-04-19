import { motion } from 'motion/react';
import { MapPin, Navigation, Clock, ShieldCheck, X } from 'lucide-react';
import { MatchResult } from '../types';

interface MatchResultsProps {
  matches: MatchResult[];
  onConfirm: (match: MatchResult) => void;
  onCancel: () => void;
}

export default function MatchResults({ matches, onConfirm, onCancel }: MatchResultsProps) {
  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="h-full bg-slate-100 p-8 flex flex-col"
    >
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">Recommended Tasks</h2>
          <p className="text-sm font-medium text-blue-600 uppercase tracking-widest mt-1">High Accuracy Matches Identified</p>
        </div>
        <button onClick={onCancel} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-12">
        {matches.map((match, i) => (
          <motion.div
            key={match.request.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-2xl text-slate-900 tracking-tight">{match.request.ngoName}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Navigation className="w-3 h-3" />
                    {match.distance}KM • {match.request.location.address}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-blue-600">{Math.round(match.score)}%</div>
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-300">Match</div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
              <p className="text-slate-600 font-medium leading-relaxed">{match.request.description}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {match.request.skillsRequired.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {skill}
                  </span>
                ))}
              </div>
              
              <button
                onClick={() => onConfirm(match)}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                Confirm Dispatch
              </button>
            </div>
            
            <div className={`absolute top-0 right-12 px-4 py-1 text-[9px] font-black uppercase tracking-widest text-white rounded-b-lg ${
              match.request.urgency >= 5 ? 'bg-red-500' : 'bg-slate-900'
            }`}>
              UrgencY level {match.request.urgency}
            </div>
          </motion.div>
        ))}

        {matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
              <Clock className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-xl font-bold text-slate-400 tracking-tight">Recalculating proximity matches...</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
