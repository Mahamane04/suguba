'use client';

import React from 'react';
import { History, Wallet } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import PaymentLogo, { moyenDepuisCode } from '@/components/ui/PaymentLogo';
import type { RetraitAffiche } from '@/lib/retraits-affichage';
import { formatF, FORMAT_DATE } from '@/lib/montant';

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  pending: { libelle: 'En attente', classe: 'bg-amber-50 text-amber-800' },
  processing: { libelle: 'Virement en cours', classe: 'bg-amber-50 text-amber-800' },
  completed: { libelle: 'Versé', classe: 'bg-suguba-brand/10 text-suguba-brand-dark' },
  rejected: { libelle: 'Refusé', classe: 'bg-rose-50 text-rose-700' },
};

const enF = formatF;

/** Historique des retraits — commun au revendeur et au fournisseur (lot C, 2026-09-27). */
export default function HistoriqueRetraits({ retraits }: { retraits: RetraitAffiche[] }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
      <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
        <History className="w-5 h-5 text-slate-500" />
        <span>Historique des retraits</span>
      </h2>
      {retraits.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun retrait pour le moment." />
      ) : (
        <div className="divide-y divide-slate-100">
          {retraits.map((r) => {
            const s = STATUTS[r.statut] || { libelle: r.statut, classe: 'bg-slate-100 text-slate-600' };
            return (
              <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <PaymentLogo moyen={/agence|cash|esp/i.test(r.moyen) ? 'especes' : moyenDepuisCode(r.moyen)} taille="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{enF(r.montant)} · {r.moyen}</p>
                    {(r.frais ?? 0) > 0 && (
                      <p className="text-xs text-slate-500">Demandé {enF(r.montantDemande ?? r.montant)}, frais {enF(r.frais as number)}</p>
                    )}
                    <p className="text-xs text-slate-500 truncate">
                      {new Date(r.creeLe).toLocaleDateString('fr-FR', FORMAT_DATE.complet)}
                      {' · '}<span className="font-mono">{r.id}</span>
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${s.classe}`}>{s.libelle}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
