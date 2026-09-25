'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

/** L’état réseau du navigateur ne constitue pas une preuve de synchronisation. */
export default function CloudSyncBadge() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
  }, []);
  return (
    <span role="status" title="L’état du réseau ne confirme pas la mise à jour des données. Actualisez pour les vérifier."
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border text-slate-700 bg-slate-50">
      {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {online === null ? 'Vérification du réseau…' : online ? 'Réseau disponible' : 'Hors connexion'}
    </span>
  );
}
