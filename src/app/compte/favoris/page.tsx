'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import OngletsCompte from '@/components/compte/OngletsCompte';
import BoutonFavori from '@/components/compte/BoutonFavori';

interface Favori { id: string; nom: string; slug: string; image: string | null; prix: number | null; disponible: boolean }

/** Mes favoris (2026-09-26, compte client — C2). */
export default function FavorisPage() {
  const [liste, setListe] = useState<Favori[] | null>(null);
  const [etat, setEtat] = useState<'ok' | 'deconnecte' | 'erreur'>('ok');

  const charger = useCallback(() => fetch('/api/compte/favoris', { cache: 'no-store' })
    .then(async (r) => {
      if (r.status === 401) { setEtat('deconnecte'); return; }
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setListe(j.favoris || []);
    }).catch(() => setEtat('erreur')), []);
  useEffect(() => { charger(); }, [charger]);

  return (
    <PageReseau titre="Mes favoris" sousTitre="Les produits que vous gardez sous la main." retour={{ href: '/', libelle: 'Accueil' }}>
      <OngletsCompte actif="/compte/favoris" />
      {etat === 'deconnecte' ? (
        <EmptyState icone={Heart} titre="Connectez-vous pour garder vos favoris"
          action={<Button href="/login?next=%2Fcompte%2Ffavoris">Me connecter</Button>} />
      ) : etat === 'erreur' ? <EmptyState icone={Heart} titre="Favoris indisponibles" texte="Réessayez dans un instant." />
        : !liste ? <Skeleton className="h-40" />
        : liste.length === 0 ? (
          <EmptyState icone={Heart} titre="Aucun favori pour l’instant" texte="Touchez le cœur sur la fiche d’un produit pour le garder ici."
            action={<Button href="/">Découvrir le catalogue</Button>} />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {liste.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3">
                  <Link href={`/p/${encodeURIComponent(f.slug)}`} className="flex items-center gap-3 min-w-0 flex-1 min-h-11">
                    {f.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={f.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0" />
                      : <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 truncate">{f.nom}</span>
                      <span className="block text-xs text-slate-500">
                        {!f.disponible ? 'Indisponible pour le moment' : f.prix ? `${f.prix.toLocaleString('fr-FR')} F` : 'Prix de nos revendeurs'}
                      </span>
                    </span>
                  </Link>
                  <BoutonFavori produitId={f.id} className="shadow-none border border-slate-200" />
                </li>
              ))}
            </ul>
          </Card>
        )}
    </PageReseau>
  );
}
