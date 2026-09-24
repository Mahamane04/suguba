'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

/**
 * Cloche de notifications de l'en-tête.
 *
 * Chaque page monte son propre en-tête (pas de layout partagé, voir
 * BottomNav) : sans cache, on referait une requête à chaque navigation. Le
 * compteur est gardé une minute au niveau du module.
 */

let cache: { nonLues: number; le: number } | null = null;
const DUREE_CACHE = 60_000;

/** Remet le compteur à zéro après lecture (appelé par /notifications). */
export function viderCacheNotifications() {
  cache = { nonLues: 0, le: Date.now() };
}

export default function ClocheNotifications() {
  const [nonLues, setNonLues] = useState(cache?.nonLues ?? 0);

  useEffect(() => {
    if (cache && Date.now() - cache.le < DUREE_CACHE) { setNonLues(cache.nonLues); return; }
    let annule = false;
    fetch('/api/reseau/notifications')
      .then((r) => r.json())
      .then((data) => {
        const n = Number(data.nonLues) || 0;
        cache = { nonLues: n, le: Date.now() };
        if (!annule) setNonLues(n);
      })
      .catch(() => { /* la cloche reste neutre */ });
    return () => { annule = true; };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={nonLues > 0 ? `${nonLues} notification${nonLues > 1 ? 's' : ''} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
      className="relative w-10 h-10 shrink-0 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
    >
      <Bell className="w-5 h-5" />
      {nonLues > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
          {nonLues > 9 ? '9+' : nonLues}
        </span>
      )}
    </Link>
  );
}
