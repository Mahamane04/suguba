'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, ShoppingCart } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';

/**
 * Toutes les commandes (§ page 45). Lecture et recherche ; les changements de
 * statut restent sur la vue globale, qui applique les règles de livraison et
 * de commission.
 */

const STATUTS: [string, string, 'succes' | 'attente' | 'danger' | 'neutre' | 'info'][] = [
  ['pending_call', 'À confirmer', 'attente'], ['confirmed', 'Confirmée', 'info'], ['assigned_driver', 'Livreur assigné', 'info'],
  ['in_delivery', 'En livraison', 'info'], ['delivered', 'Livrée', 'succes'], ['cancelled', 'Annulée', 'danger'], ['returned', 'Retournée', 'neutre'],
];
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;

export default function CommandesAdminPage() {
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const [commandes, setCommandes] = useState<any[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/commandes?statut=${statut}&q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json()).then((d) => { setCommandes(d.commandes || []); setCompteurs(d.compteurs || {}); })
        .catch(() => undefined).finally(() => setChargement(false));
    }, 250);
    return () => clearTimeout(t);
  }, [statut, q]);

  // Articles d'un même panier regroupés : c'est une seule commande pour le client.
  const groupes = useMemo(() => {
    const g: { cle: string; lignes: any[] }[] = [];
    const index = new Map<string, number>();
    for (const c of commandes) {
      const cle = c.panier || c.id;
      if (!index.has(cle)) { index.set(cle, g.length); g.push({ cle, lignes: [] }); }
      g[index.get(cle)!].lignes.push(c);
    }
    return g;
  }, [commandes]);

  return (
    <PageReseau titre="Commandes" sousTitre="Toutes les commandes, avec recherche." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }} large
      action={<Link href="/admin" className="text-xs font-bold text-slate-600 underline min-h-[32px] inline-flex items-center">Gérer sur la vue globale</Link>}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setStatut('')} className={`px-3.5 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${!statut ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Toutes</button>
        {STATUTS.map(([v, l]) => (
          <button key={v} onClick={() => setStatut(v)} className={`px-3.5 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${statut === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {l}{compteurs[v] ? ` · ${compteurs[v]}` : ''}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro, client, téléphone, produit, code revendeur" className="pl-10" aria-label="Rechercher une commande" />
      </div>

      {chargement ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        : groupes.length === 0 ? <EmptyState icone={ShoppingBag} titre="Aucune commande" />
        : (
          <div className="space-y-2.5">
            {groupes.map(({ cle, lignes }) => {
              const tete = lignes[0];
              const total = lignes.reduce((s, l) => s + l.total, 0);
              return (
                <Card key={cle} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{tete.client} · {tete.telephone}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(tete.creeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {tete.ville}{tete.quartier ? `, ${tete.quartier}` : ''}
                        {tete.revendeur ? ` · via ${tete.revendeur}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{fcfa(total)}</span>
                  </div>
                  {lignes.length > 1 && <StatusPill ton="info"><ShoppingCart className="w-3 h-3" />Panier de {lignes.length} articles</StatusPill>}
                  <div className="divide-y divide-slate-100">
                    {lignes.map((l) => {
                      const s = STATUTS.find(([v]) => v === l.statut);
                      return (
                        <div key={l.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-slate-700"><strong className="text-slate-900">{l.numero}</strong> · {l.quantite} × {l.produit}</span>
                          <StatusPill ton={s?.[2] || 'neutre'}>{s?.[1] || l.statut}</StatusPill>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </PageReseau>
  );
}
