import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Signal } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
      setWasOffline(true);
    };

    const goOnline = () => {
      setIsOffline(false);
      // Show "back online" briefly, then hide
      if (wasOffline) {
        setTimeout(() => setShowBanner(false), 3000);
      }
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [wasOffline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[200] transition-all duration-500 ${
        isOffline ? 'translate-y-0' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-bold tracking-wide text-white transition-colors duration-300 ${
          isOffline
            ? 'bg-gradient-to-r from-rose-600 to-orange-500'
            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {isOffline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            <span>You're offline — cached data is still available</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 p-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
              aria-label="Retry connection"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <Signal className="w-3.5 h-3.5" />
            <span>Back online</span>
          </>
        )}
      </div>
    </div>
  );
}
