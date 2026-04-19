import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Mic, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

interface VoiceInputProps {
  onCancel: () => void;
  onSuccess: (transcript: string) => void;
}

export default function VoiceInput({ onCancel, onSuccess }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setTranscript(prev => prev + event.results[i][0].transcript + ' ');
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert("Speech recognition not supported in this browser.");
      onCancel();
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [onCancel]);

  const handleSubmit = () => {
    if (transcript.trim()) {
      setIsProcessing(true);
      onSuccess(transcript.trim());
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-slate-900 z-50 flex flex-col text-white p-12"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ 
        backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
        backgroundSize: '32px 32px' 
      }} />

      <div className="flex justify-end relative z-10">
        <button onClick={onCancel} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
          <X className="w-8 h-8" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full relative z-10">
        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20">
          <Mic className="w-10 h-10 text-white animate-pulse" />
        </div>
        
        <h2 className="text-4xl font-bold mb-4 tracking-tight">Listening...</h2>
        <p className="text-white/40 mb-12 max-w-xs uppercase text-[10px] font-black tracking-widest">
          Describe your skills and current availability
        </p>

        {/* Waveform Animation */}
        <div className="flex items-center gap-2 h-20 mb-16">
          {[...Array(24)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                height: isRecording ? [10, Math.random() * 60 + 10, 10] : 10 
              }}
              transition={{ 
                duration: 0.4, 
                repeat: Infinity, 
                delay: i * 0.03 
              }}
              className="w-1.5 bg-blue-500 rounded-full"
            />
          ))}
        </div>

        <div className="w-full bg-white/5 rounded-[2rem] p-8 min-h-[160px] mb-12 relative border border-white/10 shadow-inner overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          <p className="text-xl leading-relaxed text-left font-medium">
            {transcript || <span className="opacity-20 italic">"I have a 4x4 Jeep and two free hours..."</span>}
          </p>
        </div>

        <div className="flex gap-4 w-full">
          <button
            onClick={() => {
              setTranscript('');
              recognitionRef.current?.stop();
              recognitionRef.current?.start();
            }}
            className="flex-1 border border-white/10 rounded-2xl py-5 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/5 transition-colors"
          >
            Clear Transcript
          </button>
          <button
            onClick={handleSubmit}
            disabled={!transcript.trim() || isProcessing}
            className={cn(
              "flex-1 bg-blue-600 text-white rounded-2xl py-5 font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95",
              (!transcript.trim() || isProcessing) && "opacity-50 cursor-not-allowed scale-100"
            )}
          >
            {isProcessing ? 'AI Analyzing...' : 'Identify Matches'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
