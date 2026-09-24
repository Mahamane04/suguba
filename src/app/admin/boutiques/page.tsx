'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, ExternalLink } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/** Toutes les boutiques (§ page 44). Une boutique masquée ou suspendue n'est plus publique. */

const TYPE: Record<string, string> = { supplier: 'Fournisseur', reseller: 'Revendeur', suguba: 'Suguba' };
const STATUT: Record<string, [string, 'succes' | 'attente' | 'danger']> = { active: ['Publique', 'succes'], hidden: ['Masquée', 'attente'], suspended: ['Suspendue', 'danger'] };

export default function BoutiquesAdminPage() {
  const { toast } = useToast();
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');

  const charger = React.useCallback(() => fetch('/api/admin/boutiques').then((r) => r.json())
    .then((d) => { if (d.error) toast(d.error, { ton: 'erreur' }); setBoutiques(d.boutiques || []); })
    .catch(() => undefined).finally(() => setChargement(false)), [toast]);
  useEffect(() => { charger(); }, [charger]);

  const changer = async (id: string, statut: string) => {
    const r = await fetch('/api/admin/boutiques', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, statut }) });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur' }); return; }
    toast('Boutique mise à jour.', { ton: 'succes' });
    await charger();
  };

  const visibles = boutiques.filter((b) => !filtre || b.type === filtre);
  return (
    <PageReseau titre="Boutiques" sousTitre="Toutes les vitrines du réseau." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }} large>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[['', 'Toutes'], ['supplier', 'Fournisseurs'], ['reseller', 'Revendeurs'], ['suguba', 'Suguba']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltre(v)} className={`px-4 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${filtre === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{l}</button>
        ))}
      </div>
      {chargement ? <Skeleton className="h-32" /> : visibles.length === 0 ? (
        <EmptyState icone={Store} titre="Aucune boutique" />
      ) : (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {visibles.map((b) => {
            const [libelle, ton] = STATUT[b.statut] || [b.statut, 'attente'];
            return (
              <div key={b.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{b.nom}</p>
                    <p className="text-xs text-slate-500">{TYPE[b.type] || b.type} · /{b.slug} · {b.abonnes} abonné{b.abonnes > 1 ? 's' : ''}</p>
                  </div>
                  <StatusPill ton={ton}>{libelle}</StatusPill>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <Link href={`/boutique/${b.slug}`} target="_blank" className="inline-flex items-center gap-1 text-slate-600 min-h-[32px]"><ExternalLink className="w-3.5 h-3.5" />Voir</Link>
                  {b.statut !== 'active' && <button onClick={() => changer(b.id, 'active')} className="text-suguba-brand-dark min-h-[32px]">Rendre publique</button>}
                  {b.statut !== 'hidden' && <button onClick={() => changer(b.id, 'hidden')} className="text-amber-700 min-h-[32px]">Masquer</button>}
                  {b.statut !== 'suspended' && <button onClick={() => changer(b.id, 'suspended')} className="text-rose-700 min-h-[32px]">Suspendre</button>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </PageReseau>
  );
}
