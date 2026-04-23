import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Sparkles, Keyboard, Send, ArrowLeft } from 'lucide-react';

const QUICK_PHRASES = [
  "I have a vehicle and first aid skills",
  "I can swim and have a boat",
  "I have medical training, free for 4 hours",
  "I have construction tools and heavy lifting skills",
];

export default function VoiceCapture({ onTranscriptComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('voice'); // 'voice' | 'text'
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        stopRecording();
      };
    }
  }, []);

  useEffect(() => {
    if (mode === 'text' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  const startRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    setTranscript('');
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      setTimeout(() => {
        setIsProcessing(false);
        onTranscriptComplete(transcript || "I have a 4x4 vehicle and basic first aid.");
      }, 1000);
    }
  };

  const handleQuickPhrase = (phrase) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onTranscriptComplete(phrase);
    }, 800);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onTranscriptComplete(textInput.trim());
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  // ── TEXT MODE ──
  if (mode === 'text') {
    return (
      <div className="w-full bg-white flex flex-col slide-up rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-slate-100">
          <button 
            onClick={() => setMode('voice')} 
            className="flex items-center space-x-1.5 text-slate-400 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold">Voice</span>
          </button>
          <h2 className="text-sm font-extrabold text-slate-700 tracking-tight">Describe Your Availability</h2>
          <div className="w-14"></div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-4 pb-20">

        {/* Text area */}
        <div className="relative mb-3">
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={3}
            placeholder="e.g. I have a 4x4 vehicle, medical training, and I'm available for the next 3 hours near Salt Lake area..."
            className="w-full p-4 pr-12 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all resize-none custom-scrollbar placeholder:text-slate-300"
          />
          <button
            onClick={handleTextSubmit}
            disabled={isProcessing || !textInput.trim()}
            className={`absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              textInput.trim() 
                ? 'bg-gradient-to-tr from-primary to-secondary text-white shadow-md shadow-primary/30 hover:-translate-y-0.5 active:scale-90' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Helper chips */}
        <div className="mb-2">
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2">Try mentioning:</p>
          <div className="flex flex-wrap gap-1.5">
            {['skills', 'vehicle type', 'availability hours', 'location'].map(hint => (
              <span key={hint} className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                {hint}
              </span>
            ))}
          </div>
        </div>

        {/* Quick fill */}
        <div className="mt-2 space-y-2">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick fill</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PHRASES.map((phrase, i) => (
              <button
                key={i}
                onClick={() => setTextInput(phrase)}
                className="text-[10px] font-medium text-slate-500 bg-slate-50 hover:bg-primary-light/40 hover:text-primary border border-slate-100 hover:border-primary/20 px-2.5 py-1 rounded-full transition-all duration-200 active:scale-95"
              >
                {phrase}
          </button>
            ))}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ── VOICE MODE ──
  return (
    <div className="flex flex-col items-center justify-center p-6 pb-4 glass-panel rounded-t-[2rem]">
      <div className="text-center space-y-2 mb-5">
        <h2 className="text-2xl font-extrabold bg-gradient-to-br from-primary-hover via-primary to-secondary bg-clip-text text-transparent tracking-tight">
          {isRecording ? "Listening..." : isProcessing ? "Processing..." : "Tap to Speak"}
        </h2>
        <p className="text-slate-400 text-xs max-w-[260px] mx-auto font-medium leading-relaxed">
          State your skills, assets & availability. AI will match you to the nearest crisis.
        </p>
      </div>

      <div className="relative flex items-center justify-center h-28 w-28 mb-4">
        {isRecording && (
          <div className="absolute inset-0 bg-primary-light/50 rounded-full ripple"></div>
        )}
        
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-2xl ${
            isRecording ? 'bg-rose-500 hover:bg-rose-600 scale-110 shadow-rose-500/40' : 'bg-gradient-to-tr from-primary to-secondary hover:-translate-y-1 shadow-primary/40'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? (
             <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : isRecording ? (
             <Square className="w-7 h-7 text-white fill-white" />
          ) : (
             <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {isRecording && transcript && (
        <div className="w-full p-3 bg-slate-50 rounded-xl max-h-24 overflow-y-auto mb-3 border border-slate-100 custom-scrollbar">
          <p className="text-slate-700 italic text-sm">"{transcript}"</p>
        </div>
      )}

      {/* Mode switch + Quick phrases */}
      {!isRecording && !isProcessing && (
        <>
          {/* Switch to text mode */}
          <button
            onClick={() => setMode('text')}
            className="flex items-center space-x-2 mb-4 px-4 py-2 bg-slate-50 hover:bg-primary-light/30 border border-slate-100 hover:border-primary/20 rounded-xl transition-all duration-200 active:scale-95 group"
          >
            <Keyboard className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="text-xs font-bold text-slate-400 group-hover:text-primary transition-colors">Type instead</span>
          </button>

          {/* Quick phrases */}
          <div className="w-full space-y-2 mt-1">
            <div className="flex items-center space-x-1.5 px-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick dispatch</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PHRASES.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPhrase(phrase)}
                  className="text-[11px] font-medium text-slate-500 bg-slate-50 hover:bg-primary-light/40 hover:text-primary border border-slate-100 hover:border-primary/20 px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
