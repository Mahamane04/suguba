'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CloudSyncBadge from '@/components/common/CloudSyncBadge';
import ProductPricingModal from '@/components/admin/ProductPricingModal';
import DriverVerificationPanel from '@/components/admin/DriverVerificationPanel';
import EconomicSettingsPanel from '@/components/admin/EconomicSettingsPanel';
import { useSugubaStore, sugubaStore, definirApercuAdmin } from '@/lib/store';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { useToast } from '@/components/ui/Toast';
import { Product, Order, UserRole } from '@/types';
import {
  ShieldCheck, PhoneCall, Truck, Wallet, ShoppingBag,
  Clock, CheckCircle2, TrendingUp, AlertCircle, ArrowRight,
  ExternalLink, UserCheck, ShieldAlert, MessageCircle, BarChart3, Radio,
  Building2, QrCode, Settings, Trash2, UserCog, RotateCcw, Sparkles, X, Check, Eye
} from 'lucide-react';

/** Rôles que l'admin peut prévisualiser (voir /api/admin/preview-role). */
const ROLES_APERCU: { role: string; libelle: string; chemin: string }[] = [
  { role: 'customer', libelle: 'Client',      chemin: '/' },
  { role: 'reseller', libelle: 'Revendeur',   chemin: '/reseller' },
  { role: 'supplier', libelle: 'Fournisseur', chemin: '/supplier' },
  { role: 'diaspora', libelle: 'Diaspora',    chemin: '/diaspora' },
];

interface RetraitAdmin {
  id: string; revendeur: string; montant: number; moyen: string;
  telephone: string; statut: string; creeLe: string;
}

const LIBELLE_MOYEN: Record<string, string> = {
  orange_money: 'Orange Money', moov: 'Moov Money', mobi_cash: 'Mobi Cash',
  wave: 'Wave (non pris en charge)', cash: 'Espèces au guichet',
};

export default function AdminDashboardPage() {
  const state = useSugubaStore();
  const router = useRouter();
  const { confirmer, toast } = useToast();
  const [apercuEnCours, setApercuEnCours] = useState<string | null>(null);

  // « Se connecter en tant que » (2026-09-11) — pour vérifier soi-même les
  // écrans client/revendeur/fournisseur/diaspora sans créer et faire
  // valider un vrai compte à chaque fois. Identité de test dédiée, jamais
  // celle de l'admin (voir la route). Un bandeau (PreviewBanner) rappelle en
  // permanence qu'on est en aperçu, avec un bouton pour en sortir.
  const ouvrirApercu = async (role: string, chemin: string) => {
    setApercuEnCours(role);
    try {
      const res = await fetch('/api/admin/preview-role', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Impossible d'ouvrir l'aperçu.", { ton: 'erreur' });
        return;
      }
      sugubaStore.definirUtilisateur({ id: `apercu-${role}`, fullName: '', phone: '', role: role as UserRole, city: 'Bamako' });
      definirApercuAdmin(true);
      router.push(chemin);
    } catch {
      toast('Erreur réseau.', { ton: 'erreur' });
    } finally {
      setApercuEnCours(null);
    }
  };

  // Retraits RÉELS (table payouts). Ils venaient de la mémoire locale : une
  // demande faite depuis le téléphone d'un revendeur n'apparaissait jamais ici.
  const [retraits, setRetraits] = useState<RetraitAdmin[] | null>(null);
  const [retraitEnCours, setRetraitEnCours] = useState<string | null>(null);
  const chargerRetraits = useCallback(async () => {
    try {
      const j = await fetch('/api/admin/payouts').then((r) => r.json());
      setRetraits(Array.isArray(j.retraits) ? j.retraits : []);
    } catch {
      setRetraits((prev) => prev ?? []);
    }
  }, []);
  useEffect(() => { chargerRetraits(); }, [chargerRetraits]);
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<Product | null>(null);
  const [agencyCodeInput, setAgencyCodeInput] = useState('');
  const [agencyCodeFeedback, setAgencyCodeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Admin Config & Data Purge State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [promotePhoneInput, setPromotePhoneInput] = useState('');
  const [promoteBusy, setPromoteBusy] = useState(false);

  // Onboarding Desk Tab
  const [onboardingTab, setOnboardingTab] = useState<'suppliers' | 'drivers' | 'resellers' | 'diaspora'>('suppliers');

  // Vrais livreurs actifs pour le dispatch — state.drivers ne contient que
  // des fiches fictives (mock-data.ts), jamais les vrais comptes.
  const [activeDrivers, setActiveDrivers] = useState<Array<{ id: string; fullName: string; phone: string | null; vehicleType: string | null }>>([]);

  // Les produits "submitted" par un fournisseur sur un autre appareil sont
  // invisibles à la clé anon (RLS ne lit que status='approved', voir
  // supabase/schema.sql) — donc invisibles à state.products tant qu'on ne va
  // pas les chercher explicitement via cette route service_role. Sans ce
  // fetch, "Modération Catalogue & Marges" ne montrerait que les dépôts
  // faits depuis le navigateur de l'admin lui-même.
  useEffect(() => {
    fetch('/api/admin/products/pending')
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.products) && json.products.length > 0) {
          sugubaStore.setProductsFromCloud(json.products);
        }
      })
      .catch(() => {});

    fetch('/api/admin/drivers/active')
      .then((res) => res.json())
      .then((json) => setActiveDrivers(Array.isArray(json.drivers) ? json.drivers : []))
      .catch(() => {});
  }, []);

  const pendingProducts = state.products.filter(p => p.status === 'submitted');
  const pendingCallOrders = state.orders.filter(o => o.status === 'pending_call');
  const confirmedOrders = state.orders.filter(o => o.status === 'confirmed');
  const inTransitOrders = state.orders.filter(o => o.status === 'in_transit');
  const pendingPayouts = (retraits || []).filter((r) => r.statut === 'pending');
  const enCoursDeVirement = (retraits || []).filter((r) => r.statut === 'processing');
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} F`;

  const agirSurRetrait = async (r: RetraitAdmin, action: 'virer' | 'payer_especes' | 'rejeter') => {
    const questions = {
      virer: {
        titre: `Envoyer ${fmt(r.montant)} à ${r.revendeur} ?`,
        message: `Virement ${LIBELLE_MOYEN[r.moyen] || r.moyen} au ${r.telephone} via SasPay. Il sera marqué payé à la confirmation du réseau.`,
        confirmer: 'Envoyer le virement',
      },
      payer_especes: {
        titre: `Remettre ${fmt(r.montant)} en espèces à ${r.revendeur} ?`,
        message: `À confirmer une fois l'argent remis en main propre (code ${r.id}).`,
        confirmer: 'Argent remis',
      },
      rejeter: {
        titre: `Refuser le retrait de ${r.revendeur} ?`,
        message: `${fmt(r.montant)} retournent sur son solde disponible.`,
        confirmer: 'Refuser',
      },
    }[action];
    if (!(await confirmer({ ...questions, danger: action === 'rejeter' }))) return;

    setRetraitEnCours(r.id);
    try {
      const res = action === 'virer'
        ? await fetch('/api/payouts/initiate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ withdrawalId: r.id }),
          })
        : await fetch('/api/admin/payouts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, action }),
          });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        toast(
          action === 'virer' ? 'Virement transmis à SasPay.' : action === 'payer_especes' ? 'Retrait marqué payé.' : 'Retrait refusé, solde rendu.',
          { ton: 'succes' },
        );
      } else {
        toast(j.error || 'Action impossible.', { ton: 'erreur', duree: 7000 });
      }
    } catch {
      toast('Erreur réseau.', { ton: 'erreur' });
    } finally {
      setRetraitEnCours(null);
      chargerRetraits();
    }
  };

  const totalGMV = state.orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCommissionsPaid = state.commissions
    .filter(c => c.status === 'available' || c.status === 'locked')
    .reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* En-tête : un titre clair et des raccourcis neutres. Il y avait un
            dégradé violet, « Suguba Master Ops Desk » et six boutons de six
            couleurs différentes. */}
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">Tableau de bord</h1>
              <p className="text-xs text-slate-500">
                Appels à passer, livraisons à assigner, retraits à payer : ce qui attend une action aujourd&apos;hui.
              </p>
            </div>
            <CloudSyncBadge />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { href: '/admin/products', label: 'Produits', Icone: ShoppingBag },
              { href: '/admin/sav', label: 'SAV & retours', Icone: ShieldAlert },
              { href: '/admin/analytics', label: 'Analyses', Icone: TrendingUp },
              { href: '/admin/reports/daily', label: 'Rapport du soir', Icone: BarChart3 },
              { href: '/admin/broadcast', label: 'Diffusion', Icone: Radio },
              { href: '/admin/launch-checklist', label: 'Checklist', Icone: ShieldCheck },
            ].map(({ href, label, Icone }) => (
              <Link
                key={href}
                href={href}
                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                <Icone className="w-4 h-4 text-slate-500" />
                <span>{label}</span>
              </Link>
            ))}
            <button
              onClick={() => setShowConfigModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Comptes admin</span>
            </button>
          </div>
        </div>

        {/* Aperçu — se connecter en tant que (2026-09-11, sorti de la modale
            « Comptes admin » où l'utilisateur ne l'a pas retrouvé lors d'un
            test filmé : direct sur le tableau de bord, impossible à manquer. */}
        <div className="bg-amber-50 border border-amber-200 p-4 sm:p-5 rounded-3xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-amber-950">Tester un profil</h2>
              <p className="text-[11px] text-amber-800">
                Ouvre l&apos;espace choisi avec un compte de test dédié (jamais le vôtre). ⚠️ Les
                actions faites en aperçu écrivent pour de vrai — à nettoyer vous-même après coup.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROLES_APERCU.map(({ role, libelle, chemin }) => (
              <button
                key={role}
                type="button"
                disabled={apercuEnCours !== null}
                onClick={() => ouvrirApercu(role, chemin)}
                className="px-3 py-2.5 bg-white hover:bg-amber-100 disabled:opacity-50 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold transition-colors"
              >
                {apercuEnCours === role ? '...' : libelle}
              </button>
            ))}
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <AlertCircle className="w-4 h-4 text-rose-700" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button 
              onClick={() => setActionFeedback(null)}
              className="p-1 hover:bg-black/10 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Volume Global (GMV)</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {totalGMV.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[11px] text-slate-500">{state.orders.length} commandes totales</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Commissions Générées</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">
              {totalCommissionsPaid.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[11px] text-slate-500">Pour le réseau revendeurs</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-700 uppercase">Appels à passer</span>
            <p className="text-xl sm:text-2xl font-black text-amber-600">
              {pendingCallOrders.length}
            </p>
            <p className="text-[11px] text-slate-500">Confirmations clients requises</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-700 uppercase">Retraits en attente</span>
            <p className="text-xl sm:text-2xl font-black text-slate-600">
              {pendingPayouts.length}
            </p>
            <p className="text-[11px] text-slate-500">Virements Mobile Money à exécuter</p>
          </div>
        </div>

        {/* Réglages économiques : coûts, marge minimale, commissions, livraison. */}
        <EconomicSettingsPanel />

        {/* Operational Queues & Priority Action Desks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <DriverVerificationPanel />

          {/* Desk 1: Call Confirmation Queue (Anti-fausses commandes) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900">Desk Appel Confirmation</h2>
                  <p className="text-[11px] text-slate-500">Validation téléphonique préalable obligatoire</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
                {pendingCallOrders.length} en attente
              </span>
            </div>

            {pendingCallOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                ✅ Tous les appels de confirmation ont été traités !
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCallOrders.map((order) => (
                  <div key={order.id} className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-xs text-slate-900">
                          {order.customerName} • <strong className="text-amber-800 font-mono">{order.customerPhone}</strong>
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {order.productName} ({order.quantity}x) — {order.totalAmount.toLocaleString('fr-FR')} FCFA
                        </p>
                        <p className="text-[11px] text-slate-500">
                          📍 {order.neighborhood} ({order.landmark})
                        </p>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-500">#{order.orderNumber}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="py-2 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Appeler</span>
                      </a>

                      <a
                        href={whatsappHelper.getUnreachableFollowUpLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        <span>Relance FR</span>
                      </a>

                      <a
                        href={whatsappHelper.getBambaraFollowUpLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2 bg-[#128C7E] hover:bg-[#0e7064] text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        <span>Bambara</span>
                      </a>

                      <button
                        onClick={() => sugubaStore.confirmOrderCall(order.id, state.currentUser.fullName)}
                        className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Valider</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desk 2: Products Moderation & Pricing Control */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900">Modération Catalogue & Marges</h2>
                  <p className="text-[11px] text-slate-500">Suguba fixe le prix public et la commission fixe</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Catalogue complet : c'est là qu'on ajoute les photos d'un
                    produit existant (voir /admin/products). */}
                <Link
                  href="/admin/products"
                  className="px-2.5 py-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-[11px] font-black whitespace-nowrap"
                >
                  Produits & photos
                </Link>
                <Link
                  href="/admin/products/new"
                  className="px-2.5 py-1 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-black whitespace-nowrap"
                >
                  + Ajouter
                </Link>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black">
                  {pendingProducts.length} soumis
                </span>
              </div>
            </div>

            {pendingProducts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                ✅ Aucun produit en attente de modération.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingProducts.map((product) => (
                  <div key={product.id} className="p-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        {/* ProductImage : un produit soumis SANS photo passait
                            `undefined` à next/image, qui plante la page. */}
                        <ProductImage src={product.images[0] || ''} alt={product.name} fill sizes="48px" className="object-cover" compact />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
                        <p className="text-[11px] text-slate-500">Fournisseur : {product.supplierName}</p>
                        <p className="text-[11px] font-black text-slate-700">
                          Prix Fournisseur : {product.supplierPrice.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedProductForPricing(product)}
                      className="py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0 shadow-2xs"
                    >
                      Fixer Prix & Marge
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Desk 3: Driver Dispatch Queue */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Dispatch & Assignation des Livreurs</h2>
                <p className="text-[11px] text-slate-500">Commandes confirmées prêtes pour la course</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black">
              {confirmedOrders.length} à dispatcher
            </span>
          </div>

          {confirmedOrders.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Toutes les livraisons confirmées sont actuellement assignées.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {confirmedOrders.map((order) => (
                <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-900">Commande #{order.orderNumber}</span>
                      <span className="font-black text-emerald-700">{order.totalAmount.toLocaleString('fr-FR')} F</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{order.productName}</p>
                    <p className="text-[11px] text-slate-500">📍 Destination : {order.neighborhood} ({order.landmark})</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {activeDrivers.length === 0 ? (
                      <p className="flex-1 text-[11px] text-slate-500 italic">Aucun livreur actif pour l&apos;instant.</p>
                    ) : (
                      <>
                        <select
                          id={`driver-select-${order.id}`}
                          className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
                        >
                          {activeDrivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fullName} {d.vehicleType ? `(${d.vehicleType})` : ''}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => {
                            const select = document.getElementById(`driver-select-${order.id}`) as HTMLSelectElement;
                            const chosen = activeDrivers.find(d => d.id === select?.value);
                            if (chosen) {
                              sugubaStore.assignDriver(order.id, chosen.id, chosen.fullName, chosen.phone || undefined, state.currentUser.fullName);
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs"
                        >
                          Assigner
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desk 4: Payouts & Mobile Money Payout Validation Desk */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Retraits des revendeurs</h2>
                <p className="text-[11px] text-slate-500">Virement Orange Money, Moov ou Mobi Cash via SasPay, ou espèces au guichet</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              {pendingPayouts.length} en attente
            </span>
          </div>

          {/* Guichet : le revendeur présente le code WTH-XXXXXX affiché sur son
              écran « Gains ». Il ne changeait que la mémoire locale de ce
              navigateur ; il marque maintenant le vrai retrait payé. */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>Guichet : retrait en espèces par code</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = agencyCodeInput.trim().toUpperCase();
                if (!code) return;
                const r = pendingPayouts.find((x) => x.id.toUpperCase() === code);
                if (!r) {
                  setAgencyCodeFeedback({ success: false, message: `Aucun retrait en attente avec le code ${code}.` });
                  return;
                }
                if (r.moyen !== 'cash') {
                  setAgencyCodeFeedback({ success: false, message: `Le retrait ${code} est demandé en ${LIBELLE_MOYEN[r.moyen] || r.moyen} : il se paie par virement, pas au guichet.` });
                  return;
                }
                setAgencyCodeFeedback(null);
                setAgencyCodeInput('');
                void agirSurRetrait(r, 'payer_especes');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                placeholder="Code du retrait (ex : WTH-K7M3P9)"
                value={agencyCodeInput}
                onChange={(e) => setAgencyCodeInput(e.target.value)}
                className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="h-11 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold whitespace-nowrap"
              >
                Payer en espèces
              </button>
            </form>
            {agencyCodeFeedback && (
              <p className={`text-xs font-bold ${agencyCodeFeedback.success ? 'text-emerald-800' : 'text-rose-700'}`}>
                {agencyCodeFeedback.message}
              </p>
            )}
          </div>

          {retraits === null ? (
            <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Chargement des retraits">
              <div className="h-14 bg-slate-100 rounded-2xl" />
              <div className="h-14 bg-slate-100 rounded-2xl" />
            </div>
          ) : pendingPayouts.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Aucune demande de retrait en attente.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingPayouts.map((r) => (
                <div key={r.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900">
                      {fmt(r.montant)} pour {r.revendeur}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {LIBELLE_MOYEN[r.moyen] || r.moyen}{r.moyen !== 'cash' ? ` · ${r.telephone}` : ''} · code <span className="font-mono">{r.id}</span>
                      {' · '}{new Date(r.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.moyen === 'cash' ? (
                      <button
                        onClick={() => agirSurRetrait(r, 'payer_especes')}
                        disabled={retraitEnCours === r.id}
                        className="h-10 px-4 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold whitespace-nowrap"
                      >
                        Argent remis
                      </button>
                    ) : (
                      <button
                        onClick={() => agirSurRetrait(r, 'virer')}
                        disabled={retraitEnCours === r.id || r.moyen === 'wave'}
                        className="h-10 px-4 bg-suguba-brand hover:bg-suguba-brand-dark disabled:opacity-50 text-white rounded-xl text-xs font-bold whitespace-nowrap"
                      >
                        Envoyer le virement
                      </button>
                    )}
                    <button
                      onClick={() => agirSurRetrait(r, 'rejeter')}
                      disabled={retraitEnCours === r.id}
                      className="h-10 px-3 border border-slate-200 hover:bg-rose-50 disabled:opacity-50 text-rose-700 rounded-xl text-xs font-bold"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {enCoursDeVirement.length > 0 && (
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              {enCoursDeVirement.length} virement{enCoursDeVirement.length > 1 ? 's' : ''} en cours chez SasPay : marqué{enCoursDeVirement.length > 1 ? 's' : ''} payé{enCoursDeVirement.length > 1 ? 's' : ''} automatiquement à la confirmation du réseau.
            </p>
          )}
        </div>

        {/* Desk 5: Sécurité OTP & Déblocage des Commissions en Garantie */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Sécurité Antifraude & Déblocage des Commissions</h2>
                <p className="text-[11px] text-slate-500">Supervision des alertes OTP et transfert des commissions verrouillées (J+7 / J+14)</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Commissions Actuellement Verrouillées en Période de Sécurité :
            </h3>

            {state.commissions.filter(c => c.status === 'locked').length === 0 ? (
              <p className="text-xs text-slate-500">Aucune commission verrouillée en ce moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {state.commissions.filter(c => c.status === 'locked').map((com) => (
                  <div key={com.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">
                        {com.resellerName} — +{com.amount.toLocaleString('fr-FR')} FCFA ({com.productName})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Période de garantie : J+{com.safetyWindowDays} • Déblocage prévu : {new Date(com.unlockAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        const res = await fetch('/api/admin/unlock-commission', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ commissionId: com.id }),
                        });
                        const json = await res.json();
                        setActionFeedback(res.ok && json.success
                          ? { type: 'success', message: '✅ Commission débloquée : elle est désormais retirable par le revendeur.' }
                          : { type: 'error', message: json.error || 'Déblocage impossible.' });
                      }}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-2xs"
                      title="Rendre la commission retirable avant la fin du délai de sécurité"
                    >
                      Débloquer avant terme (J+{com.safetyWindowDays})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desk 6: Validation des Inscriptions & Onboarding Partenaires (Fournisseurs, Livreurs, Revendeurs & Diaspora) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Validation des Inscriptions & Onboarding</h2>
                <p className="text-[11px] text-slate-500">Valider les nouveaux Fournisseurs, Livreurs et gérer les paliers Revendeurs & Diaspora</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setOnboardingTab('suppliers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Fournisseurs
              </button>
              <button
                onClick={() => setOnboardingTab('drivers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'drivers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Livreurs
              </button>
              <button
                onClick={() => setOnboardingTab('resellers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'resellers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Revendeurs
              </button>
              <button
                onClick={() => setOnboardingTab('diaspora')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'diaspora' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Diaspora
              </button>
            </div>
          </div>

          {/* TAB 1: Fournisseurs — la validation des dossiers se fait dans
              le panneau "Comptes en attente de validation" plus haut (lit
              directement Supabase). Ce qui suivait ici lisait state.suppliers
              (données de démo locales, jamais persistées) et n'avait donc
              aucun effet réel — retiré pour ne pas laisser un bouton qui
              semble valider un fournisseur sans rien faire. */}
          {onboardingTab === 'suppliers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Fournisseurs
              </h3>
              <p className="text-xs text-slate-500">
                Les nouveaux dossiers fournisseurs (Google ou téléphone) apparaissent dans le panneau
                <strong className="text-slate-700"> « Comptes en attente de validation » </strong>
                en haut de cette page — c&apos;est là qu&apos;approuver ou rejeter, pas ici.
              </p>
            </div>
          )}

          {/* TAB 2: Livreurs — même principe que Fournisseurs ci-dessus :
              lisait state.drivers (démo locale) sans aucun effet réel. */}
          {onboardingTab === 'drivers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Livreurs
              </h3>
              <p className="text-xs text-slate-500">
                Les nouvelles candidatures livreur apparaissent dans le panneau
                <strong className="text-slate-700"> « Comptes en attente de validation » </strong>
                en haut de cette page — c&apos;est là qu&apos;approuver ou rejeter, pas ici.
              </p>
              {activeDrivers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Livreurs actifs ({activeDrivers.length})</p>
                  <div className="divide-y divide-slate-100">
                    {activeDrivers.map((d) => (
                      <div key={d.id} className="py-2 text-xs text-slate-700">
                        <strong className="text-slate-900">{d.fullName}</strong> — {d.vehicleType || 'Véhicule non renseigné'} • {d.phone}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Revendeurs : la liste et les boutons « Promouvoir VIP » lisaient
              les revendeurs de DÉMONSTRATION et ne changeaient que la mémoire
              locale — sans effet réel, puisque le palier est calculé par le
              serveur sur les ventes livrées (/api/reseller/me). */}
          {onboardingTab === 'resellers' && (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Les paliers sont <strong>automatiques</strong> : « Vérifié » dès 10 ventes livrées (commissions débloquées à 7 jours),
                « VIP » dès 30 (3 jours). Un nouveau revendeur attend 14 jours.
              </p>
              <p className="text-[11px] text-slate-500">
                Les nouvelles inscriptions revendeur apparaissent dans « Comptes en attente de validation ».
              </p>
            </div>
          )}

          {/* Diaspora : la liste venait des profils de DÉMONSTRATION. */}
          {onboardingTab === 'diaspora' && (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Les commandes diaspora arrivent avec les autres dans « Appels à passer » : leur repère commence par
                « Commande Diaspora » et indique le pays de l&apos;acheteur. Elles sont payées par carte avant l&apos;appel.
              </p>
            </div>
          )}

        </div>

      </main>

      {/* Pricing Modal */}
      {selectedProductForPricing && (
        <ProductPricingModal
          product={selectedProductForPricing}
          isOpen={!!selectedProductForPricing}
          onClose={() => setSelectedProductForPricing(null)}
        />
      )}

      {/* Admin Config & Ghost Data Purge Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-gray-900">Compte Admin & Nettoyage Données</h3>
                  <p className="text-xs text-gray-500">Paramétrer vos accès et purger les données fantômes</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1bis: Promouvoir un nouvel Admin (accès réel, pas la démo) */}
            <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
              <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserCog className="w-4 h-4 text-slate-700" />
                <span>Donner l'accès admin</span>
              </h4>
              <p className="text-[11px] text-slate-800">
                Donne le rôle admin (accès immédiat, sans validation) à un numéro déjà inscrit sur Suguba.
                Le tout premier compte admin, lui, se crée uniquement en ligne de commande — voir <code className="font-mono">scripts/create-admin.js</code>.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={promotePhoneInput}
                  onChange={(e) => setPromotePhoneInput(e.target.value)}
                  placeholder="+223 70 00 00 00"
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <button
                  type="button"
                  disabled={promoteBusy || !promotePhoneInput}
                  onClick={async () => {
                    setPromoteBusy(true);
                    try {
                      const res = await fetch('/api/admin/promote', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: promotePhoneInput }),
                      });
                      const json = await res.json();
                      setActionFeedback(
                        res.ok
                          ? { type: 'success', message: `✅ ${json.phone} promu admin et activé.` }
                          : { type: 'error', message: json.error || 'Échec de la promotion.' }
                      );
                      if (res.ok) setPromotePhoneInput('');
                    } catch (_) {
                      setActionFeedback({ type: 'error', message: 'Erreur réseau.' });
                    } finally {
                      setPromoteBusy(false);
                    }
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-colors whitespace-nowrap"
                >
                  {promoteBusy ? '...' : 'Promouvoir'}
                </button>
              </div>
            </div>

            {/* Section 2: Purge des Données Fantômes */}
            <div className="space-y-3.5 bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
              <div className="flex items-center gap-1.5 text-rose-900 font-black text-xs uppercase tracking-wider">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>2. Vider l&apos;affichage local de cet appareil</span>
              </div>
              {/* Ces trois boutons annonçaient « Base de données 100% vierge ! »
                  alors qu'ils ne touchent QUE le localStorage du navigateur —
                  la base Supabase reste intacte. Un admin pouvait croire avoir
                  purgé la production. Libellés corrigés le 2026-09-09 pour dire
                  ce qu'ils font réellement. */}
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Efface les données de démonstration <strong>affichées sur cet appareil</strong>,
                pour repartir d&apos;un écran propre. La base Supabase n&apos;est pas modifiée :
                les vraies commandes, retraits et commissions restent intacts et
                réapparaîtront au prochain chargement.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmer({
                      titre: "Vider l'affichage local ?",
                      message: "Commandes, retraits et commissions affichés sur cet appareil seront effacés. La base Supabase n'est pas touchée.",
                      confirmer: 'Vider',
                      danger: true,
                    })) {
                      sugubaStore.purgeAllGhostData({ keepProducts: true });
                      setActionFeedback({
                        type: 'success',
                        message: '🗑️ Affichage local vidé sur cet appareil. La base Supabase est inchangée.'
                      });
                      setShowConfigModal(false);
                    }
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider l&apos;affichage local (garder les produits)</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmer({
                      titre: "Vider aussi l'affichage du catalogue ?",
                      message: 'Les produits restent en base et réapparaîtront au prochain chargement.',
                      confirmer: 'Vider',
                      danger: true,
                    })) {
                      sugubaStore.purgeAllGhostData({ keepProducts: false });
                      setActionFeedback({
                        type: 'success',
                        message: '🧹 Affichage local entièrement vidé. Pour supprimer réellement des produits, passez par la modération du catalogue.'
                      });
                      setShowConfigModal(false);
                    }
                  }}
                  className="w-full py-2 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Vider aussi l&apos;affichage du catalogue
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
