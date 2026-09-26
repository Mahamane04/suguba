'use client';

import React, { useState, use, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Carrousel from '@/components/product/Carrousel';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import Button from '@/components/ui/Button';
import BoutonAjoutPanier from '@/components/panier/BoutonAjoutPanier';
import SelecteurVariantes from '@/components/product/SelecteurVariantes';
import { partagerProduit, prechargerImage, prechargerLienPartage, useCodeRevendeur } from '@/lib/partage';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { useOrderQuote } from '@/lib/useOrderQuote';
import {
  ShieldCheck, Truck, Clock, Minus, Plus, CheckCircle2, ArrowRight, ArrowLeft, Handshake, Store,
} from 'lucide-react';
import { ETAPES, libelleTypeOffre, normaliserTypeOffre } from '@/lib/offre';
import { normaliserCodeRevendeur, revendeurAncre } from '@/lib/ancrage-revendeur';
import OffresRevendeurs, { type OffreRevendeurVue } from '@/components/product/OffresRevendeurs';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const state = useSugubaStore();
  // Un revendeur connecté partage avec SON code ; sinon le lien garde celui
  // de la visite en cours.
  const monCode = useCodeRevendeur();

  // Code de l'adresse, sinon revendeur d'origine gardé sur l'appareil (lot B) :
  // passer par l'accueil ou la boutique du fournisseur ne le fait plus perdre.
  const [refAncre, setRefAncre] = useState<string | null>(null);
  useEffect(() => { setRefAncre(revendeurAncre()); }, []);
  // refUrl : l'offre choisie par le client (lien du revendeur) — seule
  // transmise telle quelle. refAncre : simple provenance, que le serveur
  // n'applique qu'après le revendeur déjà rattaché au téléphone du client.
  const refUrl = normaliserCodeRevendeur(searchParams.get('ref'));
  const refCode = refUrl || refAncre;
  const promoParam = searchParams.get('promo');
  // Corrige BUG-009 : un slug inexistant ne retombe plus sur un autre produit.
  const product = state.products.find(p => p.slug === resolvedParams.slug);
  const catalogueCharge = useCatalogueCharge();

  const [quantity, setQuantity] = useState(1);

  // Bloc « nom · prix · Commander » sous la photo. Dès qu'il passe sous
  // l'en-tête en défilant, le prix et « Commander » apparaissent dans la barre
  // « Retour » collée en haut — jamais les deux à la fois.
  const blocAchatRef = useRef<HTMLDivElement>(null);
  const [blocAchatVisible, setBlocAchatVisible] = useState(true);
  useEffect(() => {
    const el = blocAchatRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entree]) => setBlocAchatVisible(entree.isIntersecting),
      { rootMargin: '-108px 0px 0px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [product?.id]);

  // La commande se fait sur sa propre page (/p/<slug>/commander) : préchargée
  // dès l'arrivée sur la fiche pour que « Commander » s'ouvre sans attente.
  useEffect(() => {
    if (product?.slug) router.prefetch(`/p/${product.slug}/commander`);
  }, [product?.slug, router]);

  // « Recommandé par … » : le vrai revendeur derrière le code du lien.
  const [nomRecommandeur, setNomRecommandeur] = useState<string | null>(null);
  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/shop/revendeur?code=${encodeURIComponent(refCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.nom && setNomRecommandeur(j.nom))
      .catch(() => {});
  }, [refCode]);

  const [offresGros, setOffresGros] = useState<{ offres: OffreRevendeurVue[]; achatDirect: boolean } | null>(null);
  useEffect(() => {
    if (product?.modePrix !== 'gros') return;
    fetch(`/api/products/offres?slug=${encodeURIComponent(resolvedParams.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setOffresGros({ offres: j.offres || [], achatDirect: j.achatDirect !== false }))
      .catch(() => {});
  }, [product?.modePrix, resolvedParams.slug]);

  // Livraisons réussies de ce produit : chiffre réel, affiché seulement s'il
  // est supérieur à zéro (voir /api/products/livraisons).
  const [livraisons, setLivraisons] = useState(0);
  useEffect(() => {
    fetch(`/api/products/livraisons?slug=${encodeURIComponent(resolvedParams.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setLivraisons(Number(j.livraisons) || 0))
      .catch(() => {});
  }, [resolvedParams.slug]);

  // Prix unitaire fait foi côté serveur (il peut être relevé au plancher) :
  // le même que celui que la page de commande affichera.
  const { devis } = useOrderQuote(product ? {
    productId: product.id, quantity: 1, city: 'Bamako', resellerCode: refCode || undefined,
  } : null);

  if (!product && !catalogueCharge) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full" aria-busy="true" aria-label="Chargement du produit">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            <div className="aspect-square rounded-3xl bg-slate-200" />
            <div className="space-y-3">
              <div className="h-6 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-8 w-1/3 rounded-lg bg-slate-200" />
              <div className="h-40 rounded-3xl bg-slate-200" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold text-slate-900">Produit introuvable</h1>
            <p className="text-sm text-slate-500">
              Ce lien ne correspond à aucun produit disponible sur Suguba — il a peut-être expiré ou été mal recopié.
            </p>
            <Button href="/" size="lg" fullWidth>Voir le catalogue Suguba</Button>
          </div>
        </main>
      </div>
    );
  }

  // Produit connu du téléphone mais PAS en vente (en attente de prix, refusé…) :
  // ni commande ni partage.
  if (!(product.status === 'approved' && product.publicPrice > 0)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Pas encore en vente</h1>
            <p className="text-sm text-slate-500">
              « {product.name} » attend son prix de vente. Tant qu&apos;il n&apos;est pas publié, il ne peut être ni commandé ni partagé.
            </p>
            <Button href="/" variant="secondary" size="lg" fullWidth>Voir le catalogue</Button>
          </div>
        </main>
      </div>
    );
  }

  const outOfStock = product.stockQuantity <= 0;
  // « Service » / « Installation incluse » (2026-09-26)
  const typeOffreLibelle = libelleTypeOffre(normaliserTypeOffre(product.typeOffre));
  const surDevis = product.modeCommande === 'devis';
  // Article au prix de gros consulté sans revendeur (lot C) : dès qu'un
  // revendeur le propose, le client choisit son offre au lieu d'acheter au
  // prix conseillé (le serveur refuse aussi l'achat direct).
  const viaRevendeurs = product.modePrix === 'gros' && !refCode && Boolean(offresGros && !offresGros.achatDirect && offresGros.offres.length);
  const libelleAction = outOfStock ? 'Rupture de stock' : surDevis ? 'Demander un devis' : viaRevendeurs ? 'Voir les offres' : 'Commander';
  const unitPrice = devis?.prixUnitaire ?? product.publicPrice;
  // Via les revendeurs : le prix le plus bas de leurs offres, pas le prix conseillé.
  const prixAffiche = viaRevendeurs ? Math.min(...offresGros!.offres.map((o) => o.prix)) : unitPrice;
  const aPartirDe = surDevis || viaRevendeurs;

  const allerCommander = () => {
    if (outOfStock) return;
    if (viaRevendeurs) {
      document.getElementById(window.matchMedia('(min-width: 768px)').matches ? 'offres-revendeurs-bureau' : 'offres-revendeurs')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // Offre sur devis (lot 1b) : le client décrit son besoin au lieu de commander.
    if (surDevis) {
      router.push(`/p/${product.slug}/devis${refUrl ? `?ref=${encodeURIComponent(refUrl)}` : ''}`);
      return;
    }
    const parametres = new URLSearchParams();
    if (quantity > 1) parametres.set('q', String(quantity));
    // Seul le lien du revendeur suit dans l'adresse ; la provenance gardée sur
    // l'appareil est relue par la page de commande et par le serveur.
    if (refUrl) parametres.set('ref', refUrl);
    if (promoParam) parametres.set('promo', promoParam);
    const suite = parametres.toString();
    router.push(`/p/${product.slug}/commander${suite ? `?${suite}` : ''}`);
  };

  // `history.length` distingue une navigation interne d'un lien WhatsApp
  // ouvert dans un onglet neuf, où il n'y a rien vers quoi revenir.
  const revenirEnArriere = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 md:pb-16">
      <Header />

      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={revenirEnArriere}
            className="h-11 -ml-1 pl-1 pr-3 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900 active:text-slate-950 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div
            aria-hidden={blocAchatVisible}
            className={`md:hidden flex items-center gap-2.5 min-w-0 transition-all duration-200 ${
              blocAchatVisible ? 'opacity-0 translate-y-1 pointer-events-none' : 'opacity-100 translate-y-0'
            }`}
          >
            <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
              {aPartirDe ? 'dès ' : ''}{Math.round(prixAffiche).toLocaleString('fr-FR')} F
            </span>
            <button
              type="button"
              tabIndex={blocAchatVisible ? -1 : 0}
              onClick={allerCommander} disabled={outOfStock}
              className="h-8 px-3.5 rounded-full bg-suguba-profond hover:bg-suguba-profond-2 text-white text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
            >
              {outOfStock ? 'Indisponible' : 'Commander'}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {nomRecommandeur && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-suguba-profond text-white flex items-center justify-center font-bold text-xs">
                {nomRecommandeur.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Recommandé par {nomRecommandeur}
                </p>
                <p className="text-xs text-emerald-700">
                  Partenaire revendeur officiel Suguba
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              Code : {refCode}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="relative">
              <Carrousel
                images={product.images}
                alt={product.name}
                className="aspect-square rounded-3xl border border-slate-200"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                miniatures
              />
              <div className="absolute top-3 left-3 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold">
                  {product.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => partagerProduit(
                  { nom: product.name, prix: product.publicPrice, slug: product.slug, images: product.images },
                  monCode || refCode,
                )}
                onPointerDown={() => {
                  prechargerImage(product.images[0], product.slug);
                  if (monCode) prechargerLienPartage(product.slug);
                }}
                aria-label="Partager ce produit sur WhatsApp"
                className="absolute top-3 right-3 h-9 px-3 rounded-full bg-suguba-wa hover:bg-[#1fbf5b] text-suguba-profond text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-[0.97] transition-all"
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>

            {/* Téléphone : nom, prix et Commander juste sous la photo. */}
            <div ref={blocAchatRef} className="md:hidden space-y-2">
              {typeOffreLibelle && <span className="inline-flex px-2.5 py-0.5 rounded-full bg-suguba-citron text-suguba-profond text-xs font-bold">{typeOffreLibelle}</span>}
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{product.name}</h1>
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-bold text-suguba-brand whitespace-nowrap">
                  {aPartirDe && <span className="block text-xs font-bold text-slate-500">À partir de</span>}
                  {Math.round(prixAffiche).toLocaleString('fr-FR')} <span className="text-base">FCFA</span>
                </p>
                <Button type="button" onClick={allerCommander} disabled={outOfStock} className="shrink-0">
                  <span>{libelleAction}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <SelecteurVariantes slug={product.slug} />
              {viaRevendeurs && <OffresRevendeurs id="offres-revendeurs" slug={product.slug} offres={offresGros!.offres} />}
              {!surDevis && !viaRevendeurs && <BoutonAjoutPanier disabled={outOfStock} productId={product.id} quantite={1} />}
              <p className="text-xs text-slate-500">
                Sans créer de compte · Payez à la livraison
              </p>
            </div>

            {/* Réassurance : uniquement des engagements réels et vérifiables. */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { Icone: CheckCircle2, titre: 'Payez à la livraison', detail: 'Rien à payer avant' },
                { Icone: ShieldCheck, titre: 'Code secret', detail: 'Remis au livreur après vérification' },
                // Qui remet l'offre (2026-09-26)
                product.modeRemise === 'fournisseur'
                  ? { Icone: Handshake, titre: 'Remis par le vendeur', detail: product.fraisRemise ? `Frais : ${fcfa(product.fraisRemise)}` : 'Sans livreur' }
                  : product.modeRemise === 'retrait'
                    ? { Icone: Store, titre: 'Chez le vendeur', detail: 'Adresse après confirmation' }
                    : { Icone: Truck, titre: 'Livré par Suguba', detail: 'Bamako et régions' },
              ].map(({ Icone, titre, detail }) => (
                <div key={titre} className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-800 space-y-1">
                  <Icone className="w-5 h-5 mx-auto text-suguba-brand-dark" />
                  <p className="font-bold text-xs leading-tight">{titre}</p>
                  <p className="text-xs text-slate-500 leading-tight">{detail}</p>
                </div>
              ))}
            </div>

            {livraisons > 0 && (
              <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-2xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-suguba-brand-dark shrink-0" />
                <span>
                  <strong>{livraisons}</strong> livraison{livraisons > 1 ? 's' : ''} réussie{livraisons > 1 ? 's' : ''} de ce produit
                </span>
              </p>
            )}

            <a
              href={`https://wa.me/22389460000?text=${encodeURIComponent(
                `Bonjour Suguba, j'ai une question sur « ${product.name} » : https://app.sugubaml.com/p/${product.slug}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              <span>Une question ? Écrivez-nous</span>
            </a>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2">
              <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Description du produit
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {product.offreInclus && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2">
                <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Ce qui est inclus</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.offreInclus}</p>
              </div>
            )}

            {/* Prestation à étapes (lot 1c) : le client sait d'avance comment ça se passe. */}
            {product.modeRemise && product.modeRemise !== 'livreur' && (product.etapes?.length || 0) > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
                <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Comment ça se passe</h2>
                <ol className="space-y-2">
                  {[...ETAPES.filter((e) => product.etapes!.includes(e.cle)).map((e) => ({ titre: e.libelle, detail: e.detail })),
                    { titre: 'Réception finale', detail: 'Vous présentez le QR de votre reçu une fois tout vérifié' }].map((e, i) => (
                    <li key={e.titre} className="flex gap-3">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-suguba-menthe text-suguba-profond text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-slate-700"><strong className="text-slate-900">{e.titre}</strong> · {e.detail}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-slate-500">Vous validez chaque étape depuis votre reçu Suguba, avec les photos du vendeur.</p>
              </div>
            )}
          </div>

          {/* Ordinateur : boîte d'achat collée à droite pendant le défilement. */}
          <div className="hidden md:block md:sticky md:top-28 bg-white rounded-3xl p-6 border border-slate-200 shadow-float space-y-5">
            <div className="space-y-1">
              {typeOffreLibelle && <span className="inline-flex px-2.5 py-0.5 rounded-full bg-suguba-citron text-suguba-profond text-xs font-bold">{typeOffreLibelle}</span>}
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{product.name}</h1>
              <p className="text-3xl font-bold text-suguba-brand-dark">{aPartirDe && <span className="block text-xs font-bold text-slate-500">À partir de</span>}{fcfa(prixAffiche)}</p>
            </div>

            <SelecteurVariantes slug={product.slug} />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Quantité</span>
              <div className="flex items-center rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Diminuer la quantité"
                  className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-slate-900" aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(50, product.stockQuantity, q + 1))}
                  disabled={quantity >= Math.min(50, product.stockQuantity)}
                  aria-label="Augmenter la quantité"
                  className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!viaRevendeurs && (
              <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-4">
                <span className="text-slate-600">Sous-total</span>
                <span className="font-bold text-slate-900">{fcfa(unitPrice * quantity)}</span>
              </div>
            )}

            {viaRevendeurs ? (
              <OffresRevendeurs id="offres-revendeurs-bureau" slug={product.slug} offres={offresGros!.offres} />
            ) : (
              <>
                <Button type="button" onClick={allerCommander} disabled={outOfStock} size="lg" fullWidth>
                  <span>{libelleAction}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                {!surDevis && <BoutonAjoutPanier disabled={outOfStock} productId={product.id} quantite={quantity} />}
              </>
            )}
            <p className="text-xs text-slate-500 text-center">
              {product.modeRemise && product.modeRemise !== 'livreur'
                ? 'Le vendeur vous contacte après la confirmation · Payez à la remise'
                : <>Livraison calculée à l&apos;étape suivante · Payez à la livraison</>}
            </p>
          </div>
        </div>

        {/* Les avis inventés ont été retirés le 2026-08-21 : à réintroduire
            uniquement branchés sur de vrais avis collectés après livraison. */}
      </main>

      <BottomNav />
    </div>
  );
}
