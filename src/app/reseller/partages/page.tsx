'use client';

import React, { useEffect, useState } from 'react';
import { Share2, MousePointerClick, ShoppingBag, Coins, Link2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import GraphiqueBarres from '@/components/reseau/GraphiqueBarres';
import type { PointJour } from '@/lib/reseau/stats';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import { CANAUX } from '@/lib/reseau/codes';
import { formatF, formatNombre, FORMAT_DATE } from '@/lib/montant';
import { libellePartageBoutique } from '@/lib/partage-boutique';

/**
 * Historique de partage (§ 12 des écrans) — la page qui répond à « est-ce que
 * ça sert à quelque chose de partager ? ».
 *
 * Chaque ligne relie un partage à ce qu'il a réellement produit : clics,
 * visiteurs distincts, commandes, chiffre d'affaires. C'est la contrepartie
 * visible du module de tracking.
 */

interface Lien {
  code: string;
  cible: string;
  ref: string | null;
  canal: string;
  libelle: string | null;
  clics: number;
  visiteurs: number;
  commandes: number;
  chiffreAffaires: number;
  tauxConversion: number;
  creeLe: string;
}

const LIBELLE_CIBLE: Record<string, string> = {
  product: 'Produit',
  store: 'Ma boutique',
  referral: 'Parrainage',
  campaign: 'Campagne',
  mission: 'Mission',
  home: 'Accueil',
};

function nomCanal(valeur: string): string {
  return CANAUX.find((c) => c.valeur === valeur)?.libelle || 'Autre';
}

/**
 * Titre d'une ligne. Lien de boutique (lot 4 du chantier boutique, 2026-10-03) :
 * « Ma boutique », « Ma boutique · Coups de cœur » ou « Ma boutique · Pagnes » ;
 * la ligne affichait l'adresse brute (« awa-mode »).
 */
function titreDuLien(l: Lien): string {
  if (l.cible === 'store') return libellePartageBoutique(l.ref, l.libelle);
  return l.libelle || l.ref || LIBELLE_CIBLE[l.cible] || 'Partage';
}

export default function PartagesPage() {
  const [liens, setLiens] = useState<Lien[]>([]);
  const [totaux, setTotaux] = useState({ liens: 0, clics: 0, visiteurs: 0, commandes: 0, chiffreAffaires: 0, tauxConversion: 0 });
  const [chargement, setChargement] = useState(true);
  const [visites, setVisites] = useState<PointJour[]>([]);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/partages')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        setLiens(data.liens || []);
        if (data.totaux) setTotaux(data.totaux);
        setVisites(data.visitesParJour || []);
      })
      .catch(() => { /* état vide */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  return (
    <PageReseau
      titre="Mes partages"
      sousTitre="Ce que chaque lien partagé a réellement rapporté."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      {/* Finitions du lot 7 (audit UI/UX du 2026-10-02) : quatre tuiles à 0 avant le
          premier partage n'apprenaient rien ; elles apparaissent avec le premier lien. */}
      {totaux.liens > 0 && <div className="grid grid-cols-2 gap-3">
        <StatCard label="Visites" valeur={totaux.clics} aide={`${totaux.visiteurs} personnes différentes`} icone={MousePointerClick} />
        <StatCard label="Commandes" valeur={totaux.commandes} aide={`${totaux.tauxConversion}% de conversion`} icone={ShoppingBag} accent />
        <StatCard label="Chiffre d’affaires" valeur={`${formatF(totaux.chiffreAffaires)}`} icone={Coins} />
        <StatCard label="Liens créés" valeur={totaux.liens} icone={Link2} />
      </div>}

      {totaux.clics > 0 && visites.length > 0 && <GraphiqueBarres titre="Visites des 14 derniers jours" points={visites} />}

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : liens.length === 0 ? (
        <EmptyState
          icone={Share2}
          titre="Aucun partage pour l’instant"
          texte="Partagez un produit depuis le catalogue : Suguba comptera les visites, les commandes et ce que ça vous rapporte."
          action={<Button href="/reseller/catalog">Partager un produit</Button>}
        />
      ) : (
        <div className="space-y-3">
          {liens.map((l) => (
            <Card key={l.code} className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {titreDuLien(l)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {LIBELLE_CIBLE[l.cible] || l.cible} · {nomCanal(l.canal)} ·{' '}
                    {new Date(l.creeLe).toLocaleDateString('fr-FR', FORMAT_DATE.jour)}
                  </p>
                </div>
                <StatusPill ton={l.commandes > 0 ? 'succes' : 'neutre'}>{l.tauxConversion}%</StatusPill>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 py-2">
                  <p className="text-base font-bold text-slate-900 tabular-nums">{l.clics}</p>
                  <p className="text-xs font-semibold text-slate-600">Visites</p>
                </div>
                <div className="rounded-2xl bg-slate-50 py-2">
                  <p className="text-base font-bold text-slate-900 tabular-nums">{l.commandes}</p>
                  <p className="text-xs font-semibold text-slate-600">Commandes</p>
                </div>
                <div className="rounded-2xl bg-slate-50 py-2">
                  <p className="text-base font-bold text-suguba-brand-dark tabular-nums">
                    {formatNombre(l.chiffreAffaires)}
                  </p>
                  <p className="text-xs font-bold text-slate-500">F</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
