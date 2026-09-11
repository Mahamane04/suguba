'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, X, Loader2 } from 'lucide-react';
import { sugubaStore, useSugubaStore, useApercuAdmin, definirApercuAdmin } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

const LIBELLE_ROLE: Record<string, string> = {
  customer: 'Client',
  reseller: 'Revendeur',
  supplier: 'Fournisseur',
  diaspora: 'Diaspora',
};

/**
 * Bandeau « Aperçu admin » (2026-09-11) — rappel permanent qu'on navigue
 * sous une identité de test posée par un admin (voir
 * /api/admin/preview-role), pour ne jamais confondre cet état avec un vrai
 * compte. Monté UNE SEULE FOIS dans layout.tsx (jamais dans une page), donc
 * jamais soumis au bug de flash déjà corrigé sur Header/BottomNav — il n'a
 * même pas besoin de refaire une requête, tout vient du store déjà résolu.
 */
export default function PreviewBanner() {
  const enApercu = useApercuAdmin();
  const state = useSugubaStore();
  const router = useRouter();
  const { toast } = useToast();
  const [sortie, setSortie] = useState(false);

  if (!enApercu) return null;

  const quitterApercu = async () => {
    setSortie(true);
    try {
      const res = await fetch('/api/auth/preview-exit', { method: 'POST' });
      if (!res.ok) {
        toast("Impossible de quitter l'aperçu — reconnectez-vous en admin si besoin.", { ton: 'erreur' });
        return;
      }
      // L'identité admin (nom, ville) n'est pas dans le jeton d'aperçu par
      // sécurité : un aller-retour supplémentaire, rare, la recharge.
      const moi = await fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      sugubaStore.definirUtilisateur(
        moi?.authenticated ? { id: moi.uid, fullName: moi.fullName, phone: moi.phone, role: moi.role, city: moi.city } : null,
      );
      definirApercuAdmin(false);
      router.push('/admin');
    } finally {
      setSortie(false);
    }
  };

  return (
    <div className="bg-amber-400 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-3 text-xs font-bold">
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Aperçu admin — espace {LIBELLE_ROLE[state.currentUser.role] || state.currentUser.role}
          </span>
        </span>
        <button
          type="button"
          onClick={quitterApercu}
          disabled={sortie}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white hover:bg-black disabled:opacity-60"
        >
          {sortie ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          <span>Quitter l&apos;aperçu</span>
        </button>
      </div>
    </div>
  );
}
