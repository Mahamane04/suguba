'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Search, Truck, Loader2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import TableauAdmin, { type Colonne } from '@/components/admin/TableauAdmin';
import Panneau from '@/components/admin/Panneau';
import DossierCommande, {
  STATUTS_COMMANDE, ChoixLivreur, actionCommande, attribuable, fcfa, libellePaiement, quand, statutCommande,
  useLivreursActifs, type Commande,
} from '@/components/admin/DossierCommande';
import { usePermission, usePosteAdmin } from '@/components/admin/contexte';

/**
 * Commandes (§ page 45 ; refaite en U2 et U4, 2026-09-27).
 *
 * On AGIT ici : « Confirmer » après l'appel au client, « Attribuer un
 * livreur » (une commande, ou plusieurs d'un coup pour une tournée). Ces
 * actions n'existaient que sur l'ancienne vue d'ensemble. Les règles sont
 * celles du serveur (voir src/lib/commande-admin.ts) : livreur actif,
 * plafond d'espèces, remise par le fournisseur, commande changée entre-temps.
 *
 * Tableau sur ordinateur (colonnes au choix, tri), cartes sur téléphone ; un
 * clic sur une ligne ouvre la commande dans le panneau latéral.
 */

export default function CommandesAdminPage() {
  const { toast } = useToast();
  const { rafraichir } = usePosteAdmin();
  const peutModifier = usePermission('commande.modifier');
  const peutGererLivraisons = usePermission('livraison.gerer');
  const peutAttribuer = Boolean(peutModifier || peutGererLivraisons);
  const peutExporter = usePermission('donnees.exporter');

  const [filtre, setFiltre] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pret, setPret] = useState(false);
  const [retry, setRetry] = useState(0);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aOuvrir, setAOuvrir] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [livreurGroupe, setLivreurGroupe] = useState('');
  const [enCours, setEnCours] = useState(false);
  const { livreurs, erreur: erreurLivreurs } = useLivreursActifs(peutAttribuer && selection.size > 0);

  // Adresse de la page : ?statut=…&q=…&page=… (liens de « À traiter », recherche globale, retour arrière).
  useEffect(() => {
    const restaurer = () => {
      const p = new URLSearchParams(window.location.search);
      setQ(p.get('q') || ''); setFiltre(p.get('statut') || '');
      setPage(Math.max(1, Number(p.get('page')) || 1));
      // Un numéro de commande précis : on l'ouvre directement dans le panneau.
      if (p.get('q')) setAOuvrir(p.get('q'));
      setPret(true);
    };
    restaurer(); window.addEventListener('popstate', restaurer);
    return () => window.removeEventListener('popstate', restaurer);
  }, []);

  useEffect(() => {
    if (!pret) return;
    setChargement(true); setErreur('');
    const controller = new AbortController();
    const params = new URLSearchParams({ statut: filtre, q: q.trim(), page: String(page) });
    window.history.replaceState(window.history.state, '', `?${params}`);
    const t = setTimeout(() => {
      fetch(`/api/admin/commandes?${params}`, { signal: controller.signal, cache: 'no-store' })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw Error(d.error || 'Recherche indisponible.'); return d; })
        .then((d) => { if (!controller.signal.aborted) { setCommandes(d.commandes || []); setCompteurs(d.compteurs || {}); setTotal(d.total || 0); } })
        .catch((e) => { if (!controller.signal.aborted) setErreur(e.message || 'Connexion interrompue. Réessayez.'); })
        .finally(() => { if (!controller.signal.aborted) setChargement(false); });
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [filtre, q, page, pret, retry]);

  useEffect(() => {
    if (!aOuvrir || chargement) return;
    const c = commandes.find((x) => x.numero.toLowerCase() === aOuvrir.trim().toLowerCase());
    if (c) setOuverte(c.id);
    setAOuvrir(null);
  }, [aOuvrir, chargement, commandes]);

  const apresAction = () => { setOuverte(null); setSelection(new Set()); setRetry((v) => v + 1); rafraichir(); };

  const confirmerCommande = async (c: Commande) => {
    setEnCours(true);
    const r = await actionCommande({ action: 'confirmer', orderId: c.id });
    setEnCours(false);
    if (!r) { toast('Action non confirmée. Vérifiez votre connexion.', { ton: 'erreur' }); return; }
    toast(r.message, { ton: r.ok ? 'succes' : 'erreur', duree: 7000 });
    if (r.ok) apresAction();
  };

  // Attribution groupée : une tournée confiée au même livreur.
  const attribuerSelection = async () => {
    const driverId = livreurGroupe || livreurs?.[0]?.id;
    if (!driverId) { toast('Choisissez un livreur.', { ton: 'erreur' }); return; }
    setEnCours(true);
    const r = await actionCommande({ action: 'attribuer', orderIds: [...selection], driverId });
    setEnCours(false);
    if (!r) { toast('Action non confirmée. Vérifiez votre connexion.', { ton: 'erreur' }); return; }
    toast(r.message, { ton: r.ok ? 'succes' : 'erreur', duree: 7000 });
    if (r.echecs.length && r.ok) {
      toast(`Non attribuée${r.echecs.length > 1 ? 's' : ''} : ${r.echecs.slice(0, 3).map((x) => `${x.numero} (${x.error})`).join(' ; ')}`, { ton: 'erreur', duree: 10000 });
    }
    if (r.ok) apresAction();
  };

  // Articles d'un même panier : signalés dans la colonne « Commande ».
  const taillePanier = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of commandes) if (c.panier) m.set(c.panier, (m.get(c.panier) || 0) + 1);
    return m;
  }, [commandes]);

  const pastille = (c: Commande) => <StatusPill ton={statutCommande(c.statut)?.[2] || 'neutre'}>{statutCommande(c.statut)?.[1] || c.statut}</StatusPill>;

  const colonnes: Colonne<Commande>[] = [
    { cle: 'numero', titre: 'Commande', fixe: true, tri: (c) => c.numero, rendu: (c) => {
      const n = c.panier ? taillePanier.get(c.panier) || 1 : 1;
      return (
        <span className="block">
          <span className="font-bold text-slate-900 font-mono text-xs">{c.numero}</span>
          {n > 1 && <span className="block text-xs text-slate-500">Panier de {n} articles</span>}
        </span>
      );
    } },
    { cle: 'date', titre: 'Passée le', tri: (c) => c.creeLe, rendu: (c) => <span className="whitespace-nowrap text-slate-600">{quand(c.creeLe)}</span> },
    { cle: 'client', titre: 'Client', tri: (c) => c.client, rendu: (c) => (
      <span className="block min-w-[140px]"><span className="block font-semibold text-slate-900">{c.client}</span><span className="block text-xs text-slate-500 tabular-nums">{c.telephone}</span></span>
    ) },
    { cle: 'produit', titre: 'Produit', tri: (c) => c.produit, rendu: (c) => <span className="block min-w-[160px]">{c.quantite} × {c.produit}</span> },
    { cle: 'lieu', titre: 'Quartier', tri: (c) => c.quartier || '', rendu: (c) => [c.quartier, c.ville].filter(Boolean).join(', ') || '—' },
    { cle: 'total', titre: 'Total', droite: true, tri: (c) => c.total, rendu: (c) => <span className="font-semibold">{fcfa(c.total)}</span> },
    { cle: 'statut', titre: 'Statut', tri: (c) => c.statut, rendu: pastille },
    { cle: 'livreur', titre: 'Livreur', tri: (c) => c.livreur || '', rendu: (c) => c.livreur || '—' },
    { cle: 'revendeur', titre: 'Revendeur', cachee: true, tri: (c) => c.revendeur || '', rendu: (c) => c.revendeur || '—' },
    { cle: 'paiement', titre: 'Paiement', cachee: true, rendu: (c) => libellePaiement(c.paiement) },
    { cle: 'action', titre: 'Action', fixe: true, droite: true, rendu: (c) => (
      c.statut === 'pending_call' && peutModifier ? <Button size="sm" disabled={enCours} onClick={() => confirmerCommande(c)}>Confirmer</Button>
        : attribuable(c) && peutAttribuer ? <Button size="sm" variant="ghost" onClick={() => setOuverte(c.id)}>{c.statut === 'confirmed' ? 'Attribuer' : 'Changer de livreur'}</Button>
        : null
    ) },
  ];

  const commande = commandes.find((c) => c.id === ouverte) || null;
  const puce = (actif: boolean) => `px-3.5 h-10 rounded-full text-sm font-semibold whitespace-nowrap ${actif ? 'bg-suguba-profond text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`;
  const choisirFiltre = (v: string) => { setFiltre(v); setPage(1); setSelection(new Set()); };

  return (
    <PageReseau titre="Commandes" large sousTitre="Confirmer après l’appel, attribuer un livreur, suivre chaque commande."
      action={peutExporter ? <a href={`/api/admin/export?type=commandes${filtre ? `&statut=${encodeURIComponent(filtre)}` : ''}`} className="text-sm font-semibold text-slate-700 underline min-h-[40px] inline-flex items-center">Exporter (CSV)</a> : undefined}>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Statut">
        {STATUTS_COMMANDE.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={filtre === v} onClick={() => choisirFiltre(v)} className={puce(filtre === v)}>
            {l}{compteurs[v] ? ` · ${compteurs[v]}` : ''}
          </button>
        ))}
        <button type="button" aria-pressed={!filtre} onClick={() => choisirFiltre('')} className={puce(!filtre)}>Toutes</button>
      </div>
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Numéro, client, téléphone, produit, code revendeur" className="pl-10" aria-label="Rechercher une commande" />
      </div>

      {erreur ? (
        <div role="alert" className="rounded-3xl bg-rose-50 text-rose-800 p-4 space-y-2"><p>{erreur}</p><Button variant="ghost" onClick={() => setRetry((v) => v + 1)}>Réessayer</Button></div>
      ) : chargement ? <Skeleton className="h-64" />
        : commandes.length === 0 ? <EmptyState icone={ShoppingBag} titre="Aucune commande" texte={filtre ? 'Rien dans ce statut pour cette recherche.' : undefined} />
        : (
          <TableauAdmin<Commande> titre="Commandes" memoire="commandes" lignes={commandes} colonnes={colonnes} cleLigne={(c) => c.id}
            onOuvrir={(c) => setOuverte(c.id)}
            selection={peutAttribuer ? { choisies: selection, onChange: setSelection, possible: attribuable } : undefined}
            barre={selection.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-slate-800">{selection.size} commande{selection.size > 1 ? 's' : ''} sélectionnée{selection.size > 1 ? 's' : ''}</span>
                <span className="w-56"><ChoixLivreur id="livreur-groupe" livreurs={livreurs} erreur={erreurLivreurs} valeur={livreurGroupe} onChange={setLivreurGroupe} /></span>
                <Button size="sm" disabled={enCours || !livreurs?.length} onClick={attribuerSelection}>
                  {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}Attribuer à ce livreur
                </Button>
                <button type="button" onClick={() => setSelection(new Set())} className="text-sm font-semibold text-slate-600 hover:underline min-h-[40px]">Annuler</button>
              </>
            ) : peutAttribuer && commandes.some(attribuable) ? <span className="text-xs text-slate-500">Cochez plusieurs commandes à attribuer pour les confier au même livreur.</span> : null}
            carteMobile={(c) => (
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 break-words">{c.client}</p>
                  <span className="text-sm font-bold tabular-nums shrink-0">{fcfa(c.total)}</span>
                </div>
                <p className="text-xs text-slate-500">{c.numero} · {quand(c.creeLe)} · {[c.quartier, c.ville].filter(Boolean).join(', ')}</p>
                <p className="text-sm text-slate-700">{c.quantite} × {c.produit}</p>
                {pastille(c)}
              </div>
            )} />
        )}

      {!erreur && !chargement && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-slate-600">{total} panier(s) ou commande(s) · Page {page} sur {Math.max(1, Math.ceil(total / 50))}</p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Précédente</Button>
            <Button variant="ghost" disabled={page * 50 >= total} onClick={() => setPage((v) => v + 1)}>Suivante</Button>
          </div>
        </div>
      )}

      <Panneau ouvert={Boolean(commande)} onFermer={() => setOuverte(null)}
        titre={commande ? `Commande ${commande.numero}` : ''}
        sousTitre={commande ? `${statutCommande(commande.statut)?.[1] || commande.statut} · passée le ${quand(commande.creeLe)}` : undefined}>
        {commande && <DossierCommande key={commande.id} commande={commande} onFait={apresAction} />}
      </Panneau>
    </PageReseau>
  );
}
