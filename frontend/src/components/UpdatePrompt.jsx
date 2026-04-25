import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // vite-plugin-pwa fires a custom event when a new SW is available
    const handleSWUpdate = () => setNeedRefresh(true);

    // Listen to the registration event from the virtual module
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A new service worker has taken control
        setNeedRefresh(true);
      });
    }

    document.addEventListener('swUpdated', handleSWUpdate);
    return () => document.removeEventListener('swUpdated', handleSWUpdate);
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[150]">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 p-4 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Update available</p>
          <p className="text-xs text-slate-400 mt-0.5">A new version is ready</p>
        </div>
        <button
          onClick={handleUpdate}
          className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
