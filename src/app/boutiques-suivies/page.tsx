'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ChevronRight } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Surface';

/**
 * Boutiques suivies (§ 32 des écrans).
 *
 * Accessible sans compte : un client qui a suivi une boutique avec son
 * numéro WhatsApp la retrouve ici, sur le même appareil (numéro mémorisé par
 * le bouton « Suivre », voir BoutonSuivre).
 */

interface BoutiqueSuivie {
  slug: string;
  nom: string;
  accroche: string | null;
  logo: string | null;
  abonnes: number;
  type: string;
}

export default function BoutiquesSuiviesPage() {
  const [boutiques, setBoutiques] = useState<BoutiqueSuivie[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let telephone = '';
    try { telephone = localStorage.getItem('suguba_suivi_tel') || ''; } catch { /* navigation privée */ }
    let annule = false;
    fetch(`/api/reseau/boutiques-suivies${telephone ? `?telephone=${encodeURIComponent(telephone)}` : ''}`)
      .then((r) => r.json())
      .then((data) => { if (!annule) setBoutiques(data.boutiques || []); })
      .catch(() => { /* état vide */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  return (
    <PageReseau titre="Boutiques suivies" sousTitre="Leurs nouveautés et leurs promotions, en premier.">
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : boutiques.length === 0 ? (
        <EmptyState
          icone={Heart}
          titre="Vous ne suivez aucune boutique"
          texte="Sur la page d’une boutique, appuyez sur « Suivre cette boutique » pour la retrouver ici."
          action={<Button href="/">Découvrir les produits</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {boutiques.map((b) => (
            <Link
              key={b.slug}
              href={`/boutique/${b.slug}`}
              className="flex items-center gap-3 bg-white rounded-3xl border border-slate-200 p-3 hover:border-slate-300 active:scale-[0.99] transition-all"
            >
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0">
                  {b.nom.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{b.nom}</p>
                <p className="text-xs text-slate-500 truncate">
                  {b.accroche || (b.type === 'supplier' ? 'Fournisseur' : 'Revendeur')} · {b.abonnes} abonné{b.abonnes > 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
