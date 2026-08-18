'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !justReconnected) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 py-2 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
      {isOffline ? (
        <div className="bg-slate-900/95 text-white border border-slate-700 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center space-x-2 text-xs font-bold pointer-events-auto">
          <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Mode Hors-Ligne actif (Réseau 3G/4G faible) • Données locales sauvegardées</span>
        </div>
      ) : (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center space-x-2 text-xs font-bold pointer-events-auto">
          <Wifi className="w-4 h-4 text-emerald-200" />
          <span>Connexion rétablie • Données synchronisées</span>
        </div>
      )}
    </div>
  );
}
