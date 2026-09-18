'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Coins, MousePointerClick, Percent, Users, TrendingUp, TrendingDown } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import GraphiqueBarres from '@/components/reseau/GraphiqueBarres';
import { Card, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import type { PointJour } from '@/lib/reseau/stats';

/** Analyses fournisseur, 30 derniers jours (§ 26 des écrans). */

interface Donnees {
  commandes: PointJour[];
  ca: PointJour[];
  visites: PointJour[];
  totaux: {
    commandes: number; evolutionCommandes: number | null; chiffreAffaires: number;
    visites: number; conversion: number; revendeursActifs: number;
  } | null;
  topProduits: { nom: string; commandes: number; ca: number }[];
  sponsorisations: { libelle: string; statut: string; budget: number; clics: number; chiffreAffaires: number; roi: number | null }[];
}

const k = (v: number) => (v >= 1000 ? `${Math.round(v / 1000).toLocaleString('fr-FR')}k` : v.toLocaleString('fr-FR'));

export default function AnalysesFournisseurPage() {
  const [d, setD] = useState<Donnees | null>(null);

  useEffect(() => {
    let annule = false;
    fetch('/api/supplier/analyses')
      .then((r) => r.json())
      .then((data) => { if (!annule) setD(data); })
      .catch(() => { if (!annule) setD({ commandes: [], ca: [], visites: [], totaux: null, topProduits: [], sponsorisations: [] }); });
    return () => { annule = true; };
  }, []);

  const t = d?.totaux;

  return (
    <PageReseau titre="Analyses" sousTitre="Les 30 derniers jours." retour={{ href: '/supplier', libelle: 'Espace fournisseur' }} large>
      {!d ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Commandes" valeur={t?.commandes ?? 0} icone={ShoppingBag}
              aide={t?.evolutionCommandes == null ? 'Pas de période précédente' : `${t.evolutionCommandes >= 0 ? '+' : ''}${t.evolutionCommandes} % vs 30 j avant`}
            />
            <StatCard label="CA livré" valeur={`${k(t?.chiffreAffaires ?? 0)} F`} icone={Coins} accent />
            <StatCard label="Visites" valeur={t?.visites ?? 0} icone={MousePointerClick} aide="Liens partagés vers vos produits" />
            <StatCard label="Conversion" valeur={`${t?.conversion ?? 0} %`} icone={Percent} aide="Commandes / visites" />
            <StatCard label="Revendeurs actifs" valeur={t?.revendeursActifs ?? 0} icone={Users} aide="Ont vendu ce mois" />
          </div>

          {d.commandes.length > 0 && <GraphiqueBarres titre="Commandes par jour" points={d.commandes} />}
          {d.visites.length > 0 && <GraphiqueBarres titre="Visites par jour" points={d.visites} />}
          {d.ca.length > 0 && <GraphiqueBarres titre="Chiffre d’affaires livré" points={d.ca} unite=" F" formater={k} />}

          <Card className="space-y-2.5">
            <p className="text-sm font-black text-slate-900">Vos produits les plus vendus</p>
            {d.topProduits.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune commande sur la période.</p>
            ) : d.topProduits.map((p, i) => (
              <div key={p.nom + i} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-700"><strong className="text-slate-900">{i + 1}.</strong> {p.nom}</span>
                <span className="shrink-0 font-bold text-slate-900 tabular-nums">{p.commandes} cmd · {k(p.ca)} F</span>
              </div>
            ))}
          </Card>

          {d.sponsorisations.length > 0 && (
            <Card className="space-y-2.5">
              <p className="text-sm font-black text-slate-900">Retour de vos sponsorisations</p>
              {d.sponsorisations.map((s, i) => (
                <div key={s.libelle + i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-slate-700">{s.libelle}</span>
                  {s.roi == null ? (
                    <StatusPill ton="neutre">—</StatusPill>
                  ) : (
                    <StatusPill ton={s.roi >= 1 ? 'succes' : 'attente'}>
                      {s.roi >= 1 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {s.roi} F de CA / F dépensé
                    </StatusPill>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </PageReseau>
  );
}
