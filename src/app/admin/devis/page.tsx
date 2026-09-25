'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileText, Phone, RefreshCw, Search, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';

interface DevisAdmin {
  id: string;
  numero: string;
  statut: 'demande' | 'proposee' | 'acceptee' | 'refusee_client' | 'refusee_fournisseur' | 'expiree';
  creeLe: string;
  proposeLe: string | null;
  decideLe: string | null;
  enRetard: boolean;
  attenteHeures: number | null;
  produit: string;
  quantite: number;
  besoin: string;
  lieu: string;
  client: { nom: string; telephone: string };
  fournisseur: { nom: string; telephone: string | null } | null;
  revendeur: { nom: string | null; code: string | null } | null;
  prix: { fournisseur: number; partRevendeur: number; client: number; gainRevendeur: number; margeSuguba: number; livraison: number } | null;
  conditions: string | null;
  valableJusqu: string | null;
  motifRefus: string | null;
  commande: string | null;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const attente = (h: number) => (h < 1 ? 'moins d’une heure' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} jours`);

type Filtre = 'a_repondre' | 'proposes' | 'acceptes' | 'clos';
const filtreDe = (d: DevisAdmin): Filtre =>
  d.statut === 'demande' ? 'a_repondre' : d.statut === 'proposee' ? 'proposes' : d.statut === 'acceptee' ? 'acceptes' : 'clos';
const PASTILLE: Record<DevisAdmin['statut'], { libelle: string; ton: 'succes' | 'attente' | 'info' | 'danger' | 'neutre' }> = {
  demande: { libelle: 'Attend le fournisseur', ton: 'attente' },
  proposee: { libelle: 'Attend le client', ton: 'info' },
  acceptee: { libelle: 'Accepté', ton: 'succes' },
  refusee_client: { libelle: 'Refusé par le client', ton: 'neutre' },
  refusee_fournisseur: { libelle: 'Refusé par le fournisseur', ton: 'neutre' },
  expiree: { libelle: 'Expiré', ton: 'neutre' },
};

/**
 * Devis — suivi admin (2026-09-26). Toutes les demandes de devis, pour
 * relancer un fournisseur qui tarde à répondre et contrôler les prix
 * proposés. Lecture seule : seul le fournisseur propose son prix.
 */
export default function DevisAdminPage() {
  const [devis, setDevis] = useState<DevisAdmin[]>([]);
  const [relanceHeures, setRelanceHeures] = useState(24);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>('a_repondre');
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await fetch('/api/admin/devis', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lecture impossible.');
      setDevis(j.devis || []);
      setRelanceHeures(j.relanceHeures || 24);
      setMigration(Boolean(j.migrationRequise));
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const groupes = useMemo(() => {
    const g: Record<Filtre, DevisAdmin[]> = { a_repondre: [], proposes: [], acceptes: [], clos: [] };
    for (const d of devis) g[filtreDe(d)].push(d);
    // Les plus en retard d'abord : c'est là qu'il faut appeler.
    g.a_repondre.sort((a, b) => (b.attenteHeures || 0) - (a.attenteHeures || 0));
    return g;
  }, [devis]);

  const terme = recherche.trim().toLowerCase().replace(/\s+/g, '');
  const liste = terme
    ? devis.filter((d) => [d.numero, d.commande, d.client.telephone, d.client.nom, d.produit, d.fournisseur?.nom]
      .some((x) => String(x || '').toLowerCase().replace(/\s+/g, '').includes(terme)))
    : groupes[filtre];

  const enRetard = groupes.a_repondre.filter((d) => d.enRetard).length;
  const acceptesMontant = groupes.acceptes.reduce((t, d) => t + (d.prix?.client || 0), 0);
  const FILTRES: [Filtre, string][] = [
    ['a_repondre', `À répondre (${groupes.a_repondre.length})`],
    ['proposes', `Proposés (${groupes.proposes.length})`],
    ['acceptes', `Acceptés (${groupes.acceptes.length})`],
    ['clos', `Refusés / expirés (${groupes.clos.length})`],
  ];

  return (
    <PageReseau
      titre="Devis"
      sousTitre="Les demandes de devis des clients, et où elles en sont."
      retour={{ href: '/admin', libelle: 'Console' }}
      action={
        <Button variant="ghost" size="sm" onClick={() => charger()} disabled={chargement}>
          <RefreshCw className={`w-4 h-4 ${chargement ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      }
    >
      {migration && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          La table des devis n’existe pas encore : exécutez le SQL des devis dans Supabase.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="À répondre" valeur={groupes.a_repondre.length} icone={FileText} accent={groupes.a_repondre.length > 0} />
        <StatCard label={`Sans réponse depuis ${relanceHeures} h`} valeur={enRetard} icone={AlertTriangle} />
        <StatCard label="Acceptés (montant client)" valeur={fcfa(acceptesMontant)} icone={FileText} />
      </div>

      <label className="relative block">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="N° de devis, de commande, téléphone, client…"
          aria-label="Rechercher un devis"
          className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
        />
      </label>

      {!terme && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTRES.map(([f, libelle]) => (
            <button key={f} type="button" onClick={() => setFiltre(f)} aria-pressed={filtre === f}
              className={`shrink-0 min-h-[40px] px-4 rounded-full text-xs font-semibold ${filtre === f ? 'bg-suguba-profond text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
              {libelle}
            </button>
          ))}
        </div>
      )}

      {chargement && devis.length === 0 ? <Skeleton className="h-40" /> : erreur ? (
        <EmptyState icone={FileText} titre="Devis indisponibles" texte={erreur} />
      ) : liste.length === 0 ? (
        <EmptyState icone={FileText} titre={terme ? 'Aucun devis trouvé' : 'Rien ici'}
          texte={terme ? 'Vérifiez le numéro ou le téléphone.' : filtre === 'a_repondre' ? 'Aucune demande n’attend de réponse.' : undefined} />
      ) : (
        <div className="space-y-3">
          {liste.map((d) => (
            <Card key={d.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{d.produit || 'Offre supprimée'}</p>
                  <p className="text-xs text-slate-500 font-mono">{d.numero} · {jour(d.creeLe)} · quantité {d.quantite}</p>
                </div>
                <StatusPill ton={d.enRetard ? 'danger' : PASTILLE[d.statut].ton}>
                  {d.enRetard ? 'En retard' : PASTILLE[d.statut].libelle}
                </StatusPill>
              </div>

              {d.statut === 'demande' && d.attenteHeures !== null && (
                <p className={`text-xs font-semibold ${d.enRetard ? 'text-red-700' : 'text-slate-600'}`}>
                  Sans réponse depuis {attente(d.attenteHeures)}{d.enRetard ? ' : appelez le fournisseur.' : '.'}
                </p>
              )}

              <p className="text-sm text-slate-800 whitespace-pre-line bg-slate-50 rounded-2xl p-3">{d.besoin}</p>

              <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-2xl border border-slate-200 p-3 space-y-0.5">
                  <p className="font-bold text-slate-900">Client</p>
                  <p>{d.client.nom} · {d.lieu}</p>
                  <a href={`tel:${d.client.telephone}`} className="inline-flex items-center gap-1 min-h-11 font-bold text-suguba-profond underline">
                    <Phone className="w-3.5 h-3.5" /> {d.client.telephone}
                  </a>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3 space-y-0.5">
                  <p className="font-bold text-slate-900">Fournisseur</p>
                  <p>{d.fournisseur?.nom || '—'}</p>
                  {d.fournisseur?.telephone && (
                    <a href={`tel:${d.fournisseur.telephone}`} className="inline-flex items-center gap-1 min-h-11 font-bold text-suguba-profond underline">
                      <Phone className="w-3.5 h-3.5" /> {d.fournisseur.telephone}
                    </a>
                  )}
                </div>
              </div>

              {d.revendeur && (
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Via le revendeur {d.revendeur.nom || ''}{d.revendeur.code ? ` (${d.revendeur.code})` : ''}
                </p>
              )}

              {d.prix && (
                <div className="text-xs text-slate-700 rounded-2xl border border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <p>Prix fournisseur<br /><strong className="text-slate-900">{fcfa(d.prix.fournisseur)}</strong></p>
                  <p>Gain revendeur<br /><strong className="text-slate-900">{fcfa(d.prix.gainRevendeur)}</strong></p>
                  <p>Marge Suguba<br /><strong className="text-slate-900">{fcfa(d.prix.margeSuguba)}</strong></p>
                  <p>Le client paie<br /><strong className="text-slate-900">{fcfa(d.prix.client)}</strong>{d.prix.livraison ? <span className="text-slate-500"> (dont remise {fcfa(d.prix.livraison)})</span> : null}</p>
                </div>
              )}
              {d.conditions && <p className="text-xs text-slate-600">Conditions : {d.conditions}</p>}
              {d.statut === 'proposee' && d.valableJusqu && <p className="text-xs text-slate-600">Valable jusqu’au {jour(d.valableJusqu)}</p>}
              {d.motifRefus && <p className="text-xs text-slate-600">Motif du refus : {d.motifRefus}</p>}
              {d.commande && (
                <p className="text-xs font-bold text-emerald-800">
                  Commande <Link href={`/admin/commandes?q=${encodeURIComponent(d.commande)}`} className="underline">{d.commande}</Link> créée.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
