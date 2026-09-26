'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircleQuestion } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

/**
 * « Poser une question au fournisseur » (2026-09-26, Protection Suguba —
 * lot 3) : visible par un revendeur connecté, sur la fiche d'un produit.
 */
export default function BoutonQuestionFournisseur({ produitId }: { produitId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [envoi, setEnvoi] = useState(false);
  const ouvrir = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ouvrir_offre', produitId }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.id) { toast(j?.error || 'Messagerie indisponible.', { ton: 'erreur' }); return; }
      router.push(`/reseller/questions?c=${j.id}`);
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };
  return (
    <button type="button" onClick={ouvrir} disabled={envoi}
      className="w-full min-h-11 rounded-2xl border border-slate-200 bg-white text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60">
      {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircleQuestion className="w-4 h-4" />}
      Poser une question au fournisseur
    </button>
  );
}
