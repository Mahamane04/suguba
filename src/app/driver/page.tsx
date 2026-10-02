'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProductImage from '@/components/common/ProductImage';
import OrdersSyncNotice from '@/components/common/OrdersSyncNotice';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CloudSyncBadge from '@/components/common/CloudSyncBadge';
import RamassageColis from '@/components/driver/RamassageColis';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { cloudSyncService } from '@/lib/cloud-sync';
import EmptyState from '@/components/ui/EmptyState';
import { Order } from '@/types';
import { useCaisseLivreur } from '@/lib/useCaisseLivreur';
import { LIBELLE_ENCAISSEMENT, statutEncaissement } from '@/lib/caisse-livreur';
import { 
  Truck, Phone, MapPin, KeyRound, CheckCircle2, 
  Banknote, Package, Navigation, AlertCircle, ArrowRight,
  Compass, MessageCircle, Printer, Wallet, ShieldCheck, LifeBuoy
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatDate, formatF, FORMAT_DATE } from '@/lib/montant';
import LigneListe from '@/components/ui/LigneListe';

const OtpValidationModal = dynamic(() => import('@/components/driver/OtpValidationModal'));
const DeliveryMapModal = dynamic(() => import('@/components/driver/DeliveryMapModal'));
const PrintableReceiptModal = dynamic(() => import('@/components/common/PrintableReceiptModal'));

export default function DriverDashboardPage() {
  const state = useSugubaStore();
  const [selectedOrderForOtp, setSelectedOrderForOtp] = useState<Order | null>(null);
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const currentUser = state.currentUser;
  const [driver, setDriver] = useState<{ vehicleType: string | null; licensePlate: string | null; verifie?: boolean } | null>(null);
  const [remuneration, setRemuneration] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/driver/me')
      .then((res) => (res.ok ? res.json() : { driver: null }))
      .then((json) => {
        setDriver(json.driver || null);
        setRemuneration(typeof json.remunerationParLivraison === 'number' ? json.remunerationParLivraison : null);
      })
      .catch(() => setDriver(null));
  }, []);

  // /api/orders/feed ne renvoie déjà que les courses assignées à CE livreur
  // (voir ce fichier — corrigé le 2026-08-26, il renvoyait auparavant TOUTES
  // les commandes à n'importe quel livreur connecté). Filtrer ici par un
  // `driverId` de mock n'aurait plus aucun sens : state.orders EST déjà le
  // périmètre du livreur, seul le statut reste à trier côté client.
  const myAssignedOrders = state.orders.filter(
    o => o.status === 'dispatched' || o.status === 'in_transit'
  );

  const myDeliveredOrders = state.orders
    .filter(o => o.status === 'delivered')
    .sort((a, b) => Date.parse(b.deliveredAt || b.createdAt || '') - Date.parse(a.deliveredAt || a.createdAt || ''));

  // Même source que le portefeuille (LIV-01, audit UI/UX du 2026-10-02) : la
  // somme faite ici comptait aussi les espèces déjà versées à Suguba.
  const { caisse, caisseServeur, aRemettre, etat: etatCaisse } = useCaisseLivreur(myDeliveredOrders, remuneration);
  const fcfa = formatF;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />
      <OrdersSyncNotice />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* En-tête livreur — design system (2026-09-11). Il affichait le nom du
            compte de démonstration « Moussa Coulibaly », un badge technique
            « Cloud Live (PostgreSQL Sync) » et le texte brut
            « voir /register/complete ». */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              <Truck className="w-3.5 h-3.5" />
              <span>Espace livreur</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {currentUser.fullName ? `Bonjour, ${currentUser.fullName.split(' ')[0]}` : 'Bonjour'}
            </h1>
            {driver?.vehicleType ? (
              <p className="text-xs text-slate-500">
                Véhicule : <strong className="text-slate-700">{driver.vehicleType}</strong>
                {driver.licensePlate ? ` (${driver.licensePlate})` : ''}
              </p>
            ) : (
              <Link href="/register/complete" className="text-xs font-bold text-suguba-brand-dark hover:underline">
                Compléter mon dossier (véhicule, zone)
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">À remettre à Suguba</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">
                {aRemettre !== null ? fcfa(aRemettre) : etatCaisse === 'erreur' ? '—' : (
                  <span className="inline-block h-6 w-20 rounded-lg bg-slate-200 animate-pulse align-middle" role="status" aria-label="Chargement du montant" />
                )}
              </p>
              {etatCaisse === 'erreur' && <p className="text-xs text-slate-600">Montant indisponible, voir le portefeuille.</p>}
            </div>
            <Link
              href="/driver/earnings"
              className="rounded-2xl border border-slate-200 hover:bg-slate-50 p-3 flex items-center gap-2 transition-colors"
            >
              <Wallet className="w-5 h-5 text-slate-700 shrink-0" />
              <span className="text-sm font-bold text-slate-900">Mon portefeuille</span>
            </Link>
          </div>
        </div>

        {/* Plafond ou retard d'espèces (LIV-02) : le livreur ne recevait plus de
            course payée en espèces sans que l'accueil le dise ; il attendait. */}
        {caisse?.bloque && (
          <div role="status" className="rounded-3xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Courses payées en espèces suspendues. {caisse.raison}</span>
            </p>
            <p className="text-sm text-amber-900">Versez vos espèces à Suguba pour en recevoir de nouvelles.</p>
            <Link href="/driver/earnings" className="inline-flex min-h-11 items-center text-sm font-bold text-amber-900 underline">
              Voir comment verser
            </Link>
          </div>
        )}

        {/* Active Runs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-900 flex items-center">
              <Navigation className="w-4 h-4 mr-2 text-amber-600" />
              <span>Mes courses en cours ({state.ordersSync === 'ready' ? myAssignedOrders.length : '—'})</span>
            </h2>
          </div>

          {myAssignedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-1">
              <Truck className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              {state.ordersSync === 'ready' ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">Pas de course pour l’instant</p>
                  <p className="text-sm text-slate-600">Vous serez prévenu dès qu’une course vous est attribuée. Restez joignable.</p>
                </>
              ) : (
                <p className="text-sm text-slate-600">La liste des courses n’est pas encore confirmée.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {myAssignedOrders.map((order) => {
                const product = state.products.find(p => p.id === order.productId);

                return (
                  <div 
                    key={order.id}
                    className="bg-white rounded-3xl p-5 border-2 border-amber-400 shadow-md space-y-4"
                  >
                    {/* Top Status */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {order.status === 'dispatched' ? 'À récupérer' : 'En cours de livraison'}
                        </span>
                      </div>

                      {/* Un badge « à encaisser » inconditionnel ferait réclamer
                          au client une somme qu'il a déjà réglée en ligne. */}
                      {order.paymentCollected ? (
                        <div className="px-3 py-1 bg-suguba-menthe border border-suguba-brand/30 rounded-full text-suguba-profond font-bold text-xs flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-suguba-brand-dark" />
                          <span>Déjà payé — ne rien encaisser</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-900 font-bold text-xs flex items-center space-x-1">
                          <Banknote className="w-3.5 h-3.5 text-amber-700" />
                          <span>À encaisser chez le client : {formatF(order.totalAmount)}</span>
                        </div>
                      )}
                    </div>

                    {/* Product item */}
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                        <ProductImage src={order.productImage} alt={order.productName} fill sizes="48px" className="object-cover" compact />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{order.productName}</h4>
                        <p className="text-xs text-slate-500">Quantité à remettre : <strong>{order.quantity}</strong></p>
                      </div>
                    </div>

                    {/* Étape 1 : ramassage prouvé par le code du fournisseur (2026-09-24). */}
                    <RamassageColis order={order} nomRepli={product?.supplierName} />

                    {/* Step 2: Dropoff Location & Landmark */}
                    <div className="p-3 bg-suguba-menthe/60 rounded-2xl border border-suguba-brand/20 text-sm space-y-1">
                      <div className="flex items-center space-x-1.5 text-suguba-profond font-bold">
                        <MapPin className="w-4 h-4 text-suguba-brand-dark" />
                        <span>2. Livrer au client</span>
                      </div>
                      <p className="font-bold text-slate-900 pl-5">
                        {order.customerName} — <span className="font-mono text-suguba-profond whitespace-nowrap">{order.customerPhone}</span>
                      </p>
                      <p className="text-slate-700 pl-5">
                        Quartier : <strong>{order.neighborhood}</strong>
                      </p>
                      <p className="text-slate-700 pl-5 bg-white p-2 rounded-xl border border-suguba-brand/20 font-medium">
                        📍 Repère : {order.landmark}
                      </p>
                      {order.deliveryNotes && (
                        <p className="text-xs text-slate-500 pl-5 italic">
                          Note client : {order.deliveryNotes}
                        </p>
                      )}
                    </div>

                    {/* LIV-05 (lot 7 de l'audit UI/UX du 2026-10-02) : quatre boutons de quatre
                        styles (blanc, gris, noir, ambre) et « Signaler un problème » en lien
                        perdu. Une seule action principale, celle de la porte du client ;
                        les autres sont des boutons secondaires identiques. */}
                    <div className="space-y-2 pt-2">
                      <Button type="button" size="lg" fullWidth onClick={() => setSelectedOrderForOtp(order)}
                        disabled={order.status === 'dispatched' && !order.pickedUpAt}>
                        <KeyRound className="w-4 h-4" />Saisir le code du client
                      </Button>
                      {order.status === 'dispatched' && !order.pickedUpAt && (
                        <p className="text-xs text-slate-600 text-center">Récupérez d’abord le colis chez le vendeur.</p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button href={`tel:${order.customerPhone}`} variant="ghost"><Phone className="w-4 h-4" />Appeler</Button>
                        <Button type="button" variant="ghost" onClick={() => setSelectedOrderForMap(order)}><Compass className="w-4 h-4" />Itinéraire</Button>
                        <Button type="button" variant="ghost" onClick={() => setSelectedOrderForReceipt(order)}><Printer className="w-4 h-4" />Reçu</Button>
                        <Button href="/driver/aide" variant="ghost"><LifeBuoy className="w-4 h-4" />Problème</Button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Runs History */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-bold text-base text-slate-900">
            Dernières livraisons
          </h2>

          {/* LIV-04 : le montant et le statut se cassaient sur 5 lignes à 390 px
              (bloc de texte sans min-w-0, colonne de droite compressible). Le
              statut lit maintenant le moyen de paiement et la caisse (LIV-01). */}
          <div className="divide-y divide-slate-100">
            {myDeliveredOrders.length === 0 && (
              <EmptyState icon={Package} title={state.ordersSync === 'ready' ? 'Aucune livraison effectuée pour le moment.' : 'Historique non confirmé.'} />
            )}
            {myDeliveredOrders.slice(0, 3).map((order) => {
              const statut = statutEncaissement(order, caisseServeur);
              return (
                <LigneListe key={order.id}
                  titre={order.productName}
                  meta={<>#{order.orderNumber} · {order.neighborhood}{order.deliveredAt ? ` · ${formatDate(order.deliveredAt, 'jour')}` : ''}</>}
                  valeur={fcfa(order.totalAmount)}
                  statut={<span className={statut === 'a_remettre' ? 'text-amber-800' : 'text-slate-600'}>{LIBELLE_ENCAISSEMENT[statut]}</span>}
                  action={
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForReceipt(order)}
                      aria-label={`Reçu de la commande ${order.orderNumber}`}
                      className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  }
                />
              );
            })}
          </div>
          {myDeliveredOrders.length > 3 && (
            <Link href="/driver/earnings" className="inline-flex min-h-11 items-center text-sm font-bold text-suguba-brand-dark hover:underline">
              Voir les {myDeliveredOrders.length} livraisons dans mon portefeuille
            </Link>
          )}
        </div>

      </main>

      {/* Printable Receipt Modal */}
      {selectedOrderForReceipt && (
        <PrintableReceiptModal
          order={selectedOrderForReceipt}
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

      {/* Map & GPS Navigation Modal */}
      {selectedOrderForMap && (
        <DeliveryMapModal
          order={selectedOrderForMap}
          isOpen={!!selectedOrderForMap}
          onClose={() => setSelectedOrderForMap(null)}
        />
      )}

      {/* OTP Modal */}
      {selectedOrderForOtp && (
        <OtpValidationModal
          order={selectedOrderForOtp}
          isOpen={!!selectedOrderForOtp}
          onClose={() => setSelectedOrderForOtp(null)}
          // La validation se fait désormais côté serveur (voir le
          // composant) : sans ce rafraîchissement, la commande resterait
          // affichée "en cours" jusqu'au prochain rechargement de page.
          onSuccess={() => { cloudSyncService.fetchOrdersFromCloud(); }}
        />
      )}

      <BottomNav />
    </div>
  );
}
