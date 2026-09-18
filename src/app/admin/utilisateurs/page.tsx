'use client';

import React, { useEffect, useState } from 'react';
import { Users, Search, ShieldCheck, Ban, RotateCcw } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/** Annuaire admin (§ pages 38 à 41) : clients, revendeurs, fournisseurs, livreurs. */

type Onglet = 'clients' | 'revendeurs' | 'fournisseurs' | 'livreurs';
const ONGLETS: [Onglet, string][] = [['revendeurs', 'Revendeurs'], ['fournisseurs', 'Fournisseurs'], ['livreurs', 'Livreurs'], ['clients', 'Clients']];
const fcfa = (v: number) => `${Math.round(v || 0).toLocaleString('fr-FR')} F`;

export default function UtilisateursPage() {
  const { toast } = useToast();
  const [onglet, setOnglet] = useState<Onglet>('revendeurs');
  const [q, setQ] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);
  const [badges, setBadges] = useState<{ cle: string; libelle: string }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = React.useCallback(() => {
    setChargement(true);
    return fetch(`/api/admin/utilisateurs?onglet=${onglet}&q=${encodeURIComponent(q.trim())}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) toast(d.error, { ton: 'erreur' }); setLignes(d.lignes || []); setBadges(d.badges || []); })
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, [onglet, q, toast]);

  useEffect(() => { const t = setTimeout(charger, 250); return () => clearTimeout(t); }, [charger]);

  const action = async (corps: Record<string, unknown>, succes: string) => {
    const r = await fetch('/api/admin/utilisateurs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corps, onglet }) });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur' }); return; }
    toast(succes, { ton: 'succes' });
    await charger();
  };

  return (
    <PageReseau titre="Utilisateurs" sousTitre="Clients, revendeurs, fournisseurs et livreurs." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }} large>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ONGLETS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={onglet === v} onClick={() => setOnglet(v)}
            className={`px-4 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${onglet === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{l}</button>
        ))}
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, e-mail, code" className="pl-10" aria-label="Rechercher" />
      </div>

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : lignes.length === 0 ? (
        <EmptyState icone={Users} titre="Personne ici" texte={q ? 'Aucun résultat pour cette recherche.' : 'Aucun compte dans cette catégorie.'} />
      ) : onglet === 'clients' ? (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {lignes.map((c) => (
            <div key={c.telephone} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{c.nom}</p>
                <p className="text-[11px] text-slate-500">{c.telephone}{c.referent ? ` · via ${c.referent}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-900 tabular-nums">{fcfa(c.montant)}</p>
                <p className="text-[11px] text-slate-500">{c.livrees}/{c.commandes} livrée{c.commandes > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {lignes.map((u) => (
            <Card key={u.id} className="space-y-2">
              <button type="button" className="w-full text-left flex items-start justify-between gap-3" onClick={() => setOuvert(ouvert === u.id ? null : u.id)} aria-expanded={ouvert === u.id}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{u.nom || 'Sans nom'}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[u.telephone, u.email, u.code, u.ville].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {onglet === 'revendeurs' && `${u.stats.ventes || 0} vente(s) · ${fcfa(u.stats.commissions)} de commissions`}
                    {onglet === 'fournisseurs' && `${u.stats.produits || 0} produit(s) · ${u.stats.enVente || 0} en vente`}
                    {onglet === 'livreurs' && `${u.stats.livraisons || 0} livraison(s)`}
                  </p>
                </div>
                <StatusPill ton={u.statut === 'active' ? 'succes' : u.statut === 'suspended' ? 'danger' : 'attente'}>
                  {u.statut === 'active' ? 'Actif' : u.statut === 'suspended' ? 'Suspendu' : 'En attente'}
                </StatusPill>
              </button>
              {u.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{u.badges.map((b: string) => <StatusPill key={b} ton="info"><ShieldCheck className="w-3 h-3" />{badges.find((x) => x.cle === b)?.libelle || b.replace(/_/g, ' ')}</StatusPill>)}</div>
              )}
              {ouvert === u.id && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((b) => {
                      const a = u.badges.includes(b.cle);
                      return (
                        <button key={b.cle} type="button" onClick={() => action({ action: 'badge', profileId: u.id, badge: b.cle, retirer: a }, a ? 'Badge retiré.' : 'Badge attribué.')}
                          className={`px-3 min-h-[36px] rounded-full text-[11px] font-bold border ${a ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                          {a ? '✓ ' : '+ '}{b.libelle}
                        </button>
                      );
                    })}
                  </div>
                  {u.statut === 'suspended' ? (
                    <Button size="sm" variant="ghost" onClick={() => action({ action: 'statut', profileId: u.id, statut: 'active' }, 'Compte réactivé.')}><RotateCcw className="w-3.5 h-3.5" />Réactiver</Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => action({ action: 'statut', profileId: u.id, statut: 'suspended' }, 'Compte suspendu.')}><Ban className="w-3.5 h-3.5" />Suspendre ce rôle</Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
