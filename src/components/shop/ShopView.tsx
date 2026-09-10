import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import ProductImage from '@/components/common/ProductImage';
import ShopShareBar from '@/components/shop/ShopShareBar';
import type { Boutique } from '@/lib/shop';
import { ShieldCheck, Truck, KeyRound, ArrowRight, Store, Users } from 'lucide-react';

/**
 * Vitrine commune aux boutiques fournisseur (/s/) et revendeur (/r/).
 *
 * Composant SERVEUR : il reçoit des données déjà filtrées par src/lib/shop.ts.
 *
 * Tout ce qui rassure le client ici est VRAI et vérifiable : paiement à la
 * livraison, code secret remis au livreur, livraison par Suguba, et le nombre
 * de livraisons réussies quand il y en a. Aucune note, aucun avis, aucun
 * compteur inventé — l'ancienne page affichait une note « 4.9 / 5 » écrite en
 * dur, ce qui est une pratique commerciale trompeuse.
 */
export default function ShopView({
  boutique,
  urlPartage,
  refCode,
}: {
  boutique: Boutique;
  urlPartage: string;
  refCode: string | null;
}) {
  const estRevendeur = boutique.type === 'revendeur';
  const titre = estRevendeur ? `La sélection de ${boutique.nom}` : boutique.nom;
  const texteWhatsApp = estRevendeur
    ? `🛍️ Découvre ma sélection sur Suguba — paiement à la livraison, livré chez toi à Bamako.`
    : `🛍️ ${boutique.nom} sur Suguba — paiement à la livraison, livré chez toi à Bamako.`;
  const suffixeRef = refCode ? `?ref=${encodeURIComponent(refCode)}` : '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-5 sm:p-8 shadow-xl space-y-5">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-2xl border-2 border-white/20 shrink-0">
              {boutique.nom.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                {estRevendeur ? 'Revendeur partenaire Suguba' : 'Boutique sur Suguba'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight">{titre}</h1>
              <p className="text-xs text-slate-300">
                {boutique.produits.length} article{boutique.produits.length > 1 ? 's' : ''}
                {boutique.categorie ? ` · ${boutique.categorie}` : ''}
                {boutique.livraisons > 0 ? ` · ${boutique.livraisons} livraison${boutique.livraisons > 1 ? 's' : ''} réussie${boutique.livraisons > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>

          <ShopShareBar url={urlPartage} texte={texteWhatsApp} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-center space-x-2"><Truck className="w-4 h-4 text-emerald-400 shrink-0" /><span>Livré par Suguba</span></div>
            <div className="flex items-center space-x-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /><span>Vous payez à la livraison</span></div>
            <div className="flex items-center space-x-2"><KeyRound className="w-4 h-4 text-amber-400 shrink-0" /><span>Code secret remis au livreur</span></div>
          </div>
        </div>

        {boutique.selectionVide && (
          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-3">
            Sélection en préparation — voici en attendant les articles du catalogue Suguba.
          </p>
        )}

        {boutique.produits.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
            <Store className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Aucun article pour le moment</p>
            <p className="text-xs text-slate-500">Revenez bientôt, la boutique se remplit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {boutique.produits.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}${suffixeRef}`}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-lg transition-all flex flex-col group">
                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                  <ProductImage src={p.image ?? ''} alt={p.nom} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  {!p.enStock && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold">Rupture</span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{p.categorie}</p>
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">{p.nom}</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base font-black text-suguba-brand">{p.prix.toLocaleString('fr-FR')} F</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-black text-slate-900">Vous aussi, gagnez en partageant</p>
              <p className="text-xs text-slate-500">Sans stock : Suguba livre, vous touchez une commission sur chaque vente.</p>
            </div>
          </div>
          <Link href="/rejoindre" className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center">
            Devenir revendeur
          </Link>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
