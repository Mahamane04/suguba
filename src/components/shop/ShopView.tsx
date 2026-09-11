import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import ProductCard from '@/components/product/ProductCard';
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
            {boutique.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={boutique.logo}
                alt={boutique.nom}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-2xl border-2 border-white/20 shrink-0">
                {boutique.nom.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-500/30">
                {estRevendeur ? 'Revendeur partenaire Suguba' : 'Boutique sur Suguba'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight">{titre}</h1>
              <p className="text-xs text-slate-300">
                {boutique.produits.length} article{boutique.produits.length > 1 ? 's' : ''}
                {boutique.categorie ? ` · ${boutique.categorie}` : ''}
                {boutique.livraisons > 0 ? ` · ${boutique.livraisons} livraison${boutique.livraisons > 1 ? 's' : ''} réussie${boutique.livraisons > 1 ? 's' : ''}` : ''}
              </p>
              {boutique.description && (
                <p className="text-xs text-slate-300/90 pt-1 max-w-md">{boutique.description}</p>
              )}
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
            {boutique.produits.map((p, i) => (
              // Carte commune : plusieurs photos, partage WhatsApp en un clic.
              // Le lien d'achat garde le code de la boutique visitée.
              <ProductCard
                key={p.id}
                produit={{ id: p.id, slug: p.slug, nom: p.nom, prix: p.prix, categorie: p.categorie, images: p.images, enStock: p.enStock }}
                refCode={refCode}
                priority={i < 4}
              />
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
