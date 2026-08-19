'use client';

import React, { useState, useEffect } from 'react';
import { cloudSyncService } from '@/lib/cloud-sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Database, Zap, RefreshCw, CheckCircle2, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export default function CloudSyncBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [cloudActive, setCloudActive] = useState(false);

  useEffect(() => {
    setCloudActive(cloudSyncService.isCloudActive());

    // Init realtime listener if active
    if (cloudSyncService.isCloudActive()) {
      cloudSyncService.initRealtimeSync();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all shadow-2xs">
      {cloudActive ? (
        <span className="flex items-center space-x-1.5 text-emerald-800 bg-emerald-50 border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Cloud Live (PostgreSQL Sync)</span>
        </span>
      ) : (
        <span className="flex items-center space-x-1.5 text-slate-700 bg-slate-100 border-slate-200">
          <Zap className="w-3 h-3 text-amber-500 fill-current" />
          <span>Local Engine (Offline-First 0.2s)</span>
        </span>
      )}

      {isOnline ? (
        <span title="Connecté à Internet">
          <Wifi className="w-3 h-3 text-emerald-600" />
        </span>
      ) : (
        <span title="Mode Hors-Ligne (Données en cache)">
          <WifiOff className="w-3 h-3 text-rose-500 animate-bounce" />
        </span>
      )}
    </div>
  );
}
