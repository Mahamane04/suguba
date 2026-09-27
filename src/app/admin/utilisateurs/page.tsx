'use client';

import React, { useEffect, useState } from 'react';
import { Users, Search, ShieldCheck, Ban, RotateCcw } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import TableauAdmin, { type Colonne } from '@/components/admin/TableauAdmin';
import Panneau from '@/components/admin/Panneau';

/**
 * Annuaire admin (§ pages 38 à 41) : clients, revendeurs, fournisseurs,
 * livreurs. Tableau et panneau latéral (badges, suspension) depuis U4
 * (2026-09-27).
 */

type Onglet = 'clients' | 'revendeurs' | 'fournisseurs' | 'livreurs';
const ONGLETS: [Onglet, string][] = [['revendeurs', 'Revendeurs'], ['fournisseurs', 'Fournisseurs'], ['livreurs', 'Livreurs'], ['clients', 'Clients']];
const fcfa = (v: number) => `${Math.round(v || 0).toLocaleString('fr-FR')} F`;

export default function UtilisateursPage() {
  const { toast, demander } = useToast();
  const [onglet, setOnglet] = useState<Onglet>('revendeurs');
  const [q, setQ] = useState('');
  // Lien de la recherche globale ou de « À traiter » (A1) : recherche pré-remplie.
  useEffect(() => { const d = new URLSearchParams(window.location.search).get('q'); if (d) setQ(d); }, []);
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
    // Suspension (Protection Suguba, lot 3) : ce qui reste en cours est à traiter à part.
    const e = d.engagements as { commandesEnCours: number; gainsEnAttente: number; gainsDisponibles: number } | undefined;
    const reste = e && (e.commandesEnCours || e.gainsEnAttente || e.gainsDisponibles)
      ? ` À traiter : ${e.commandesEnCours} commande(s) en cours${e.gainsEnAttente + e.gainsDisponibles > 0 ? `, ${fcfa(e.gainsEnAttente + e.gainsDisponibles)} de gains qui restent dus` : ''}.`
      : '';
    toast(succes + reste, { ton: 'succes' });
    await charger();
  };
  const suspendreRole = async (id: string) => {
    const motif = await demander({
      titre: 'Suspendre ce rôle ?', message: 'Le partenaire verra ce motif et pourra le contester.',
      libelle: 'Motif de la suspension', min: 5, confirmer: 'Suspendre', danger: true,
    });
    if (!motif) return;
    action({ action: 'statut', profileId: id, statut: 'suspended', motif }, 'Rôle suspendu.');
  };
  const reactiverRole = async (id: string) => {
    const decision = await demander({
      titre: 'Réactiver ce rôle ?', message: 'Facultatif : le partenaire verra votre décision.',
      libelle: 'Décision', min: 0, confirmer: 'Réactiver',
    });
    if (decision === null) return;
    action({ action: 'statut', profileId: id, statut: 'active', decision }, 'Rôle réactivé.');
  };

  const libelleStatut = (st: string) => (st === 'active' ? 'Actif' : st === 'suspended' ? 'Suspendu' : 'En attente');
  const tonStatut = (st: string) => (st === 'active' ? 'succes' : st === 'suspended' ? 'danger' : 'attente') as 'succes' | 'danger' | 'attente';
  const activite = (u: any) => onglet === 'revendeurs' ? `${u.stats.ventes || 0} vente(s) · ${fcfa(u.stats.commissions)}`
    : onglet === 'fournisseurs' ? `${u.stats.produits || 0} produit(s) · ${u.stats.enVente || 0} en vente`
    : `${u.stats.livraisons || 0} livraison(s)`;
  const triActivite = (u: any) => onglet === 'revendeurs' ? Number(u.stats.ventes) || 0 : onglet === 'fournisseurs' ? Number(u.stats.produits) || 0 : Number(u.stats.livraisons) || 0;

  const colonnesPartenaires: Colonne<any>[] = [
    { cle: 'nom', titre: 'Nom', fixe: true, tri: (u) => u.nom || '', rendu: (u) => <span className="font-bold text-slate-900">{u.nom || 'Sans nom'}</span> },
    { cle: 'telephone', titre: 'Téléphone', rendu: (u) => <span className="tabular-nums">{u.telephone || '—'}</span> },
    { cle: 'email', titre: 'E-mail', cachee: true, rendu: (u) => u.email || '—' },
    { cle: 'code', titre: 'Code', rendu: (u) => (u.code ? <span className="font-mono text-xs">{u.code}</span> : '—') },
    { cle: 'ville', titre: 'Ville', cachee: true, tri: (u) => u.ville || '', rendu: (u) => u.ville || '—' },
    { cle: 'activite', titre: 'Activité', tri: triActivite, rendu: activite },
    { cle: 'badges', titre: 'Badges', rendu: (u) => (u.badges.length
      ? <span className="flex flex-wrap gap-1">{u.badges.map((b: string) => <StatusPill key={b} ton="info">{badges.find((x) => x.cle === b)?.libelle || b.replace(/_/g, ' ')}</StatusPill>)}</span> : '—') },
    { cle: 'inscrit', titre: 'Inscrit le', cachee: true, tri: (u) => u.inscritLe || '', rendu: (u) => (u.inscritLe ? new Date(u.inscritLe).toLocaleDateString('fr-FR') : '—') },
    { cle: 'statut', titre: 'Statut', tri: (u) => u.statut, rendu: (u) => <StatusPill ton={tonStatut(u.statut)}>{libelleStatut(u.statut)}</StatusPill> },
  ];
  const colonnesClients: Colonne<any>[] = [
    { cle: 'nom', titre: 'Client', fixe: true, tri: (c) => c.nom || '', rendu: (c) => <span className="font-bold text-slate-900">{c.nom}</span> },
    { cle: 'telephone', titre: 'Téléphone', rendu: (c) => <span className="tabular-nums">{c.telephone}</span> },
    { cle: 'referent', titre: 'Via', tri: (c) => c.referent || '', rendu: (c) => c.referent || '—' },
    { cle: 'commandes', titre: 'Livrées / commandes', droite: true, tri: (c) => c.commandes, rendu: (c) => `${c.livrees} / ${c.commandes}` },
    { cle: 'montant', titre: 'Montant', droite: true, tri: (c) => c.montant, rendu: (c) => <span className="font-semibold">{fcfa(c.montant)}</span> },
  ];
  const u = onglet !== 'clients' ? lignes.find((x) => x.id === ouvert) || null : null;

  return (
    <PageReseau titre="Utilisateurs" sousTitre="Clients, revendeurs, fournisseurs et livreurs." large>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ONGLETS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={onglet === v} onClick={() => { setOnglet(v); setOuvert(null); }}
            className={`px-4 h-10 rounded-full text-sm font-semibold whitespace-nowrap ${onglet === v ? 'bg-suguba-profond text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>{l}</button>
        ))}
      </div>
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, e-mail, code" className="pl-10" aria-label="Rechercher" />
      </div>

      {chargement ? (
        <Skeleton className="h-64" />
      ) : lignes.length === 0 ? (
        <EmptyState icone={Users} titre="Personne ici" texte={q ? 'Aucun résultat pour cette recherche.' : 'Aucun compte dans cette catégorie.'} />
      ) : onglet === 'clients' ? (
        <TableauAdmin titre="Clients" memoire="utilisateurs-clients" lignes={lignes} colonnes={colonnesClients} cleLigne={(c) => c.telephone} />
      ) : (
        <TableauAdmin titre={ONGLETS.find(([v]) => v === onglet)?.[1] || 'Utilisateurs'} memoire={`utilisateurs-${onglet}`} lignes={lignes}
          colonnes={colonnesPartenaires} cleLigne={(x) => x.id} onOuvrir={(x) => setOuvert(x.id)}
          carteMobile={(x) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{x.nom || 'Sans nom'}</p>
                <StatusPill ton={tonStatut(x.statut)}>{libelleStatut(x.statut)}</StatusPill>
              </div>
              <p className="text-xs text-slate-500 truncate">{[x.telephone, x.email, x.code, x.ville].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-slate-600">{activite(x)}</p>
            </div>
          )} />
      )}

      <Panneau ouvert={Boolean(u)} onFermer={() => setOuvert(null)} titre={u?.nom || 'Sans nom'}
        sousTitre={u ? [u.telephone, u.email, u.code, u.ville].filter(Boolean).join(' · ') : undefined}>
        {u && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill ton={tonStatut(u.statut)}>{libelleStatut(u.statut)}</StatusPill>
              <span className="text-sm text-slate-600">{activite(u)}</span>
            </div>
            {u.suspension && (
              <div className="rounded-2xl bg-rose-50 text-rose-900 px-3 py-2 text-sm space-y-1">
                <p><strong>Suspendu le {new Date(u.suspension.depuis).toLocaleDateString('fr-FR')}</strong> : {u.suspension.motif}</p>
                {u.suspension.contestation && <p className="text-amber-900"><strong>Contestation</strong> ({new Date(u.suspension.contesteeLe).toLocaleDateString('fr-FR')}) : {u.suspension.contestation}</p>}
              </div>
            )}
            <section className="space-y-2" aria-labelledby="titre-badges">
              <h3 id="titre-badges" className="text-sm font-bold text-slate-900">Badges</h3>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => {
                  const a = u.badges.includes(b.cle);
                  return (
                    <button key={b.cle} type="button" aria-pressed={a} onClick={() => action({ action: 'badge', profileId: u.id, badge: b.cle, retirer: a }, a ? 'Badge retiré.' : 'Badge attribué.')}
                      className={`px-3 min-h-[40px] rounded-full text-sm font-semibold border inline-flex items-center gap-1 ${a ? 'bg-suguba-profond text-white border-suguba-profond' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                      {a ? <ShieldCheck className="w-4 h-4" /> : '+'} {b.libelle}
                    </button>
                  );
                })}
              </div>
            </section>
            {u.statut === 'suspended' ? (
              <Button variant="ghost" onClick={() => reactiverRole(u.id)}><RotateCcw className="w-4 h-4" />Réactiver ce rôle</Button>
            ) : (
              <Button variant="danger" onClick={() => suspendreRole(u.id)}><Ban className="w-4 h-4" />Suspendre ce rôle</Button>
            )}
          </>
        )}
      </Panneau>
    </PageReseau>
  );
}
