import { motion } from 'motion/react';
import { Mic, MapPin } from 'lucide-react';
import { NGORequest } from '../types';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { cn } from '../lib/utils';

interface HomeProps {
  requests: NGORequest[];
  onStartVoice: () => void;
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

export default function Home({ requests, onStartVoice }: HomeProps) {
  const center = { lat: 22.5726, lng: 88.3639 }; // Kolkata center

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full relative flex flex-col"
    >
      {/* Map Implementation */}
      <div className="absolute inset-0 bg-slate-900 overflow-hidden">
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              defaultCenter={center}
              defaultZoom={13}
              mapId="bf50473038ce0994" // Use a dark mode map ID if possible
              gestureHandling={'none'}
              disableDefaultUI={true}
              className="w-full h-full grayscale opacity-40 brightness-50"
            >
              {requests.map((req) => (
                <Marker 
                  key={req.id} 
                  position={{ lat: req.location.lat, lng: req.location.lng }}
                />
              ))}
            </Map>
          </APIProvider>
        ) : (
          <div className="absolute inset-0">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-20" style={{ 
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
              backgroundSize: '32px 32px' 
            }} />
            
            {/* Scanning Line */}
            <motion.div 
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-px bg-blue-500/30 blur-sm z-20"
            />
            
            {/* Mock Pins Fallback */}
            {requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="absolute"
                style={{ 
                  top: `${20 + (i * 15)}%`, 
                  left: `${30 + (i * 20)}%` 
                }}
              >
                <div className="relative group">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer border-2 border-white",
                    req.urgency >= 5 ? 'bg-red-500 shadow-red-500/20' : 'bg-blue-600 shadow-blue-600/20'
                  )}>
                    <MapPin className="text-white w-3 h-3" />
                  </div>
                  
                  {/* Ping Effect for active crises */}
                  {req.urgency >= 5 && (
                    <motion.div 
                      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500 rounded-full"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Summary Sheet */}
      <div className="mt-auto p-8 z-10 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-200 mb-6 flex flex-col items-center text-center"
          >
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative mb-8">
              <div className="absolute inset-0 bg-blue-400 rounded-full opacity-20 scale-125 animate-pulse"></div>
              <Mic className="text-blue-600 w-10 h-10 relative z-10" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Tap to Help</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-xs leading-relaxed">
              Speak naturally. No forms, no commitments. Just tell us what you have and when you're free.
            </p>
            
            <button
              onClick={onStartVoice}
              className="w-full bg-blue-600 text-white rounded-2xl py-5 font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
            >
              Start Speaking
            </button>
            
            <div className="mt-6 flex gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
              <span>Voice AI</span>
              <span className="opacity-40">•</span>
              <span>Real-time</span>
              <span className="opacity-40">•</span>
              <span>Sub-60s</span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
