'use client';

import React, { useState } from 'react';
import { ArrowLeft, Bike, Check, Clock, Info, Lock, Plus, ShieldCheck, Store, Tag } from 'lucide-react';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import PartenaireVisite from '@/components/common/PartenaireVisite';
import ChoixDestinataire from '@/components/compte/ChoixDestinataire';
import Button from '@/components/ui/Button';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Card, Skeleton } from '@/components/ui/Surface';
import SugubaLoader from '@/components/ui/SugubaLoader';
import { MARGE_BAS_FLOTTANT } from '@/lib/mise-en-page';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import { formatF } from '@/lib/montant';
import type { AvisPromo, ErreursCommande, ModeReception } from '@/lib/formulaire-commande';

/**
 * Formulaire de commande commun à l'achat direct (/p/<produit>/commander) et au
 * panier (/panier) — PUB-10, audit UI/UX du 2026-10-02.
 *
 * Les deux tunnels recopiaient chacun leur formulaire et en avaient divergé :
 * libellés, aides, cartes de livraison sans détail, code promo toujours ouvert,
 * barre du bas qui recouvrait le champ pendant la saisie, aucun numéro d'étape
 * dans le panier. Chaque bloc vient ici du tunnel direct, le plus abouti ; les
 * deux pages ne gardent que ce qui leur est propre (article unique ou liste,
 * appel au serveur, écran suivant).
 */

export interface ReglagesLivraison {
  livraisonParVille: Record<string, number>;
  pointsRelais: { id: string; nom: string; frais: number; horaires?: string }[];
}

const PRECISION_VILLE: Record<string, string> = {
  Sikasso: 'Gare SONEF',
  'Ségou': 'Gare BTM',
  Kayes: 'Gare SONEF',
  Mopti: 'Sévaré - Gare',
};

const CARTE_CHOIX_ACTIVE = 'border-suguba-brand bg-suguba-brand/5 ring-1 ring-suguba-brand';
const CARTE_CHOIX_INACTIVE = 'border-slate-200 bg-white hover:border-slate-300';

/** En-tête collant : retour, titre, « Rien à payer maintenant », revendeur d'origine. */
export function EnteteCommande({ titre, onRetour, libelleRetour, refUrl }: {
  titre: string; onRetour: () => void; libelleRetour: string; refUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 h-14 flex items-center gap-1">
        <button type="button" onClick={onRetour} aria-label={libelleRetour}
          className="w-11 h-11 rounded-full hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight">{titre}</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Rien à payer maintenant
          </p>
          <PartenaireVisite refUrl={refUrl ?? undefined} />
        </div>
      </div>
    </header>
  );
}

/** Étape numérotée, cochée quand elle est complète. */
export function SectionCommande({ numero, titre, complete, children }: {
  numero: number; titre: string; complete: boolean; children: React.ReactNode;
}) {
  return (
    <Card padding="p-4 sm:p-5" className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-colors ${complete ? 'bg-suguba-brand' : 'bg-suguba-profond'}`}>
          {complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : numero}
        </span>
        <h2 className="text-sm font-bold text-slate-900">{titre}</h2>
      </div>
      {children}
    </Card>
  );
}

/** Pour qui, nom et téléphone. */
export function CoordonneesCommande({ nom, onNom, telephone, onTelephone, erreurs, onDestinataire }: {
  nom: string; onNom: (v: string) => void; telephone: string; onTelephone: (v: string) => void;
  /** Erreurs déjà filtrées (affichées seulement après une première tentative). */
  erreurs: ErreursCommande;
  onDestinataire: (c: { nom: string; telephone: string; quartier?: string | null; repere?: string | null }) => void;
}) {
  return (
    <>
      {/* Compte client (C2) : « Pour moi » ou un proche enregistré. */}
      <ChoixDestinataire onChoisir={onDestinataire} />
      <Field label="Nom et prénom" htmlFor="champ-nom" requis erreur={erreurs.nom}>
        <Input id="champ-nom" autoComplete="name" autoCapitalize="words" placeholder="Ex : Moussa Traoré"
          value={nom} onChange={(e) => onNom(e.target.value)} aria-invalid={Boolean(erreurs.nom)} />
      </Field>
      <Field label="Téléphone" htmlFor="champ-tel" requis erreur={erreurs.tel}
        aide="Suguba vous appelle pour confirmer, puis le livreur avant de passer.">
        <Input id="champ-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="Ex : 70 12 34 56"
          value={telephone} onChange={(e) => onTelephone(e.target.value)} aria-invalid={Boolean(erreurs.tel)} />
      </Field>
    </>
  );
}

/** Mode de réception, adresse ou point relais. */
export function LivraisonCommande(p: {
  reglages: ReglagesLivraison | null;
  mode: ModeReception; onMode: (m: ModeReception) => void;
  /** Article remis par son vendeur : ni livreur Suguba ni point relais. */
  remiseVendeur?: { type: 'fournisseur' | 'retrait'; avecService?: boolean } | null;
  /** Panier où un article est remis par son vendeur : le point relais n'est pas proposé. */
  relaisImpossible?: string | null;
  ville: string; onVille: (v: string) => void;
  quartier: string; onQuartier: (v: string) => void; onPosition: (pos: { lat: number; lng: number } | null) => void;
  repere: string; onRepere: (v: string) => void;
  instructions: string; onInstructions: (v: string) => void;
  relaisChoisiId: string | undefined; onRelais: (id: string) => void;
  erreurs: ErreursCommande;
}) {
  const points = p.reglages?.pointsRelais || [];
  const villes = p.reglages?.livraisonParVille || { Bamako: 1500 };
  const estBamako = p.ville.trim().toLowerCase() === 'bamako';
  const fraisRelaisMin = points.length ? Math.min(...points.map((x) => x.frais)) : null;
  const libelleRelais = fraisRelaisMin === null ? 'Retrait au comptoir' : fraisRelaisMin === 0 ? 'Gratuit à Bamako' : `Dès ${formatF(fraisRelaisMin)}`;
  const relaisPossible = !p.remiseVendeur && !p.relaisImpossible;

  return (
    <>
      {p.remiseVendeur ? (
        <div className="rounded-2xl bg-suguba-sauge p-3 text-sm text-slate-800 flex items-start gap-2.5">
          <Store className="w-5 h-5 text-suguba-profond shrink-0 mt-0.5" />
          <p>
            {p.remiseVendeur.type === 'retrait'
              ? <><strong>À retirer chez le vendeur.</strong> Après la confirmation de Suguba, il vous appelle pour convenir du moment et vous indiquer l’adresse.</>
              : <><strong>Remis par le vendeur lui-même</strong>{p.remiseVendeur.avecService ? ' (livraison et prestation)' : ''}. Après la confirmation de Suguba, il vous appelle pour convenir du rendez-vous.</>}
            {' '}Vous présenterez votre reçu QR au moment de la remise.
          </p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Mode de réception" className="grid grid-cols-2 gap-2">
          {([
            { valeur: 'home_delivery', Icone: Bike, titre: 'À domicile', detail: 'Livré chez vous', desactive: false },
            { valeur: 'pickup_point', Icone: Store, titre: 'Point relais', detail: p.relaisImpossible ? 'Indisponible ici' : libelleRelais, desactive: !relaisPossible },
          ] as const).map(({ valeur, Icone, titre, detail, desactive }) => {
            const actif = p.mode === valeur;
            return (
              <button key={valeur} type="button" role="radio" aria-checked={actif} disabled={desactive} onClick={() => p.onMode(valeur)}
                className={`relative text-left rounded-2xl border p-3 transition-all disabled:opacity-50 ${actif ? CARTE_CHOIX_ACTIVE : CARTE_CHOIX_INACTIVE}`}>
                <Icone className={`w-5 h-5 ${actif ? 'text-suguba-brand-dark' : 'text-slate-400'}`} />
                <span className="block text-sm font-bold text-slate-900 mt-1.5">{titre}</span>
                <span className="block text-xs text-slate-500">{detail}</span>
                {actif && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-suguba-profond text-white flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {p.relaisImpossible && <p className="text-xs text-slate-600">{p.relaisImpossible}</p>}

      {p.mode === 'home_delivery' ? (
        <div className="space-y-4">
          <Field label="Ville" htmlFor="champ-ville" requis>
            <ChoicePicker id="champ-ville" valeur={p.ville} onChange={p.onVille}
              // Bamako en tête (livraison la plus demandée, prix au quartier) ; ailleurs, livraison en gare.
              choix={Object.entries(villes)
                .sort(([a], [b]) => (a.toLowerCase() === 'bamako' ? -1 : b.toLowerCase() === 'bamako' ? 1 : a.localeCompare(b, 'fr')))
                .map(([ville, frais]) => ({
                  valeur: ville,
                  libelle: PRECISION_VILLE[ville] ? `${ville} (${PRECISION_VILLE[ville]})` : ville,
                  detail: ville.toLowerCase() === 'bamako' ? 'Selon le quartier' : formatF(Number(frais)),
                }))} />
          </Field>
          <Field label="Quartier" htmlFor="champ-quartier" requis erreur={p.erreurs.quartier}>
            {estBamako ? (
              <NeighborhoodPicker id="champ-quartier" value={p.quartier} placeholder="Choisir votre quartier"
                invalide={Boolean(p.erreurs.quartier)} onChange={p.onQuartier} onPosition={p.onPosition} />
            ) : (
              <Input id="champ-quartier" placeholder="Ex : Centre-ville" value={p.quartier}
                onChange={(e) => p.onQuartier(e.target.value)} aria-invalid={Boolean(p.erreurs.quartier)} />
            )}
          </Field>
          <Field label="Repère pour le livreur" htmlFor="champ-repere" requis erreur={p.erreurs.repere}
            aide="Pharmacie, école, mosquée, station… la plus proche de chez vous.">
            <Input id="champ-repere" placeholder="Ex : en face de la pharmacie, portail bleu" value={p.repere}
              onChange={(e) => p.onRepere(e.target.value)} aria-invalid={Boolean(p.erreurs.repere)} />
          </Field>
          <Field label="Instructions (facultatif)" htmlFor="champ-notes">
            <Textarea id="champ-notes" rows={2} maxLength={1000} placeholder="Ex : appelez en arrivant, 2e étage"
              value={p.instructions} onChange={(e) => p.onInstructions(e.target.value)} />
          </Field>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Point relais" className="space-y-2">
          {points.length === 0 ? (
            <><Skeleton className="h-16" /><Skeleton className="h-16" /></>
          ) : points.map((point) => {
            const actif = p.relaisChoisiId === point.id;
            return (
              <button key={point.id} type="button" role="radio" aria-checked={actif} onClick={() => p.onRelais(point.id)}
                className={`w-full text-left rounded-2xl border p-3 flex items-start gap-3 transition-all ${actif ? CARTE_CHOIX_ACTIVE : CARTE_CHOIX_INACTIVE}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${actif ? 'border-suguba-brand' : 'border-slate-300'}`}>
                  {actif && <span className="w-2.5 h-2.5 rounded-full bg-suguba-brand" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 leading-snug">{point.nom}</span>
                  {point.horaires && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5"><Clock className="w-3 h-3" />{point.horaires}</span>
                  )}
                </span>
                <span className={`text-xs font-bold whitespace-nowrap ${point.frais === 0 ? 'text-suguba-brand-dark' : 'text-slate-900'}`}>
                  {point.frais === 0 ? 'Gratuit' : formatF(point.frais)}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Colis déposé sous 24 h. Un SMS vous donne le code de retrait.
          </p>
        </div>
      )}
    </>
  );
}

/** Code promo, replié tant qu'on ne l'ouvre pas. */
export function CodePromoCommande({ saisi, onSaisi, onAppliquer, avis, ouvertInitial = false }: {
  saisi: string; onSaisi: (v: string) => void; onAppliquer: () => void; avis: AvisPromo; ouvertInitial?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  return (
    <Card padding="p-4 sm:p-5">
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)} className="w-full min-h-[28px] flex items-center justify-between text-sm font-bold text-slate-700">
          <span className="flex items-center gap-2"><Tag className="w-4 h-4 text-slate-400" />Ajouter un code promo</span>
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      ) : (
        <Field label="Code promo" htmlFor="champ-promo" erreur={avis?.ton === 'erreur' ? avis.texte : undefined}>
          <div className="flex gap-2">
            <Input id="champ-promo" autoFocus={!ouvertInitial} autoCapitalize="characters" placeholder="Ex : TABASKI"
              value={saisi} onChange={(e) => onSaisi(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAppliquer(); } }} className="uppercase" />
            <Button type="button" variant="secondary" onClick={onAppliquer} className="h-12 shrink-0">Appliquer</Button>
          </div>
          {avis && avis.ton !== 'erreur' && (
            <p className={`text-xs font-semibold flex items-center gap-1 ${avis.ton === 'succes' ? 'text-suguba-brand-dark' : 'text-amber-700'}`}>
              {avis.ton === 'succes' && <Check className="w-3.5 h-3.5" strokeWidth={3} />}{avis.texte}
            </p>
          )}
        </Field>
      )}
    </Card>
  );
}

/** Ce qui rassure avant de confirmer, sous le récapitulatif. */
export function GarantiesCommande() {
  return (
    <ul className="px-1 space-y-1.5 text-xs text-slate-500">
      <li className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-suguba-brand-dark shrink-0" />Code secret remis au livreur à la réception</li>
      {/* PUB-02 : « aucun paiement en ligne » contredisait le Mobile Money facultatif proposé après la commande. */}
      <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-suguba-brand-dark shrink-0" />Aucun compte à créer, rien à payer maintenant</li>
    </ul>
  );
}

export const TEXTE_PAIEMENT = 'À payer au livreur, en espèces ou Mobile Money, après vérification du colis.';

/**
 * Téléphone : total et confirmation sous le pouce, dans une barre flottante
 * décollée du bord ; masquée pendant la saisie pour ne pas recouvrir le champ.
 */
export function BarreCommande({ formulaire, libelle, total, envoi, desactive }: {
  formulaire: string; libelle: string; total: string; envoi: boolean; desactive: boolean;
}) {
  const clavierOuvert = useClavierOuvert();
  if (clavierOuvert) return null;
  return (
    <div className="md:hidden fixed inset-x-3 z-40 bg-white border border-slate-200 rounded-3xl shadow-float" style={{ bottom: MARGE_BAS_FLOTTANT }}>
      <div className="px-4 py-2.5 flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 leading-none">{libelle}</p>
          <p className="text-lg font-bold text-slate-900 whitespace-nowrap mt-1 tabular-nums">{total}</p>
        </div>
        <Button type="submit" form={formulaire} size="lg" loading={envoi} disabled={desactive} className="flex-1">
          Confirmer
        </Button>
      </div>
    </div>
  );
}

/** Indicateur discret pendant un recalcul du total. */
export const RecalculEnCours = () => <SugubaLoader className="inline w-3.5 h-3.5 ml-1 text-slate-400" />;
