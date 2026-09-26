import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import PartenaireVisite from '@/components/common/PartenaireVisite';
import ProductImage from '@/components/common/ProductImage';
import { chargerPageCampagne } from '@/lib/page-campagne';
import { URL_APP } from '@/lib/shop';
import { normaliserCodeRevendeur } from '@/lib/ancrage-revendeur';
import { ArrowRight, KeyRound, ShieldCheck, Truck } from 'lucide-react';

/**
 * Page de marque d'une campagne (2026-09-26, lot 2b) — /campagne/<id>.
 * Partagée par les revendeurs avec leur code : ?ref=<code>.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = await chargerPageCampagne(id);
  if (!c) return { title: 'Campagne introuvable — Suguba' };
  const titre = `${c.titre} — ${c.marque.nom}`;
  const description = c.message?.slice(0, 160) || `${c.produit.nom}, livré à Bamako. Vous payez à la livraison.`;
  const image = c.marque.couverture || c.produit.images[0] || c.marque.logo;
  return {
    title: titre,
    description,
    openGraph: { title: titre, description, url: `${URL_APP}/campagne/${c.id}`, siteName: 'Suguba', locale: 'fr_FR', type: 'website', ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: titre, description },
  };
}

export default async function PageCampagneMarque({ params, searchParams }: Params) {
  const { id } = await params;
  const { ref } = await searchParams;
  const c = await chargerPageCampagne(id);
  if (!c) notFound();
  const code = normaliserCodeRevendeur(ref);
  const lienProduit = `/p/${c.produit.slug}${code ? `?ref=${encodeURIComponent(code)}` : ''}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 space-y-4">
        <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="relative h-36 sm:h-48 bg-suguba-profond">
            {c.marque.couverture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.marque.couverture} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
          </div>
          <div className="px-5 pb-5 -mt-10 space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-white border-4 border-white shadow overflow-hidden flex items-center justify-center">
              {c.marque.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.marque.logo} alt={c.marque.nom} className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-suguba-profond">{c.marque.nom.charAt(0)}</span>}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-suguba-brand-dark">{c.marque.nom} · sur Suguba</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{c.titre}</h1>
            {c.message && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{c.message}</p>}
            <PartenaireVisite refUrl={code} />
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100">
            {c.produit.images[0] && <ProductImage src={c.produit.images[0]} alt={c.produit.nom} fill className="object-cover" />}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{c.produit.nom}</h2>
            <p className="text-2xl font-bold text-suguba-brand-dark">
              {c.produit.prix ? `${Math.round(c.produit.prix).toLocaleString('fr-FR')} FCFA` : <span className="text-base">Prix fixé par nos revendeurs partenaires</span>}
            </p>
            {c.active ? (
              <Link href={lienProduit} className="h-12 w-full rounded-2xl bg-suguba-profond hover:bg-suguba-profond-2 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                Voir et commander <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <p className="text-xs text-slate-500">Cette campagne est terminée ; le produit reste disponible.</p>
                <Link href={lienProduit} className="h-12 w-full rounded-2xl border border-slate-200 text-slate-900 text-sm font-bold inline-flex items-center justify-center gap-2">
                  Voir le produit <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
            <ul className="text-xs text-slate-700 space-y-1.5">
              <li className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-suguba-brand-dark" />Livré par Suguba à Bamako</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-suguba-brand-dark" />Vous payez à la livraison</li>
              <li className="flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-amber-600" />Code secret remis au livreur</li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
