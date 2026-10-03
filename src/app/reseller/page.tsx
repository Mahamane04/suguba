'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProductImage from '@/components/common/ProductImage';
import OrdersSyncNotice from '@/components/common/OrdersSyncNotice';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CarteAccesReseau from '@/components/reseau/CarteAccesReseau';
import SectionSponsorises from '@/components/reseau/SectionSponsorises';
import { Store as StoreIcone, Target as TargetIcone, Share2 as Share2Icone, UserPlus as UserPlusIcone, Users as UsersIcone, ShieldCheck as ShieldCheckIcone, Palette as PaletteIcone, CalendarDays as CalendarIcone, Factory as FactoryIcone, Tag as TagIcone, MessageCircleQuestion as QuestionIcone } from 'lucide-react';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import Button from '@/components/ui/Button';
import { partagerProduit } from '@/lib/partage';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { Product } from '@/types';
import { Wallet, ShoppingBag, Copy, Check, Plus, ChevronRight, Store, Calculator, Sparkles, QrCode, ShieldCheck, ClipboardList } from 'lucide-react';
import { formatF, formatNombre, FORMAT_DATE, formatDate } from '@/lib/montant';
import { statutVente } from '@/lib/libelles-vente';
import { StatusPill } from '@/components/ui/Surface';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { initiale } from '@/lib/initiale';
import { PORTE_MA_BOUTIQUE, sansPrechargement } from '@/lib/reseau/porte-boutique';
import ListeEtapes from '@/components/reseau/ListeEtapes';
import { progressionBoutique, type EtapeBoutique } from '@/lib/reseau/etapes-boutique';

// « Partager ma boutique » (lot 4 du chantier boutique, 2026-10-03) : feuille
// chargée à la demande, au premier « Partager » (elle embarque le QR).
const PartageBoutique = dynamic(() => import('@/components/shop/proprietaire/PartageBoutique'), { ssr: false });

/**
 * Tableau de bord revendeur — converti au design system (2026-09-10).
 *
 * Retirés au passage, parce qu'ils promettaient de l'argent que rien ne verse :
 *  - « Parrainage (+1000 F) » : /reseller/referrals annonçait une prime par vente
 *    de filleul, sans aucune table, route ni ligne de commission derrière — et
 *    listait un « réseau de filleuls » entièrement inventé (noms, téléphones) ;
 *  - « Défis & Primes » : /reseller/challenges affichait des récompenses de 5 000
 *    à 25 000 F écrites en dur, qu'aucun mécanisme ne paie ;
 *  - « Académie » : ses scripts faisaient dire au revendeur « 25 000 à 100 000 F
 *    par semaine » et « 3 000 à 7 000 F par article », chiffres que la commission
 *    calculée par produit (src/lib/pricing.ts) ne garantit pas.
 * Ces 3 pages ont été SUPPRIMÉES le 2026-09-11 (pas seulement masquées) : les
 * garder en ligne, même sans lien depuis ici, laissait n'importe qui tomber sur
 * des données de personnes fictives présentées comme réelles. À reconstruire
 * uniquement le jour où un vrai mécanisme (table, calcul, paiement) existe.
 *
 * Corrigés : l'objectif de palier (10 puis 30 ventes, comme
 * palierDepuisVentes dans src/lib/commissions.ts — la page visait 100 en VIP),
 * la frise « J+14 → J+7 → J+3 » qui annonçait à tout le monde un « paiement
 * VIP », et la mention de Wave, que SasPay ne couvre pas au Mali.
 */

const PALIERS = {
  new: { nom: 'Nouveau revendeur', jours: 14, prochain: 10, suivant: 'Revendeur vérifié' },
  verified: { nom: 'Revendeur vérifié', jours: 7, prochain: 30, suivant: 'VIP' },
  vip: { nom: 'VIP', jours: 3, prochain: null, suivant: null },
} as const;

type Palier = keyof typeof PALIERS;

/** Aperçu de la boutique renvoyé par /api/reseller/me?avec=boutique (lot 1 du chantier boutique). */
interface ApercuBoutique {
  slug: string; nom: string; logo: string | null; couverture: string | null;
  /** `nom` est une enseigne choisie (lot 4) ; absent d'une réponse plus ancienne. */
  enseigne?: boolean;
  /** Articles que la vitrine affiche (approuvés et partageables), pas toutes les lignes choisies. */
  articles: number | null; abonnes: number; statut: string;
  /** « Ma boutique est prête à X % » (lot 2, 2026-10-03). Absent d'une réponse plus ancienne. */
  etapes?: EtapeBoutique[];
}

export default function ResellerDashboardPage() {
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  // Tant que /api/reseller/me n'a pas répondu, pas de « 0 F » : un revendeur
  // qui voit son solde à zéro une seconde croit avoir perdu ses gains.
  const [charge, setCharge] = useState(false);
  const [rechargerProfil, setRechargerProfil] = useState(0);

  const currentUser = state.currentUser;

  // Fiche revendeur RÉELLE (voir /api/reseller/me) : code de parrainage,
  // palier, soldes et ventes, tous calculés côté serveur.
  const [moi, setMoi] = useState<{
    referralCode: string | null; tier: string; successfulOrdersCount: number;
    availableBalance: number; pendingBalance: number; totalEarned: number;
    commissionsEnAttente?: { montant: number; debloquagePrevu: string | null }[];
    onboardingDone?: boolean;
  } | null>(null);
  // Carte « Ma boutique » (2026-10-03) : lue dans la même requête que le solde.
  const [boutique, setBoutique] = useState<ApercuBoutique | null>(null);

  useEffect(() => {
    let annule = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setCharge(false); setMoi(null);
    fetch('/api/reseller/me?avec=boutique', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { reseller: null }))
      .then((json) => { if (!annule) { setMoi(json.reseller || null); setBoutique(json.boutique || null); } })
      .catch(() => {})
      .finally(() => { clearTimeout(timeout); if (!annule) setCharge(true); });
    return () => { annule = true; clearTimeout(timeout); controller.abort(); };
  }, [rechargerProfil, currentUser.id]);

  const referralCode = moi?.referralCode || null;
  const palierCle: Palier = (moi?.tier && moi.tier in PALIERS ? moi.tier : 'new') as Palier;
  const palier = PALIERS[palierCle];
  const availableBalance = moi?.availableBalance ?? 0;
  const pendingBalance = moi?.pendingBalance ?? 0;
  const totalEarned = moi?.totalEarned ?? 0;

  // /api/orders/feed ne renvoie au revendeur que SES propres ventes.
  const myOrders = state.orders;
  // Prix > 0 : un produit sans prix n'est pas en vente (voir src/app/page.tsx).
  // Commission > 0 comme au catalogue : « Vous gagnez 0 F » n'a aucun sens ici.
  const approvedProducts = state.products.filter(p => p.status === 'approved' && p.publicPrice > 0 && p.resellerCommission > 0);

  const montant = (n: number) => charge && !moi ? '—' : charge
    ? <>{formatNombre(n)} <span className="text-xs font-bold text-slate-600">F</span></>
    : <span className="inline-block h-6 w-20 rounded-lg bg-slate-200 animate-pulse align-middle" role="status" aria-label="Chargement" />;

  const ventesLivrees = moi?.successfulOrdersCount ?? myOrders.filter(o => o.status === 'delivered').length;
  // Prochain déblocage : la plus proche date future, et ce qui se débloque ce jour-là.
  const prochainDeblocage = (() => {
    const futurs = (moi?.commissionsEnAttente || [])
      .map((c) => ({ montant: Number(c.montant) || 0, t: Date.parse(c.debloquagePrevu || '') }))
      .filter((c) => Number.isFinite(c.t) && c.t > Date.now());
    if (!futurs.length) return null;
    const t = Math.min(...futurs.map((c) => c.t));
    const jour = new Date(t).toDateString();
    return { date: new Date(t).toISOString(), montant: futurs.filter((c) => new Date(c.t).toDateString() === jour).reduce((x, c) => x + c.montant, 0) };
  })();
  const progression = palier.prochain ? Math.min(100, Math.round((ventesLivrees / palier.prochain) * 100)) : 100;
  const restantes = palier.prochain ? Math.max(0, palier.prochain - ventesLivrees) : 0;

  const handleCopyRefCode = () => {
    if (!referralCode || typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(referralCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const prenom = currentUser?.fullName?.split(' ')[0] || '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />
      <OrdersSyncNotice />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        {/* REV-13 (audit UI/UX du 2026-10-02) : le démarrage était administratif
            (8 étapes de profil) et ne menait jamais à une vente. */}
        {moi && ventesLivrees === 0 && (
          <ListeDemarrage etapes={[
            { libelle: 'Compléter mon profil', fait: Boolean(moi.onboardingDone), href: '/reseller/demarrer' },
            // Une boutique sans articles montre le catalogue Suguba à vos clients (2026-10-03).
            { libelle: 'Choisir mes articles', fait: (boutique?.articles ?? 0) > 0, href: '/reseller/catalog' },
            { libelle: 'Partager un produit et recevoir une commande', fait: myOrders.length > 0, href: '/reseller/catalog' },
            { libelle: 'Première vente livrée', fait: ventesLivrees > 0, href: '/reseller/orders' },
          ]} />
        )}
        {charge && !moi && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2"><p>Votre solde et votre palier sont indisponibles. Aucun montant n’est confirmé.</p><Button variant="ghost" onClick={() => setRechargerProfil(v => v + 1)}>Réessayer le solde et le profil</Button></div>}


        {/* 1. Accueil + solde retirable : ce que le revendeur vient voir en premier */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{moi ? palier.nom : 'Palier non confirmé'}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Bonjour{prenom ? `, ${prenom}` : ''} 👋
            </h1>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 block">Mon code revendeur</span>
              <button
                onClick={handleCopyRefCode}
                disabled={!referralCode}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-60"
              >
                <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                  {referralCode || '—'}
                </span>
                {copiedRef
                  ? <Check className="w-4 h-4 text-suguba-brand-dark" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
              <p className="text-sm text-slate-600">
                {copiedRef ? 'Code copié.' : 'Il est déjà inclus dans chaque lien que vous partagez.'}
              </p>
            </div>
          </div>

          {/* REV-02 / REV-04 (audit UI/UX du 2026-10-02) : l'argent en un seul bloc et
              en trois mots, au lieu d'un bouton « Retirer mes gains » à 0 F suivi de trois
              tuiles qui répétaient les mêmes sommes. */}
          <div className="rounded-2xl bg-suguba-profond text-white p-4 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm text-white/80">Retirable maintenant</p>
              <p className="text-3xl font-bold tabular-nums text-suguba-citron">
                {charge && !moi ? '—' : charge
                  ? <>{formatNombre(availableBalance)} <span className="text-sm font-bold">F</span></>
                  : <span className="inline-block h-8 w-32 rounded-lg bg-white/20 animate-pulse align-middle" role="status" aria-label="Chargement du solde" />}
              </p>
              {moi && (
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between gap-3"><dt className="text-white/80">En attente</dt><dd className="font-semibold tabular-nums">{formatF(pendingBalance)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/80">Déjà versé</dt><dd className="font-semibold tabular-nums">{formatF(totalEarned)}</dd></div>
                </dl>
              )}
              {prochainDeblocage && (
                <p className="text-sm text-white/80">Prochain déblocage : <strong className="text-white">{formatF(prochainDeblocage.montant)}</strong> le {formatDate(prochainDeblocage.date, 'jour')}</p>
              )}
            </div>
            <Button href="/reseller/payouts" variant="citron" fullWidth>
              <Wallet className="w-4 h-4" />
              <span>Voir mes gains</span>
            </Button>
          </div>
        </div>

        {/* 2. Ma boutique (lot 1 du chantier boutique, 2026-10-03) : la vitrine elle-même,
            en 1 toucher, à la place du raccourci qui ouvrait les réglages. */}
        <CarteMaBoutique boutique={boutique} charge={charge} />

        {/* 3. Palier : ce qui change concrètement, c'est le délai de déblocage */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                {moi ? `Vos commissions sont débloquées ${palier.jours} jours après la livraison` : 'Votre palier sera affiché après chargement du profil'}
              </h2>
              <p className="text-sm text-slate-600">
                {!moi ? 'Réessayez le chargement pour consulter votre progression.' : palier.prochain
                  ? `Encore ${restantes} vente${restantes > 1 ? 's' : ''} livrée${restantes > 1 ? 's' : ''} pour passer « ${palier.suivant} » et raccourcir ce délai.`
                  : 'Vous êtes au palier le plus rapide.'}
              </p>
            </div>
            {moi && palier.prochain && (
              <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full self-start sm:self-auto shrink-0">
                {state.ordersSync === 'ready' || moi ? ventesLivrees : '—'} / {palier.prochain}
              </span>
            )}
          </div>
          <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-suguba-brand transition-all duration-500" style={{ width: `${moi ? progression : 0}%` }} />
          </div>
          <p className="text-sm text-slate-600">
            14 jours pour un nouveau revendeur, 7 jours dès 10 ventes livrées, 3 jours dès 30. Ce délai protège contre les retours.
          </p>
        </div>

        {/* 4. Actions */}
        {/* REV-04 : « Créer une commande » menait au même endroit que « Catalogue »
            (la vente se crée depuis le catalogue, bouton « Vente »). « Ma boutique »
            est devenue la carte ci-dessus (2026-10-03) : 2 raccourcis. */}
        <div className="grid grid-cols-2 gap-3">
          <Raccourci empile href="/reseller/catalog" icone={<ShoppingBag className="w-5 h-5" />} titre="Catalogue" sousTitre="Choisir quoi partager" />
          <Raccourci empile href="/reseller/orders" icone={<ClipboardList className="w-5 h-5" />} titre="Mes ventes" sousTitre="Suivre les livraisons" />
        </div>

        {/* 5. Produits à partager */}
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">À partager aujourd&apos;hui</h2>
              <p className="text-sm text-slate-600">Sur votre statut WhatsApp ou directement à un client.</p>
            </div>
            <Link href="/reseller/catalog" className="text-sm font-semibold text-suguba-brand-dark min-h-10 inline-flex items-center hover:underline flex items-center gap-0.5 shrink-0">
              <span>Voir tout</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {approvedProducts.length === 0 && !catalogueCharge ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true" aria-label="Chargement des produits">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-white rounded-3xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : approvedProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-600">
              Le catalogue est en cours de remplissage. Les produits apparaîtront ici dès leur validation.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {approvedProducts.slice(0, 4).map((product) => (
                <div key={product.id} className="bg-white rounded-3xl p-3.5 border border-slate-200 flex flex-col justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                      <ProductImage src={product.images[0]} alt={product.name} fill sizes="64px" className="object-cover" compact />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{product.name}</h3>
                      <p className="text-sm font-bold text-slate-900">
                        {formatNombre(product.publicPrice)} <span className="text-xs font-bold text-slate-600">F</span>
                      </p>
                      <span className="inline-block px-2 py-0.5 bg-suguba-brand/10 text-suguba-brand-dark text-xs font-bold rounded-full">
                        Vous gagnez {formatF(product.resellerCommission)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Partage en un clic : photo + texte + lien avec le code
                        du revendeur (voir src/lib/partage.ts). */}
                    <BoutonPartageWhatsApp
                      size="sm"
                      className="flex-1"
                      libelle="Partager"
                      aria-label={`Partager ${product.name} sur WhatsApp`}
                      onClick={() => partagerProduit(
                        { nom: product.name, prix: product.publicPrice, slug: product.slug, images: product.images },
                        referralCode,
                      )}
                    />
                    <Button onClick={() => setSelectedProductForOrder(product)} variant="ghost" size="sm" aria-label="Créer une commande pour ce produit">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Dernières ventes — en liste, lisible sur téléphone (l'ancien tableau à 7 colonnes défilait) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">Dernières ventes</h2>
            <Link href="/reseller/orders" className="text-sm font-semibold text-suguba-brand-dark min-h-10 inline-flex items-center hover:underline">Voir tout</Link>
          </div>

          {myOrders.length === 0 ? (
            <p className="text-center py-6 text-slate-600 text-sm">
              {state.ordersSync === 'ready' ? 'Aucune vente pour le moment. Partagez votre premier produit !' : 'La liste des ventes n’est pas encore confirmée.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myOrders.slice(0, 4).map((order) => (
                <div key={order.id} className="py-3 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={order.productImage} alt={order.productName} fill sizes="40px" className="object-cover" compact />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{order.productName}</p>
                    <p className="text-sm text-slate-600">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', FORMAT_DATE.jour)}
                      {' • '}{formatF(order.totalAmount)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-bold text-suguba-brand-dark tabular-nums">+{formatF(order.resellerCommission)}</p>
                    <StatutVente status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Outils de vente */}
        <div className="space-y-2.5">
          {/* « Outils » a quitté la barre du bas pour « Boutique » (2026-10-03) : la page reste à 1 toucher d'ici. */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-sm text-slate-900">Outils de vente</h2>
            <Link href="/reseller/outils" className="text-sm font-semibold text-suguba-brand-dark min-h-10 inline-flex items-center gap-0.5 hover:underline shrink-0">
              <span>Tous mes outils</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Raccourci href="/reseller/createur" icone={<Sparkles className="w-5 h-5" />} titre="Créer un visuel" sousTitre="Produit ou boutique" />
            <Raccourci href="/reseller/badge" icone={<QrCode className="w-5 h-5" />} titre="Ma carte & QR" sousTitre="Votre carte revendeur" />
            <Raccourci href="/reseller/calculator" icone={<Calculator className="w-5 h-5" />} titre="Simulateur" sousTitre="Estimer vos gains" />
          </div>
        </div>


        <SectionSponsorises />

        <CarteAccesReseau
          titre="Mon réseau"
          entrees={[
            { libelle: 'Ma boutique', href: PORTE_MA_BOUTIQUE, icone: StoreIcone, aide: 'Voir, gérer et partager ma vitrine' },
            { libelle: 'Mes prix', href: '/reseller/prix', icone: TagIcone, aide: 'Articles au prix de gros : fixez votre prix' },
            { libelle: 'Mes boutiques', href: '/compte/boutiques', icone: StoreIcone, aide: 'Plusieurs boutiques avec la formule Pro' },
            { libelle: 'Fournisseurs', href: '/reseller/fournisseurs', icone: FactoryIcone, aide: 'Suivre et découvrir les fournisseurs' },
            { libelle: 'Mes questions', href: '/reseller/questions', icone: QuestionIcone, aide: 'Vos questions aux fournisseurs sur leurs offres' },
            { libelle: 'Missions', href: '/reseller/missions', icone: TargetIcone, aide: 'Des objectifs, une récompense' },
            { libelle: 'Créer un visuel', href: '/reseller/createur', icone: PaletteIcone, aide: 'Statut WhatsApp, publication, affiche avec QR' },
            { libelle: 'Mon calendrier', href: '/reseller/calendrier', icone: CalendarIcone, aide: 'Planifier vos publications' },
            { libelle: 'Mes partages', href: '/reseller/partages', icone: Share2Icone, aide: 'Ce que chaque lien a rapporté' },
            { libelle: 'Mes parrainages', href: '/reseller/parrainages', icone: UserPlusIcone, aide: 'Invitez clients et revendeurs' },
            { libelle: 'Mes clients', href: '/reseller/clients', icone: UsersIcone, aide: 'Les personnes que vous avez amenées' },
            { libelle: 'Mon profil vérifié', href: '/reseller/verification', icone: ShieldCheckIcone, aide: 'Rassurez vos clients' },
          ]}
        />
      </main>

      {selectedProductForOrder && (
        <CreateOrderModal
          product={selectedProductForOrder}
          isOpen={!!selectedProductForOrder}
          onClose={() => setSelectedProductForOrder(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}


function Raccourci({ href, onClick, disabled, icone, titre, sousTitre, empile }: {
  href?: string; onClick?: () => void; disabled?: boolean;
  icone: React.ReactNode; titre: string; sousTitre: string;
  /** Grille à 2 colonnes sur mobile : icône au-dessus du texte. */
  empile?: boolean;
}) {
  const contenu = (
    <>
      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-sm text-slate-900 ${empile ? 'sm:truncate' : 'truncate'}`}>{titre}</p>
        <p className={`text-xs text-slate-600 ${empile ? 'line-clamp-2 sm:truncate' : 'truncate'}`}>{sousTitre}</p>
      </div>
      <ChevronRight className={`${empile ? 'hidden sm:block ' : ''}w-4 h-4 text-slate-300 shrink-0`} />
    </>
  );
  // REV-06 (audit UI/UX du 2026-10-02) : sur mobile, l'icône passe au-dessus
  // du texte ; en ligne, il ne restait qu'environ 65 px (« Catalo… », « Mes v… »).
  const classes =
    'bg-white p-3.5 rounded-3xl border border-slate-200 hover:border-slate-300 flex ' +
    (empile ? 'flex-col items-start sm:flex-row sm:items-center gap-2 sm:gap-3 ' : 'items-center gap-3 ') +
    'text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  if (href) return <Link href={href} className={classes}>{contenu}</Link>;
  return <button onClick={onClick} disabled={disabled} className={classes}>{contenu}</button>;
}

/**
 * Carte « Ma boutique » (lot 1 du chantier boutique, 2026-10-03) : couverture,
 * logo, nom, « N articles · N abonnés », état. Action principale « Voir ma
 * boutique » (porte unique, même onglet) ; secondaire « Partager ». Boutique
 * illisible ou pas encore créée : la carte garde son bouton, jamais d'erreur.
 */
function CarteMaBoutique({ boutique, charge }: { boutique: ApercuBoutique | null; charge: boolean }) {
  const nom = boutique?.nom || 'Ma boutique';
  // Pas de partage d'une boutique masquée : le client tomberait sur une page introuvable.
  const partageable = Boolean(boutique && boutique.statut === 'active');
  // Lot 4 (2026-10-03) : « Partager » ouvre la feuille « Partager ma boutique »
  // (toute la boutique, coups de cœur ou un rayon ; lien suivi réutilisé).
  const [partage, setPartage] = useState(false);
  const [feuilleChargee, setFeuilleChargee] = useState(false);
  const pluriel = (n: number) => (n > 1 ? 's' : '');
  // « Prête à X % » (lot 2, 2026-10-03) : masquée à 100 % ; la prochaine étape
  // ouvre directement son outil (panneau de la vitrine ou catalogue).
  const etapes = boutique?.etapes || [];
  const prete = etapes.length ? progressionBoutique(etapes) : null;
  const prochaine = etapes.find((e) => !e.fait);
  return (
    <section aria-labelledby="ma-boutique-titre" className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <div className="relative h-16 bg-suguba-profond" aria-hidden="true">
        {boutique?.couverture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={boutique.couverture} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-start gap-3">
          {boutique?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boutique.logo} alt="" className="-mt-7 w-14 h-14 shrink-0 rounded-2xl object-cover bg-white ring-4 ring-white" />
          ) : (
            <span aria-hidden="true" className="-mt-7 w-14 h-14 shrink-0 rounded-2xl bg-suguba-menthe text-suguba-profond ring-4 ring-white flex items-center justify-center text-xl font-bold">
              {initiale(nom)}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-2 space-y-1">
            <h2 id="ma-boutique-titre" className="text-base font-bold text-slate-900 truncate">{nom}</h2>
            {!charge ? (
              <span className="block h-4 w-32 rounded-lg bg-slate-200 animate-pulse" role="status" aria-label="Chargement de votre boutique" />
            ) : boutique ? (
              <p className="text-sm text-slate-600">
                {/* Compte illisible : « — articles », jamais un 0 inventé. */}
                {boutique.articles ?? '—'} article{boutique.articles == null ? 's' : pluriel(boutique.articles)} · {boutique.abonnes} abonné{pluriel(boutique.abonnes)}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Votre vitrine à votre nom, à partager partout.</p>
            )}
            {boutique && boutique.statut !== 'active' && <StatusPill ton="attente">Masquée par Suguba</StatusPill>}
          </div>
        </div>
        {prete && prete.pourcentage < 100 && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="font-semibold text-slate-900">Ma boutique est prête à <span className="tabular-nums">{prete.pourcentage} %</span></p>
              <span className="text-slate-600 tabular-nums shrink-0">{prete.faites} sur {prete.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-suguba-brand" style={{ width: `${prete.pourcentage}%` }} />
            </div>
            {prochaine && (
              <Link href={prochaine.href} prefetch={sansPrechargement(prochaine.href) ? false : undefined}
                className="inline-flex items-center gap-1 min-h-10 text-sm font-semibold text-suguba-brand-dark hover:underline">
                {prochaine.libelle}<ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button href={PORTE_MA_BOUTIQUE} className="flex-1">
            <Store className="w-4 h-4" />
            <span>Voir ma boutique</span>
          </Button>
          {partageable && (
            <BoutonPartageWhatsApp
              type="button"
              libelle="Partager"
              aria-label="Partager ma boutique sur WhatsApp"
              aria-haspopup="dialog"
              onPointerDown={() => setFeuilleChargee(true)}
              onClick={() => { setFeuilleChargee(true); setPartage(true); }}
            />
          )}
        </div>
      </div>
      {boutique && partageable && feuilleChargee && (
        <PartageBoutique
          ouvert={partage}
          onFermer={() => setPartage(false)}
          boutique={{ nom: boutique.nom, enseigne: Boolean(boutique.enseigne), slug: boutique.slug, statut: boutique.statut }}
        />
      )}
    </section>
  );
}

// Même vocabulaire que « Mes ventes » (REV-02, audit UI/UX du 2026-10-02) :
// l'accueil disait « En route » / « En attente » quand Ventes disait autre chose.
function StatutVente({ status }: { status: string }) {
  const s = statutVente(status);
  return <StatusPill ton={s.ton}>{s.libelle}</StatusPill>;
}

/**
 * Liste de démarrage (REV-13) : étapes vers la première vente, cochées au fil de
 * l'eau. Le rendu vit dans ListeEtapes depuis le lot 2 du chantier boutique
 * (2026-10-03), partagé avec « Ma boutique est prête à X % » de la vitrine.
 */
function ListeDemarrage({ etapes }: { etapes: { libelle: string; fait: boolean; href: string }[] }) {
  return <ListeEtapes id="demarrage-titre" titre="Vers votre première vente" etapes={etapes} />;
}
