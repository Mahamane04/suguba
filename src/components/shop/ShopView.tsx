import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import BoutiqueProduits from '@/components/shop/BoutiqueProduits';
import ShopShareBar from '@/components/shop/ShopShareBar';
import type { Boutique } from '@/lib/shop';
import BadgeConfiance from '@/components/ui/BadgeConfiance';
import { quartierReconnu } from '@/lib/reseau/proximite';
import AncrageRevendeur from '@/components/common/AncrageRevendeur';
import { ShieldCheck, Truck, KeyRound, Store, Users, MapPin, Pencil, ImagePlus } from 'lucide-react';

/**
 * Vitrine commune aux boutiques fournisseur (/s/), revendeur (/r/) et réseau
 * (/boutique/).
 *
 * Composant SERVEUR : il reçoit des données déjà filtrées par src/lib/shop.ts.
 *
 * En-tête refait le 2026-09-24 sur le modèle d'une vraie vitrine : couverture
 * en haut, logo qui la chevauche, nom, puis les actions (suivre, partager) sur
 * une seule ligne. Sans couverture, un fond aux couleurs de Suguba la remplace :
 * la page ne paraît jamais vide.
 *
 * Tout ce qui rassure le client ici est VRAI et vérifiable : paiement à la
 * livraison, code secret remis au livreur, livraison par Suguba, et le nombre
 * de livraisons réussies quand il y en a. Aucune note, aucun avis inventé.
 */
export default function ShopView({
  boutique,
  urlPartage,
  refCode,
  complement,
  quartier,
  accroche,
  suivre,
  galerie,
  lienModifier,
}: {
  boutique: Boutique;
  urlPartage: string;
  refCode: string | null;
  /** Bloc libre sous les actions (vitrines historiques). */
  complement?: React.ReactNode;
  /** Quartier de la boutique, lien vers les boutiques voisines. */
  quartier?: string | null;
  /** Phrase d'accroche choisie par le propriétaire dans « Ma boutique ». */
  accroche?: string | null;
  /** Bouton « Suivre » (boutiques du réseau). */
  suivre?: React.ReactNode;
  /** Diaporama des photos de la boutique, affiché sous l'en-tête. */
  galerie?: React.ReactNode;
  /** Présent seulement quand le visiteur est le propriétaire : page où modifier la boutique. */
  lienModifier?: string | null;
}) {
  const estRevendeur = boutique.type === 'revendeur';
  const titre = estRevendeur ? `La sélection de ${boutique.nom}` : boutique.nom;
  const texteWhatsApp = estRevendeur
    ? `🛍️ Découvre ma sélection sur Suguba — paiement à la livraison, livré chez toi à Bamako.`
    : `🛍️ ${boutique.nom} sur Suguba — paiement à la livraison, livré chez toi à Bamako.`;
  const nbArticles = boutique.produits.length;
  const visuelsManquants = !boutique.logo || !boutique.couverture;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />
      {/* Boutique d'un revendeur : il devient le revendeur d'origine du visiteur (lot B). */}
      {estRevendeur && refCode && <AncrageRevendeur code={refCode} />}

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Couverture */}
          <div className="relative h-36 sm:h-56">
            {boutique.couverture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={boutique.couverture} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-suguba-profond"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 88% 12%, rgba(199,244,100,0.30), transparent 42%), radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
                  backgroundSize: 'auto, 14px 14px',
                }}
              />
            )}
            {lienModifier && (
              <Link
                href={lienModifier}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/95 backdrop-blur text-slate-900 text-xs font-bold shadow-sm hover:bg-white"
              >
                <Pencil className="w-3.5 h-3.5" /> Modifier la boutique
              </Link>
            )}
          </div>

          <div className="px-4 sm:px-8 pb-5">
            {/* Logo qui chevauche la couverture */}
            <div className="-mt-10 sm:-mt-14 relative">
              {boutique.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boutique.logo}
                  alt={boutique.nom}
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover bg-white ring-4 ring-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-suguba-menthe text-suguba-profond ring-4 ring-white shadow-md flex items-center justify-center font-bold text-3xl sm:text-4xl">
                  {boutique.nom.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Identité */}
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-suguba-brand-dark">
                {estRevendeur ? 'Revendeur partenaire Suguba' : 'Boutique sur Suguba'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{titre}</h1>
              {accroche && <p className="text-sm text-slate-600">{accroche}</p>}
              {boutique.badges && boutique.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {boutique.badges.map((b) => <BadgeConfiance key={b} cle={b} />)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span><strong className="text-slate-900">{nbArticles}</strong> article{nbArticles > 1 ? 's' : ''}</span>
                {boutique.categorie && <span>{boutique.categorie}</span>}
                {boutique.livraisons > 0 && (
                  <span>
                    <strong className="text-slate-900">{boutique.livraisons}</strong> livraison{boutique.livraisons > 1 ? 's' : ''} réussie{boutique.livraisons > 1 ? 's' : ''}
                  </span>
                )}
                {quartier && quartierReconnu(quartier) && (
                  <Link
                    href={`/boutiques?quartier=${encodeURIComponent(quartier)}`}
                    className="inline-flex items-center gap-1 min-h-[28px] font-semibold text-slate-700 hover:text-suguba-brand-dark"
                  >
                    <MapPin className="w-3.5 h-3.5 text-suguba-brand-dark" />
                    {quartier}
                    <span className="text-suguba-brand-dark underline underline-offset-2">· voisines</span>
                  </Link>
                )}
              </div>
              {boutique.description && (
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">{boutique.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-2">
              {suivre && <div className="sm:flex-none">{suivre}</div>}
              <ShopShareBar url={urlPartage} texte={texteWhatsApp} />
            </div>

            {complement && <div className="mt-4">{complement}</div>}

            {lienModifier && visuelsManquants && (
              <Link
                href={lienModifier}
                className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-3 hover:border-suguba-profond"
              >
                <ImagePlus className="w-5 h-5 text-suguba-brand-dark shrink-0" />
                <span className="text-xs text-slate-600">
                  <strong className="text-slate-900">Ajoutez {!boutique.logo && !boutique.couverture ? 'votre logo et une photo de couverture' : !boutique.logo ? 'votre logo' : 'une photo de couverture'}</strong>
                  {' '}: une boutique avec ses photos inspire plus confiance. Seul vous voyez ce message.
                </span>
              </Link>
            )}
          </div>

          {/* Garanties */}
          <div className="border-t border-slate-100 bg-suguba-sauge/60 px-4 sm:px-8 py-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-suguba-brand-dark shrink-0" />Livré par Suguba</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-suguba-brand-dark shrink-0" />Vous payez à la livraison</span>
            <span className="inline-flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-amber-600 shrink-0" />Code secret remis au livreur</span>
          </div>
        </section>

        {galerie}

        {boutique.selectionVide && (
          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-3">
            Sélection en préparation — voici en attendant les articles du catalogue Suguba.
          </p>
        )}

        {nbArticles === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
            <Store className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Aucun article pour le moment</p>
            <p className="text-xs text-slate-500">Revenez bientôt, la boutique se remplit.</p>
          </div>
        ) : (
          <BoutiqueProduits produits={boutique.produits} refCode={refCode} />
        )}

        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-suguba-brand-dark shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">Vous aussi, gagnez en partageant</p>
              <p className="text-xs text-slate-500">Sans stock : Suguba livre, vous touchez une commission sur chaque vente.</p>
            </div>
          </div>
          <Link href="/rejoindre" className="h-11 px-5 rounded-2xl bg-suguba-profond hover:bg-suguba-profond-2 text-white text-xs font-bold flex items-center justify-center">
            Devenir revendeur
          </Link>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
