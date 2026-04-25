import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  error: 'bg-rose-50 border-rose-200 text-rose-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const ICON_COLORS = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export default function Toast({ message, type = 'info', onClose, duration = 3500 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose?.(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = ICONS[type] || ICONS.info;

  return (
    <div
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 min-w-[280px] max-w-[420px] ${COLORS[type] || COLORS.info} ${
        isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${ICON_COLORS[type]}`} />
      <p className="text-sm font-semibold flex-1">{message}</p>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => onClose?.(), 300);
        }}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-3.5 h-3.5 opacity-50" />
      </button>
    </div>
  );
}

// ─── Toast Container (use this in your pages) ─────────────────
export function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
            message={t.message}
            type={t.type}
            duration={t.duration}
            onClose={() => removeToast(t.id)}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────
let toastIdCounter = 0;
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3500) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
