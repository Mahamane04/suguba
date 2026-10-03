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
import Button from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Surface';
import { ShieldCheck, Truck, KeyRound, Store, Users, MapPin, Pencil, ImagePlus, ArrowDown, ChevronRight, PackagePlus } from 'lucide-react';
import { initiale } from '@/lib/initiale';
import { PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';
import { whatsappHelper } from '@/lib/whatsapp-helper';

/**
 * Propriétaire connecté sur SA vitrine (lot 1 du chantier boutique, 2026-10-03).
 * Absent pour un visiteur, et toujours absent sur /r/ et /s/ : leur rendu ne
 * change pas.
 */
export interface ProprietaireVitrine {
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée. */
  statut: string;
  abonnes: number;
  /** Profil actif revendeur. Sinon : bandeau « C'est votre boutique · Gérer ». */
  gestion: boolean;
}

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
  proprietaire,
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
  /** Propriétaire de la boutique revendeur principale : il n'y voit plus les éléments du visiteur. */
  proprietaire?: ProprietaireVitrine | null;
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
      {/* Boutique d'un revendeur : il devient le revendeur d'origine du visiteur (lot B).
          Jamais pour son propriétaire : il deviendrait pour 30 jours son propre
          revendeur d'origine (2026-10-03). */}
      {estRevendeur && refCode && !proprietaire && <AncrageRevendeur code={refCode} />}

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {/* Profil actif autre que revendeur : un seul bandeau, vers la porte unique,
            qui rebascule le profil. Lien classique (page rechargée) : le menu du
            bas reprend le profil revendeur. */}
        {proprietaire && !proprietaire.gestion && (
          <a href={PORTE_MA_BOUTIQUE}
            className="flex items-center justify-between gap-3 min-h-12 rounded-2xl bg-suguba-profond text-white px-4 py-2">
            <span className="text-sm font-semibold">C’est votre boutique</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-suguba-citron">Gérer<ChevronRight className="w-4 h-4" /></span>
          </a>
        )}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Couverture */}
          <div className="relative h-28 sm:h-56">
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
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-white/95 backdrop-blur text-slate-900 text-xs font-bold shadow-sm hover:bg-white"
              >
                <Pencil className="w-3.5 h-3.5" /> {proprietaire ? 'Personnaliser' : 'Modifier la boutique'}
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
                  {initiale(boutique.nom)}
                </div>
              )}
            </div>

            {/* Identité */}
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-suguba-brand-dark">
                {estRevendeur ? 'Revendeur partenaire Suguba' : boutique.presentation ? 'Fournisseur partenaire Suguba' : 'Boutique sur Suguba'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{titre}</h1>
              {proprietaire && (
                proprietaire.statut === 'active' ? (
                  <StatusPill ton="succes">En ligne</StatusPill>
                ) : (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                    <StatusPill ton="attente">Masquée par Suguba</StatusPill>
                    <p className="text-sm text-amber-950">Vos clients ne la voient pas pour le moment : vous seul la voyez.</p>
                    <a href={whatsappHelper.getSupportChatLink()} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center min-h-10 text-sm font-semibold text-suguba-brand-dark underline underline-offset-2">
                      Écrire au support Suguba
                    </a>
                  </div>
                )
              )}
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
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-none">{boutique.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-start gap-2">
              {/* Le propriétaire ne s'abonne pas à sa propre boutique : il voit ses abonnés. */}
              {proprietaire ? (
                <p className="flex-none inline-flex items-center gap-2 h-11 px-4 rounded-2xl bg-suguba-sauge text-sm text-suguba-profond">
                  <Users className="w-4 h-4" />
                  <span><strong className="tabular-nums">{proprietaire.abonnes}</strong> abonné{proprietaire.abonnes > 1 ? 's' : ''}</span>
                </p>
              ) : suivre && <div className="flex-none">{suivre}</div>}
              {/* Boutique masquée : un lien partagé mènerait le client à une page introuvable. */}
              {(!proprietaire || proprietaire.statut === 'active') && <ShopShareBar url={urlPartage} texte={texteWhatsApp} />}
            </div>

            {complement && <div className="mt-4">{complement}</div>}

            {boutique.presentation && (
              <a href="#revendeurs-partenaires"
                className="mt-4 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-suguba-profond hover:bg-suguba-profond-2 text-white text-xs font-bold">
                Découvrir les offres des revendeurs partenaires <ArrowDown className="w-4 h-4" />
              </a>
            )}

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

        {boutique.selectionVide && (proprietaire ? (
          // Le propriétaire reçoit une action, pas l'avis destiné aux clients (2026-10-03).
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-sm text-slate-700">Vos clients voient le catalogue Suguba en attendant vos articles.</p>
            <Button href="/reseller/catalog" variant="secondary" size="sm" className="self-start sm:self-auto shrink-0">
              <PackagePlus className="w-4 h-4" />Choisir mes articles
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-3">
            Sélection en préparation — voici en attendant les articles du catalogue Suguba.
          </p>
        ))}

        {nbArticles === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
            <Store className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Aucun article pour le moment</p>
            <p className="text-xs text-slate-500">Revenez bientôt, la boutique se remplit.</p>
          </div>
        ) : (
          <BoutiqueProduits produits={boutique.produits} refCode={refCode} presentation={Boolean(boutique.presentation)} />
        )}

        {/* Présentation du fournisseur (lot C) : on achète chez un revendeur partenaire. */}
        {boutique.presentation && (
          <section id="revendeurs-partenaires" className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 scroll-mt-24">
            <h2 className="text-sm font-bold text-slate-900">Où acheter ces produits ?</h2>
            {boutique.presentation.revendeurs.length > 0 ? (
              <>
                <p className="text-xs text-slate-600">
                  Les produits de {boutique.nom} sont vendus par nos revendeurs partenaires, qui vous accompagnent jusqu’à la livraison.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {boutique.presentation.revendeurs.map((r) => (
                    <li key={r.lien}>
                      <Link href={r.lien} className="flex items-center justify-between gap-3 min-h-11 rounded-2xl border border-slate-200 px-4 py-2.5 hover:border-suguba-profond">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 shrink-0 rounded-full bg-suguba-menthe text-suguba-profond text-xs font-bold flex items-center justify-center">{initiale(r.nom)}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900 truncate">{r.nom}</span>
                            <span className="block text-xs text-slate-500">Revendeur partenaire</span>
                          </span>
                        </span>
                        <span className="text-xs font-bold text-suguba-profond shrink-0">Voir ses offres</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-slate-600">
                Ouvrez un produit pour le commander sur Suguba : vous payez à la livraison.
              </p>
            )}
          </section>
        )}

        {!proprietaire && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-suguba-brand-dark shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">Vous aussi, gagnez en partageant</p>
              <p className="text-xs text-slate-500">Sans stock : Suguba livre, vous touchez une commission sur chaque vente.</p>
            </div>
          </div>
          <Link href="/rejoindre" className="h-11 px-5 rounded-full border border-slate-200 bg-white hover:bg-suguba-sauge text-suguba-profond text-sm font-semibold flex items-center justify-center">
            Devenir revendeur
          </Link>
        </div>
        )}
      </main>

      <Footer />
      {/* Sur sa vitrine, l'onglet « Boutique » du propriétaire reste allumé. */}
      <BottomNav actif={proprietaire ? PORTE_MA_BOUTIQUE : undefined} />
    </div>
  );
}
