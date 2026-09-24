'use client';

import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Package, Trophy } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';

/**
 * Mon réseau de revendeurs (§ 22 des écrans).
 *
 * Seuls le prénom et l'initiale sont affichés : un fournisseur n'a pas à
 * disposer du fichier nominatif des revendeurs de Suguba, et un contact
 * direct ouvrirait la porte à la vente hors plateforme.
 */

interface Revendeur {
  id: string;
  nom: string;
  code: string | null;
  ville: string | null;
  articles: number;
  depuis: string | null;
  commandes: number;
  chiffreAffaires: number;
  derniereActivite: string | null;
}

interface ProduitPhare { id: string; nom: string; revendeurs: number }

export default function RevendeursFournisseurPage() {
  const [revendeurs, setRevendeurs] = useState<Revendeur[]>([]);
  const [produitsPhares, setProduitsPhares] = useState<ProduitPhare[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    fetch('/api/supplier/revendeurs')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        setRevendeurs(data.revendeurs || []);
        setProduitsPhares(data.produitsPhares || []);
      })
      .catch(() => { /* état vide */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const actifs = revendeurs.filter((r) => r.commandes > 0).length;
  const ca = revendeurs.reduce((s, r) => s + r.chiffreAffaires, 0);

  return (
    <PageReseau
      titre="Mes revendeurs"
      sousTitre="Qui vend vos produits, et combien."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
      large
    >
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Revendeurs" valeur={revendeurs.length} icone={Users} />
        <StatCard label="Actifs" valeur={actifs} aide="Ont déjà vendu" icone={TrendingUp} accent />
        <StatCard label="CA généré" valeur={`${(ca / 1000).toFixed(0)}k F`} />
      </div>

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : revendeurs.length === 0 ? (
        <EmptyState
          icone={Users}
          titre="Aucun revendeur pour l’instant"
          texte="Les revendeurs choisissent vos produits dans le catalogue. Activez le recrutement sur votre boutique pour être vu par tout le réseau."
          action={<Button href="/supplier/boutique">Recruter des revendeurs</Button>}
        />
      ) : (
        <>
          {produitsPhares.length > 0 && (
            <Card className="space-y-2.5">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                Vos produits les plus repris
              </p>
              <div className="space-y-1.5">
                {produitsPhares.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-700">{p.nom}</span>
                    <StatusPill ton="neutre">{p.revendeurs} revendeur{p.revendeurs > 1 ? 's' : ''}</StatusPill>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
            {revendeurs.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{r.nom}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Package className="w-3 h-3" />
                    {r.articles} article{r.articles > 1 ? 's' : ''}
                    {r.ville && <span>· {r.ville}</span>}
                    {r.derniereActivite && (
                      <span>· actif le {new Date(r.derniereActivite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{r.chiffreAffaires.toLocaleString('fr-FR')} F</p>
                  <p className="text-xs text-slate-500">{r.commandes} commande{r.commandes > 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </PageReseau>
  );
}
