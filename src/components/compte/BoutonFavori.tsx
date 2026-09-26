'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

// Une seule lecture des favoris par page, partagée entre les boutons.
let favorisDuCompte: Promise<Set<string> | null> | null = null;
const lireFavoris = () => (favorisDuCompte ??= fetch('/api/compte/favoris', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => (j ? new Set<string>((j.favoris || []).map((f: { id: string }) => f.id)) : null))
  .catch(() => null));

/**
 * Favori (2026-09-26, compte client — C2). Sans compte, le cœur invite à se
 * connecter ; acheter reste possible sans compte.
 */
export default function BoutonFavori({ produitId, className = '' }: { produitId: string; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [favori, setFavori] = useState(false);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let annule = false;
    lireFavoris().then((s) => { if (!annule) { setConnecte(Boolean(s)); setFavori(Boolean(s?.has(produitId))); } });
    return () => { annule = true; };
  }, [produitId]);

  const basculer = async () => {
    if (connecte === false) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setEnvoi(true);
    const voulu = !favori;
    setFavori(voulu);
    try {
      const r = await fetch('/api/compte/favoris', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produitId, actif: voulu }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setFavori(!voulu); toast(j?.error || 'Favori non enregistré.', { ton: 'erreur' }); return; }
      favorisDuCompte = null;
      toast(voulu ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.', { ton: 'succes' });
    } catch {
      setFavori(!voulu);
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <button type="button" onClick={basculer} disabled={envoi} aria-pressed={favori}
      aria-label={favori ? 'Retirer de mes favoris' : 'Ajouter à mes favoris'}
      className={`h-9 w-9 rounded-full bg-white/95 shadow-md inline-flex items-center justify-center active:scale-[0.97] transition-all ${className}`}>
      <Heart className={`w-4 h-4 ${favori ? 'fill-rose-600 text-rose-600' : 'text-slate-700'}`} />
    </button>
  );
}
