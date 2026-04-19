import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Map as MapIcon, ClipboardList, CheckCircle2, Navigation, Send, X, AlertCircle } from 'lucide-react';
import { AppScreen, NGORequest, VolunteerProfile, MatchResult } from './types';
import { parseVolunteerInput } from './services/geminiService';
import { cn } from './lib/utils';

// Components
import Home from './components/Home';
import VoiceInput from './components/VoiceInput';
import MatchResults from './components/MatchResults';
import VolunteerConfirmation from './components/VolunteerConfirmation';
import NGODashboard from './components/NGODashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [requests, setRequests] = useState<NGORequest[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [isNGO, setIsNGO] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/requests')
      .then(res => res.json())
      .then(data => setRequests(data));

    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'INIT' || data.type === 'UPDATE') {
        setRequests(data.requests);
      } else if (data.type === 'DISPATCH') {
        // Broadcast to NGO dashboard via custom event
        window.dispatchEvent(new CustomEvent('volunteer-dispatched', { detail: data }));
      }
    };

    return () => ws.current?.close();
  }, []);

  const handleConfirmMatch = (match: MatchResult) => {
    setSelectedMatch(match);
    setCurrentScreen('confirmation');
    
    // Notify server of dispatch to close the loop
    fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: match.request.id,
        volunteerId: 'V-' + Math.random().toString(36).substr(2, 5),
        volunteerName: 'Rapid Volunteer'
      })
    });
  };

  const handleVoiceSuccess = async (transcript: string) => {
    try {
      const profile = await parseVolunteerInput(transcript);
      const results = calculateMatches(profile, requests);
      setMatches(results);
      setCurrentScreen('results');
    } catch (error) {
      console.error('Failed to parse input:', error);
      alert('Could not understand. Please try again.');
      setCurrentScreen('home');
    }
  };

  const calculateMatches = (profile: VolunteerProfile, reqs: NGORequest[]): MatchResult[] => {
    return reqs.map(req => {
      let score = 0;
      // Proximity (40%) - Simple mock distance
      const distance = Math.random() * 5 + 1; // 1-6 km
      score += (10 - Math.min(distance * 2, 10)) * 4;

      // Skill match (40%)
      const matchingSkills = req.skillsRequired.filter(s => profile.skills.includes(s));
      score += (matchingSkills.length / Math.max(req.skillsRequired.length, 1)) * 40;

      // Asset match (20%)
      const matchingAssets = req.assetsRequired.filter(a => profile.assets.includes(a));
      score += (matchingAssets.length / Math.max(req.assetsRequired.length, 1)) * 20;

      return { request: req, score, distance: parseFloat(distance.toFixed(1)) };
    }).sort((a, b) => b.score - a.score).slice(0, 3);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
            Z
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ZeroHour</h1>
            <p className="text-[10px] font-semibold text-blue-600 tracking-wider uppercase">Solution Challenge 2026 • Prototype</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> 
            ACTIVE CRISIS: KOLKATA EMERGENCY
          </div>
          <button 
            onClick={() => setIsNGO(!isNGO)}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all hover:bg-slate-800"
          >
            {isNGO ? 'Volunteer Portal' : 'NGO Portal'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {isNGO ? (
            <div key="ngo">
              <NGODashboard 
                requests={requests} 
                onNewRequest={(r) => {
                  fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(r)
                  });
                }}
              />
            </div>
          ) : (
            <div key="volunteer" className="h-full">
              {currentScreen === 'home' && (
                <Home 
                  requests={requests} 
                  onStartVoice={() => setCurrentScreen('voice')} 
                />
              )}
              {currentScreen === 'voice' && (
                <VoiceInput 
                  onCancel={() => setCurrentScreen('home')}
                  onSuccess={handleVoiceSuccess}
                />
              )}
              {currentScreen === 'results' && (
                <MatchResults 
                  matches={matches} 
                  onConfirm={handleConfirmMatch}
                  onCancel={() => setCurrentScreen('home')}
                />
              )}
              {currentScreen === 'confirmation' && selectedMatch && (
                <VolunteerConfirmation 
                  match={selectedMatch}
                  onDone={() => setCurrentScreen('home')}
                />
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
