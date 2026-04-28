import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Don't show for 3 days after dismissal
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Delay the prompt slightly so the app loads first
      setTimeout(() => setShowPrompt(true), 2500);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
    setIsInstalling(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div
      className="fixed bottom-16 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[100] animate-slide-up"
      role="alert"
      aria-label="Install app prompt"
    >
      <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-indigo-500/20 border border-white/20">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />

        <div className="relative p-4 flex items-center space-x-3">
          {/* Icon */}
          <img
            src="/logo.jpeg"
            alt="Zero Hour"
            className="flex-shrink-0 w-12 h-12 rounded-xl object-cover ring-1 ring-white/30 shadow-lg"
          />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              Install Zero Hour
            </p>
            <p className="text-xs text-indigo-200 mt-0.5 leading-snug">
              Add to home screen for instant access & offline mode
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex items-center space-x-1.5 bg-white text-indigo-700 font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-indigo-50 active:scale-95 transition-all disabled:opacity-60 shadow-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isInstalling ? '...' : 'Install'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
