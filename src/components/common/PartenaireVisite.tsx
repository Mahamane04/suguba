'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { codeRevendeurVisite } from '@/lib/ancrage-revendeur';

/**
 * « Votre partenaire : Fatou D. » (lot B, 2026-09-26) — le revendeur par qui
 * le client est arrivé reste visible jusqu'à la commande. Simple indication :
 * c'est le serveur qui décide de l'attribution au moment de commander.
 */
export default function PartenaireVisite({ refUrl = null, className = '' }: { refUrl?: string | null; className?: string }) {
  const [nom, setNom] = useState<string | null>(null);
  useEffect(() => {
    const code = codeRevendeurVisite(refUrl);
    if (!code) return;
    let annule = false;
    fetch(`/api/shop/revendeur?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!annule && j?.nom) setNom(j.nom); })
      .catch(() => {});
    return () => { annule = true; };
  }, [refUrl]);
  if (!nom) return null;
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs text-slate-700 ${className}`}>
      <Users className="w-3.5 h-3.5 text-suguba-profond" aria-hidden />
      Votre partenaire : <strong className="text-slate-900">{nom}</strong>
    </p>
  );
}
