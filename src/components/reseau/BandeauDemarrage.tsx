'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, ChevronRight } from 'lucide-react';

/** Invite à finir l'assistant de démarrage. Disparaît une fois terminé. */
export default function BandeauDemarrage() {
  const [afficher, setAfficher] = useState(false);
  useEffect(() => {
    fetch('/api/reseller/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.reseller && !d.reseller.onboardingDone) setAfficher(true); })
      .catch(() => undefined);
  }, []);
  if (!afficher) return null;

  return (
    <Link href="/reseller/demarrer"
      className="flex items-center gap-3 rounded-3xl bg-slate-900 text-white p-4 active:scale-[0.99] transition-transform">
      <span className="w-10 h-10 rounded-2xl bg-suguba-brand flex items-center justify-center shrink-0"><Rocket className="w-5 h-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Terminez votre démarrage</span>
        <span className="block text-xs text-slate-300">8 étapes courtes : votre boutique, votre quartier, vos catégories.</span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </Link>
  );
}
