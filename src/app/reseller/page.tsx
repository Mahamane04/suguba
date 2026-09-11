'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { partagerProduit } from '@/lib/partage';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { Product } from '@/types';
import {
  Wallet, TrendingUp, ShoppingBag, Clock, Copy, Check, Plus, ChevronRight,
  Store, Calculator, Sparkles, QrCode, ShieldCheck, ClipboardList
} from 'lucide-react';

/**
 * Tableau de bord revendeur — converti au design system (2026-09-10).
 *
 * Retirés au passage, parce qu'ils promettaient de l'argent que rien ne verse :
 *  - « Parrainage (+1000 F) » : /reseller/referrals annonce une prime par vente
 *    de filleul, sans aucune table, route ni ligne de commission derrière ;
 *  - « Défis & Primes » : /reseller/challenges affiche des récompenses de 5 000
 *    à 25 000 F écrites en dur, qu'aucun mécanisme ne paie ;
 *  - « Académie » : ses scripts font dire au revendeur « 25 000 à 100 000 F par
 *    semaine » et « 3 000 à 7 000 F par article », chiffres que la commission
 *    calculée par produit (src/lib/pricing.ts) ne garantit pas.
 * Les pages existent encore mais ne sont plus proposées depuis ici.
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

export default function ResellerDashboardPage() {
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  // Tant que /api/reseller/me n'a pas répondu, pas de « 0 F » : un revendeur
  // qui voit son solde à zéro une seconde croit avoir perdu ses gains.
  const [charge, setCharge] = useState(false);

  const currentUser = state.currentUser;

  // Fiche revendeur RÉELLE (voir /api/reseller/me) : code de parrainage,
  // palier, soldes et ventes, tous calculés côté serveur.
  const [moi, setMoi] = useState<{
    referralCode: string | null; tier: string; successfulOrdersCount: number;
    availableBalance: number; pendingBalance: number; totalEarned: number;
  } | null>(null);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/me')
      .then((res) => (res.ok ? res.json() : { reseller: null }))
      .then((json) => { if (!annule) setMoi(json.reseller || null); })
      .catch(() => {})
      .finally(() => { if (!annule) setCharge(true); });
    return () => { annule = true; };
  }, []);

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

  const montant = (n: number) => charge
    ? <>{n.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">F</span></>
    : <span className="inline-block h-6 w-20 rounded-lg bg-slate-200 animate-pulse align-middle" aria-label="Chargement" />;

  const ventesLivrees = moi?.successfulOrdersCount ?? myOrders.filter(o => o.status === 'delivered').length;
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

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">

        {/* 1. Accueil + solde retirable : ce que le revendeur vient voir en premier */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{palier.nom}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Bonjour{prenom ? `, ${prenom}` : ''} 👋
            </h1>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Mon code revendeur</span>
              <button
                onClick={handleCopyRefCode}
                disabled={!referralCode}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-60"
              >
                <span className="font-mono text-base font-black text-slate-900 tracking-wider">
                  {referralCode || '—'}
                </span>
                {copiedRef
                  ? <Check className="w-4 h-4 text-suguba-brand" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
              <p className="text-[11px] text-slate-400">
                {copiedRef ? 'Code copié.' : 'Il est déjà inclus dans chaque lien que vous partagez.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Disponible au retrait</p>
              <p className="text-3xl font-black text-slate-900">
                {charge
                  ? <>{availableBalance.toLocaleString('fr-FR')} <span className="text-sm font-bold text-slate-500">F</span></>
                  : <span className="inline-block h-8 w-32 rounded-lg bg-slate-200 animate-pulse align-middle" aria-label="Chargement du solde" />}
              </p>
            </div>
            <Button href="/reseller/payouts" variant="primary" fullWidth>
              <Wallet className="w-4 h-4" />
              <span>Retirer mes gains</span>
            </Button>
          </div>
        </div>

        {/* 2. Indicateurs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Indicateur icone={<Clock className="w-4 h-4" />} titre="En attente" note={`Débloqué ${palier.jours} jours après livraison`}>
            {montant(pendingBalance)}
          </Indicateur>
          <Indicateur icone={<TrendingUp className="w-4 h-4" />} titre="Total gagné" note="Depuis votre inscription">
            {montant(totalEarned)}
          </Indicateur>
          <Indicateur icone={<ShoppingBag className="w-4 h-4" />} titre="Ventes livrées" note={`${myOrders.length} commande${myOrders.length > 1 ? 's' : ''} au total`}>
            {ventesLivrees}
          </Indicateur>
        </div>

        {/* 3. Palier : ce qui change concrètement, c'est le délai de déblocage */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-black text-sm text-slate-900">
                Vos commissions sont débloquées {palier.jours} jours après la livraison
              </h2>
              <p className="text-xs text-slate-500">
                {palier.prochain
                  ? `Encore ${restantes} vente${restantes > 1 ? 's' : ''} livrée${restantes > 1 ? 's' : ''} pour passer « ${palier.suivant} » et raccourcir ce délai.`
                  : 'Vous êtes au palier le plus rapide.'}
              </p>
            </div>
            {palier.prochain && (
              <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full self-start sm:self-auto shrink-0">
                {ventesLivrees} / {palier.prochain}
              </span>
            )}
          </div>
          <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-suguba-brand transition-all duration-500" style={{ width: `${progression}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">
            14 jours pour un nouveau revendeur, 7 jours dès 10 ventes livrées, 3 jours dès 30. Ce délai protège contre les retours.
          </p>
        </div>

        {/* 4. Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Raccourci href="/reseller/catalog" icone={<ShoppingBag className="w-5 h-5" />} titre="Catalogue" sousTitre="Choisir quoi partager" />
          {/* Ouvrait la commande sur le PREMIER produit du catalogue, sans
              choix possible. On passe par le catalogue : bouton « Vente ». */}
          <Raccourci
            href="/reseller/catalog"
            icone={<Plus className="w-5 h-5" />}
            titre="Créer une commande"
            sousTitre="Choisir le produit, puis « Vente »"
          />
          <Raccourci href="/reseller/orders" icone={<ClipboardList className="w-5 h-5" />} titre="Mes ventes" sousTitre="Suivre les livraisons" />
          <Raccourci href="/reseller/channels" icone={<Store className="w-5 h-5" />} titre="Boutiques" sousTitre="Partager une boutique" />
        </div>

        {/* 5. Produits à partager */}
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">À partager aujourd&apos;hui</h2>
              <p className="text-xs text-slate-500">Sur votre statut WhatsApp ou directement à un client.</p>
            </div>
            <Link href="/reseller/catalog" className="text-xs font-bold text-suguba-brand hover:underline flex items-center gap-0.5 shrink-0">
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
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Le catalogue est en cours de remplissage. Les produits apparaîtront ici dès leur validation.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {approvedProducts.slice(0, 4).map((product) => (
                <div key={product.id} className="bg-white rounded-3xl p-3.5 border border-slate-200 flex flex-col justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                      <ProductImage src={product.images[0]} alt={product.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{product.name}</h3>
                      <p className="text-xs font-black text-slate-900">
                        {product.publicPrice.toLocaleString('fr-FR')} <span className="text-[11px] font-bold text-slate-500">F</span>
                      </p>
                      <span className="inline-block px-2 py-0.5 bg-suguba-brand/10 text-suguba-brand text-[11px] font-bold rounded-full">
                        Vous gagnez {product.resellerCommission.toLocaleString('fr-FR')} F
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Partage en un clic : photo + texte + lien avec le code
                        du revendeur (voir src/lib/partage.ts). */}
                    <button
                      type="button"
                      onClick={() => partagerProduit(
                        { nom: product.name, prix: product.publicPrice, slug: product.slug, images: product.images },
                        referralCode,
                      )}
                      className="flex-1 h-9 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                      <span>Partager</span>
                    </button>
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
            <h2 className="font-black text-sm text-slate-900">Dernières ventes</h2>
            <Link href="/reseller/orders" className="text-xs font-bold text-suguba-brand hover:underline">Voir tout</Link>
          </div>

          {myOrders.length === 0 ? (
            <p className="text-center py-6 text-slate-500 text-sm">
              Aucune vente pour le moment. Partagez votre premier produit !
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myOrders.slice(0, 4).map((order) => (
                <div key={order.id} className="py-3 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{order.productName}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' • '}{order.totalAmount.toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xs font-black text-suguba-brand">+{order.resellerCommission.toLocaleString('fr-FR')} F</p>
                    <StatutVente status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Outils de vente */}
        <div className="space-y-2.5">
          <h2 className="font-black text-sm text-slate-900">Outils de vente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Raccourci href="/reseller/marketing" icone={<Sparkles className="w-5 h-5" />} titre="Affiches statut" sousTitre="Prêtes à publier" />
            <Raccourci href="/reseller/badge" icone={<QrCode className="w-5 h-5" />} titre="Ma carte & QR" sousTitre="Votre carte revendeur" />
            <Raccourci href="/reseller/calculator" icone={<Calculator className="w-5 h-5" />} titre="Simulateur" sousTitre="Estimer vos gains" />
          </div>
        </div>

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

function Indicateur({ icone, titre, note, children }: {
  icone: React.ReactNode; titre: string; note: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 space-y-1.5">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icone}
        <span className="text-[11px] font-bold uppercase">{titre}</span>
      </div>
      <p className="text-xl sm:text-2xl font-black text-slate-900">{children}</p>
      <p className="text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function Raccourci({ href, onClick, disabled, icone, titre, sousTitre }: {
  href?: string; onClick?: () => void; disabled?: boolean;
  icone: React.ReactNode; titre: string; sousTitre: string;
}) {
  const contenu = (
    <>
      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
        {icone}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-slate-900 truncate">{titre}</p>
        <p className="text-[11px] text-slate-500 truncate">{sousTitre}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </>
  );
  const classes =
    'bg-white p-3.5 rounded-3xl border border-slate-200 hover:border-slate-300 flex items-center gap-3 ' +
    'text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  if (href) return <Link href={href} className={classes}>{contenu}</Link>;
  return <button onClick={onClick} disabled={disabled} className={classes}>{contenu}</button>;
}

function StatutVente({ status }: { status: string }) {
  if (status === 'delivered') {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-suguba-brand/10 text-suguba-brand font-bold text-[11px]">Livrée</span>;
  }
  if (status === 'in_transit' || status === 'dispatched') {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px]">En route</span>;
  }
  if (status === 'cancelled' || status === 'returned') {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px]">Annulée</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">En attente</span>;
}
