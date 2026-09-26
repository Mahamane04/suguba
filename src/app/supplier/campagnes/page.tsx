'use client';

import React, { useEffect, useState } from 'react';
import { Rocket, Loader2, Plus, Users, Target, Flag } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { progression } from '@/lib/reseau/missions';
import { contestable, estTypeResultat, DELAI_CONTESTATION_H, PRIX_MIN, type TypeResultat } from '@/lib/reseau/resultats-constantes';

/**
 * Campagnes (§ page 24) : le fournisseur mobilise des revendeurs autour d'un
 * produit — partages, visites ou ventes — contre une récompense qu'il finance.
 * Le budget affiché = récompense × nombre de revendeurs : c'est ce qu'il règle
 * à Suguba avant l'ouverture.
 */

interface Campagne {
  id: string; titre: string; type: string; objectif: number; recompense: number;
  maxParticipants: number | null; participants: number; statut: string;
  finitLe: string | null; budgetMax: number; avancementTotal: number; canal?: string;
  budget?: { recu: number; verse: number; restant: number; aValider: number; recuLe: string | null };
}

const OBJECTIFS = [
  { valeur: 'share', libelle: 'Partages', detail: 'Faire connaître le produit' },
  { valeur: 'sale', libelle: 'Ventes', detail: 'Vendre le produit' },
];
// Campagnes payées au résultat (lot 3) : ouvertes quand Suguba les active.
const OBJECTIFS_RESULTAT = [
  { valeur: 'visite_qualifiee', libelle: 'Visites qualifiées', detail: 'Payer chaque visiteur resté sur le produit' },
  { valeur: 'demande_qualifiee', libelle: 'Demandes qualifiées', detail: 'Payer chaque demande de devis ou commande confirmée' },
];
const UNITE: Record<TypeResultat, string> = { visite_qualifiee: 'visite', demande_qualifiee: 'demande' };
// Canal choisi avant de payer (lot 2b) : les preuves de publication devront en venir.
const CANAUX = [
  { valeur: 'tous', libelle: 'Tous les canaux', detail: 'Le revendeur publie où il veut' },
  { valeur: 'whatsapp_statut', libelle: 'Statut WhatsApp' },
  { valeur: 'whatsapp_groupe', libelle: 'Groupes WhatsApp' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
];
const STATUT: Record<string, [string, 'succes' | 'attente' | 'neutre']> = {
  draft: ['En attente de validation', 'attente'], active: ['En cours', 'succes'],
  paused: ['En pause', 'neutre'], ended: ['Terminée', 'neutre'],
};
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;

export default function CampagnesPage() {
  const { toast } = useToast();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [produitId, setProduitId] = useState('');
  const [type, setType] = useState('share');
  const [objectif, setObjectif] = useState('10');
  const [recompense, setRecompense] = useState('2000');
  const [maxRevendeurs, setMaxRevendeurs] = useState('10');
  const [finitLe, setFinitLe] = useState('');
  const [canal, setCanal] = useState('tous');
  const [resultatActif, setResultatActif] = useState(false);
  const auResultat = estTypeResultat(type);

  const charger = React.useCallback(() => fetch('/api/supplier/campagnes')
    .then((r) => r.json())
    .then((d) => { setCampagnes(d.campagnes || []); setProduits(d.produits || []); setResultatActif(Boolean(d.resultatActif)); })
    .catch(() => undefined)
    .finally(() => setChargement(false)), []);
  useEffect(() => { charger(); }, [charger]);

  const budget = (Number(recompense) || 0) * (auResultat ? Number(objectif) || 0 : Number(maxRevendeurs) || 0);
  const choisirType = (v: string) => {
    setType(v);
    // Prix de départ adapté : une visite ne se paie pas comme une vente.
    if (estTypeResultat(v)) { setRecompense(String(v === 'visite_qualifiee' ? 50 : 1000)); setObjectif(v === 'visite_qualifiee' ? '200' : '20'); }
    else { setRecompense('2000'); setObjectif('10'); }
  };

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/campagnes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, description, produitId, type, objectif: Number(objectif), recompense: Number(recompense), maxRevendeurs: Number(maxRevendeurs), finitLe: finitLe || null, canal: type === 'share' ? canal : 'tous' }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Création impossible.', { ton: 'erreur' }); return; }
      toast(`Campagne envoyée. Budget à régler : ${fcfa(d.budget)}. Suguba vous contacte.`, { ton: 'succes' });
      setFormulaire(false); setTitre(''); setDescription('');
      await charger();
    } catch {
      toast('Création impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <PageReseau titre="Campagnes" sousTitre="Mobilisez les revendeurs autour d’un produit."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
      action={<Button size="sm" onClick={() => setFormulaire((v) => !v)} disabled={produits.length === 0}><Plus className="w-4 h-4" />Nouvelle</Button>}>

      {formulaire && (
        <Card>
          <form onSubmit={creer} className="space-y-3">
            <Field label="Titre" htmlFor="titre" requis>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required placeholder="Lancement de la TV 55 pouces" />
            </Field>
            <Field label="Produit" htmlFor="produit" requis>
              <ChoicePicker id="produit" valeur={produitId} onChange={setProduitId} placeholder="Choisir un produit"
                choix={produits.map((p) => ({ valeur: p.id, libelle: p.nom }))} />
            </Field>
            <Field label="Ce que vous payez" htmlFor="type">
              <ChoicePicker id="type" valeur={type} onChange={choisirType} choix={resultatActif ? [...OBJECTIFS, ...OBJECTIFS_RESULTAT] : OBJECTIFS} />
            </Field>
            {auResultat && (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-2xl px-3 py-2">
                {type === 'visite_qualifiee'
                  ? 'Une visite compte quand un visiteur venu par le lien d’un revendeur reste au moins 20 secondes sur votre produit et touche l’écran. Chaque visiteur n’est payé qu’une fois.'
                  : 'Une demande compte quand vous répondez à une demande de devis, ou quand Suguba confirme la commande par téléphone. Chaque client n’est payé qu’une fois.'}
                {` Vous pouvez contester un résultat pendant ${DELAI_CONTESTATION_H} h.`}
              </p>
            )}
            {type === 'share' && (
              <Field label="Où les revendeurs doivent publier" htmlFor="canal" aide="Chaque publication est vérifiée par Suguba sur capture avant d’être comptée.">
                <ChoicePicker id="canal" valeur={canal} onChange={setCanal} choix={CANAUX} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={auResultat ? `Nombre de ${UNITE[type as TypeResultat]}s` : 'Quantité à atteindre'} htmlFor="objectif">
                <Input id="objectif" type="number" inputMode="numeric" min={1} value={objectif} onChange={(e) => setObjectif(e.target.value)} />
              </Field>
              {auResultat ? (
                <Field label={`Prix par ${UNITE[type as TypeResultat]} (F)`} htmlFor="recompense" aide={`${PRIX_MIN[type as TypeResultat]} F minimum.`}>
                  <Input id="recompense" type="number" inputMode="numeric" min={PRIX_MIN[type as TypeResultat]} step={5} value={recompense} onChange={(e) => setRecompense(e.target.value)} />
                </Field>
              ) : (
                <Field label="Récompense (F)" htmlFor="recompense" aide="Par revendeur qui atteint l’objectif.">
                  <Input id="recompense" type="number" inputMode="numeric" min={0} step={500} value={recompense} onChange={(e) => setRecompense(e.target.value)} />
                </Field>
              )}
              <Field label="Revendeurs max" htmlFor="max">
                <Input id="max" type="number" inputMode="numeric" min={1} value={maxRevendeurs} onChange={(e) => setMaxRevendeurs(e.target.value)} />
              </Field>
              <Field label="Fin (facultatif)" htmlFor="fin">
                <Input id="fin" type="date" value={finitLe} onChange={(e) => setFinitLe(e.target.value)} />
              </Field>
            </div>
            <Field label="Consignes (facultatif)" htmlFor="description">
              <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
            </Field>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
              <span className="text-xs text-slate-600">Budget maximum</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{fcfa(budget)}</span>
            </div>
            <Button type="submit" fullWidth disabled={envoi || !produitId}>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}Envoyer la campagne
            </Button>
            <p className="text-xs text-slate-500">
              Suguba vous contacte pour le règlement du budget ; la campagne n’ouvre qu’une fois le budget reçu en entier.
              {auResultat
                ? ' Chaque résultat est déduit du budget ; la campagne se met en pause quand il est épuisé. Le solde non utilisé vous est rendu ou reporté.'
                : ' Vous ne payez que les objectifs atteints et validés : le solde non utilisé vous est rendu ou reporté.'}
            </p>
          </form>
        </Card>
      )}

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : campagnes.length === 0 ? (
        <EmptyState icone={Rocket} titre="Aucune campagne"
          texte={produits.length === 0 ? 'Il faut au moins un produit en vente pour lancer une campagne.' : 'Lancez une campagne : les revendeurs partagent et vendent votre produit, vous ne payez que les objectifs atteints.'}
          action={produits.length > 0 ? <Button onClick={() => setFormulaire(true)}>Créer une campagne</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {campagnes.map((c) => {
            const [libelle, ton] = STATUT[c.statut] || [c.statut, 'neutre'];
            const resultat = estTypeResultat(c.type);
            const vise = resultat ? c.objectif : c.objectif * (c.maxParticipants || 1);
            const pct = progression(c.avancementTotal, vise);
            return (
              <Card key={c.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900 min-w-0 truncate">{c.titre}</p>
                  <StatusPill ton={ton}>{libelle}</StatusPill>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill ton="neutre"><Target className="w-3 h-3" />{c.objectif} {[...OBJECTIFS, ...OBJECTIFS_RESULTAT].find((o) => o.valeur === c.type)?.libelle.toLowerCase()}</StatusPill>
                  <StatusPill ton="neutre"><Users className="w-3 h-3" />{c.participants}/{c.maxParticipants || '∞'} revendeurs</StatusPill>
                  <StatusPill ton="neutre">{fcfa(c.recompense)} / {resultat ? UNITE[c.type as TypeResultat] : 'revendeur'}</StatusPill>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-suguba-brand" style={{ width: `${pct}%` }} /></div>
                <p className="text-xs text-slate-500">{c.avancementTotal} / {vise} au total{c.canal && c.canal !== 'tous' ? ` · publié sur ${CANAUX.find((x) => x.valeur === c.canal)?.libelle}` : ''}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">Réglé<br /><strong className="text-slate-900">{fcfa(c.budget?.recu || 0)}</strong><span className="text-slate-500"> / {fcfa(c.budgetMax)}</span></p>
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">Dépensé<br /><strong className="text-slate-900">{fcfa(c.budget?.verse || 0)}</strong></p>
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">{c.statut === 'ended' ? 'Solde non utilisé' : 'Restant'}<br /><strong className="text-slate-900">{fcfa(c.budget?.restant || 0)}</strong></p>
                </div>
                {c.statut === 'draft' && (c.budget?.recu || 0) < c.budgetMax && (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-2xl px-3 py-2">À régler avant l’ouverture : {fcfa(c.budgetMax - (c.budget?.recu || 0))}</p>
                )}
                {c.statut !== 'draft' && <LienPageCampagne id={c.id} />}
                {resultat && c.statut !== 'draft' && <ResultatsCampagne campagneId={c.id} onMaj={charger} />}
              </Card>
            );
          })}
        </div>
      )}
    </PageReseau>
  );
}

/** Page de marque de la campagne (lot 2b) : celle que les revendeurs partagent. */
function LienPageCampagne({ id }: { id: string }) {
  return (
    <a href={`/campagne/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center min-h-11 text-xs font-bold text-suguba-profond underline">
      Voir la page de la campagne
    </a>
  );
}

interface ResultatVue {
  id: string; missionId: string; genre: 'visite' | 'demande'; revendeur: { nom: string };
  prix: number; statut: 'retenu' | 'a_verifier' | 'conteste' | 'annule'; motif: string | null; creeLe: string;
}
const STATUT_RESULTAT: Record<ResultatVue['statut'], [string, 'succes' | 'attente' | 'neutre']> = {
  retenu: ['Compté', 'succes'], a_verifier: ['Vérification Suguba', 'attente'], conteste: ['Contesté', 'attente'], annule: ['Annulé, remboursé', 'neutre'],
};

/** Résultats d'une campagne au résultat (lot 3), avec contestation sous 48 h. */
function ResultatsCampagne({ campagneId, onMaj }: { campagneId: string; onMaj: () => void }) {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState<ResultatVue[] | null>(null);
  const [contestation, setContestation] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = React.useCallback(() => fetch('/api/supplier/campagnes/resultats', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => setListe((d.resultats || []).filter((r: ResultatVue) => r.missionId === campagneId)))
    .catch(() => setListe([])), [campagneId]);

  const contester = async (id: string) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/campagnes/resultats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, motif }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast(d?.error || 'Contestation impossible.', { ton: 'erreur' }); return; }
      toast('Résultat contesté : Suguba vérifie avant tout paiement.', { ton: 'succes' });
      setContestation(null); setMotif('');
      await charger(); onMaj();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  if (!ouvert) {
    return (
      <button type="button" onClick={() => { setOuvert(true); charger(); }}
        className="inline-flex items-center min-h-11 text-xs font-bold text-suguba-profond underline ml-4">
        Voir les résultats
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-900">Résultats</p>
      {!liste ? <Skeleton className="h-16" /> : liste.length === 0 ? (
        <p className="text-xs text-slate-500">Aucun résultat pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {liste.map((r) => {
            const [libelle, ton] = STATUT_RESULTAT[r.statut];
            return (
              <li key={r.id} className="py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-700 min-w-0 truncate">
                    {r.genre === 'visite' ? 'Visite' : 'Demande'} via {r.revendeur.nom} · {fcfa(r.prix)} ·{' '}
                    {new Date(r.creeLe).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <StatusPill ton={ton}>{libelle}</StatusPill>
                </div>
                {r.motif && <p className="text-xs text-slate-500">Motif : {r.motif}</p>}
                {contestable(r.statut, r.creeLe) && (contestation === r.id ? (
                  <div className="space-y-2">
                    <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Pourquoi ce résultat n’est pas sérieux ?" aria-label="Motif de la contestation" />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setContestation(null)}>Retour</Button>
                      <Button size="sm" onClick={() => contester(r.id)} disabled={envoi || motif.trim().length < 5}>
                        {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}Contester
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setContestation(r.id); setMotif(''); }}
                    className="inline-flex items-center gap-1 min-h-11 text-xs font-semibold text-amber-800">
                    <Flag className="w-3.5 h-3.5" />Pas sérieux ? Contester
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
