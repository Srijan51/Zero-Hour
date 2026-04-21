import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VoiceCapture({ onTranscriptComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);

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
      
      // Simulate slight processing delay for dramatic effect
      setTimeout(() => {
        setIsProcessing(false);
        onTranscriptComplete(transcript || "I have a 4x4 vehicle and basic first aid.");
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-white/80 backdrop-blur-md shadow-2xl rounded-t-3xl border-t border-slate-200">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          {isRecording ? "Listening..." : "Tap to Speak"}
        </h2>
        <p className="text-slate-500 text-sm max-w-xs">
          State your availability, skills, and assets. We'll match you instantly.
        </p>
      </div>

      <div className="relative flex items-center justify-center h-32 w-32">
        {isRecording && (
          <div className="absolute inset-0 bg-blue-100 rounded-full ripple"></div>
        )}
        
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-transform ${
            isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:scale-105'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? (
             <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : isRecording ? (
             <Square className="w-8 h-8 text-white fill-white" />
          ) : (
             <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {isRecording && transcript && (
        <div className="w-full p-4 bg-slate-100 rounded-xl max-h-32 overflow-y-auto">
          <p className="text-slate-700 italic text-sm">"{transcript}"</p>
        </div>
      )}
    </div>
  );
}
