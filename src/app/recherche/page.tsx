'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Store, Factory, Tag, Loader2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Input } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Surface';

/**
 * Recherche globale (§ Z) : produits, boutiques, fournisseurs et catégories
 * sur une seule page. La recherche de l'accueil, elle, filtre seulement les
 * produits déjà affichés.
 */

interface Resultats {
  produits: { slug: string; nom: string; categorie: string; prix: number; image: string | null }[];
  boutiques: { lien: string; nom: string; accroche: string | null; logo: string | null; type: string; abonnes: number }[];
  fournisseurs: { lien: string; nom: string; logo: string | null }[];
  categories: string[];
}

function Vignette({ image, nom }: { image: string | null; nom: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return image ? <img src={image} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" />
    : <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0">{nom.charAt(0).toUpperCase()}</div>;
}

function Contenu() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('q') || '';
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<Resultats | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const texte = q.trim();
    if (texte.length < 2) { setRes(null); return; }
    setEnCours(true);
    const minuterie = setTimeout(() => {
      router.replace(`/recherche?q=${encodeURIComponent(texte)}`, { scroll: false });
      fetch(`/api/reseau/recherche?q=${encodeURIComponent(texte)}`)
        .then((r) => r.json()).then(setRes).catch(() => undefined).finally(() => setEnCours(false));
    }, 300);
    return () => clearTimeout(minuterie);
  }, [q, router]);

  const total = res ? res.produits.length + res.boutiques.length + res.fournisseurs.length + res.categories.length : 0;

  return (
    <PageReseau titre="Rechercher" sousTitre="Produits, boutiques, fournisseurs et catégories.">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ventilateur, électroménager, une boutique…" className="pl-10" aria-label="Rechercher" />
        {enCours && <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />}
      </div>

      {q.trim().length < 2 ? null : res && total === 0 && !enCours ? (
        <EmptyState icone={Search} titre="Aucun résultat" texte="Essayez un autre mot, ou un mot plus court." />
      ) : res && (
        <div className="space-y-5">
          {res.categories.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />Catégories</h2>
              <div className="flex flex-wrap gap-2">
                {res.categories.map((c) => (
                  <Link key={c} href={`/?categorie=${encodeURIComponent(c)}`} className="px-3.5 min-h-[40px] inline-flex items-center rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700">{c}</Link>
                ))}
              </div>
            </section>
          )}
          {res.produits.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-slate-600">Produits ({res.produits.length})</h2>
              <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {res.produits.map((p) => (
                  <Link key={p.slug} href={`/p/${p.slug}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <Vignette image={p.image} nom={p.nom} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{p.nom}</p>
                      <p className="text-xs text-slate-500">{p.categorie}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{p.prix.toLocaleString('fr-FR')} F</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {res.boutiques.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5"><Store className="w-3.5 h-3.5" />Boutiques</h2>
              <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {res.boutiques.map((b) => (
                  <Link key={b.lien} href={b.lien} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <Vignette image={b.logo} nom={b.nom} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{b.nom}</p>
                      <p className="text-xs text-slate-500 truncate">{b.accroche || (b.type === 'supplier' ? 'Fournisseur' : b.type === 'suguba' ? 'Boutique Suguba' : 'Revendeur')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {res.fournisseurs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5"><Factory className="w-3.5 h-3.5" />Fournisseurs</h2>
              <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {res.fournisseurs.map((f) => (
                  <Link key={f.lien} href={f.lien} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <Vignette image={f.logo} nom={f.nom} />
                    <p className="text-sm font-bold text-slate-900 truncate">{f.nom}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageReseau>
  );
}

export default function RecherchePage() {
  // useSearchParams exige une frontière Suspense pour le build de production.
  return <Suspense fallback={null}><Contenu /></Suspense>;
}
