'use client';

import React, { useEffect, useState } from 'react';
import ProductImage from '@/components/common/ProductImage';
import PageReseau from '@/components/reseau/PageReseau';
import OrdersSyncNotice from '@/components/common/OrdersSyncNotice';
import { useSugubaStore } from '@/lib/store';
import Button from '@/components/ui/Button';
import { EmptyState, StatusPill } from '@/components/ui/Surface';
import { etatCommissionVente, statutVente, type LigneCommission } from '@/lib/libelles-vente';
import { ShoppingBag, MapPin, Calendar } from 'lucide-react';
import { formatF, FORMAT_DATE } from '@/lib/montant';

export default function ResellerOrdersPage() {
  const state = useSugubaStore();
  const [filter, setFilter] = useState<string>('all');
  const [recherche, setRecherche] = useState('');
  // REV-01 (audit UI/UX du 2026-10-02) : la bande « commission » lisait la liste
  // locale des commissions du magasin, que rien ne remplit ; elle n'affichait
  // donc jamais l'état réel. Les lignes viennent du grand-livre du serveur.
  const [commissions, setCommissions] = useState<Map<string, LigneCommission[]> | null>(null);
  useEffect(() => {
    fetch('/api/reseller/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const parVente = new Map<string, LigneCommission[]>();
        for (const l of (j?.reseller?.commissionsParVente || []) as LigneCommission[]) {
          if (!l.commande) continue;
          parVente.set(l.commande, [...(parVente.get(l.commande) || []), l]);
        }
        setCommissions(parVente);
      })
      .catch(() => setCommissions(null));
  }, []);

  // Ventes du revendeur CONNECTÉ (2026-09-11). La page cherchait le revendeur
  // dans les données de démonstration puis ne gardait que les commandes de ce
  // faux revendeur : un vrai revendeur ne voyait jamais ses propres ventes,
  // pourtant renvoyées par /api/orders/feed.
  const uid = state.currentUser.id;
  const myOrders = uid ? state.orders.filter(o => o.resellerId === uid && `${o.orderNumber} ${o.customerName} ${o.productName}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr'))).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : [];

  const filteredOrders = filter === 'all'
    ? myOrders
    : myOrders.filter(o => {
        if (filter === 'delivered') return o.status === 'delivered';
        if (filter === 'in_transit') return o.status === 'in_transit' || o.status === 'dispatched';
        if (filter === 'pending') return o.status === 'new' || o.status === 'pending_call' || o.status === 'confirmed';
        return true;
      });

  return (
    // REV-14 (lot 6 de l'audit UI/UX du 2026-10-02) : coquille commune des espaces.
    <PageReseau titre="Mes ventes" large
      sousTitre="La livraison de vos clients et le moment où votre commission devient retirable."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}>
      <OrdersSyncNotice />
        <div><label htmlFor="ventes-recherche" className="sr-only">Rechercher une vente</label><input id="ventes-recherche" type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher : numéro, client ou produit" className="w-full h-12 px-4 border border-slate-300 rounded-full bg-white text-base"/></div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Toutes (${state.ordersSync === 'ready' ? myOrders.length : '—'})` },
            { id: 'pending', label: 'À confirmer' },
            { id: 'in_transit', label: 'En livraison' },
            { id: 'delivered', label: 'Livrées' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`min-h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-suguba-profond text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            state.ordersSync !== 'ready' ? (
              <EmptyState icone={ShoppingBag} titre="La liste de vos ventes n’est pas encore confirmée."
                texte="Elle se met à jour dès que la connexion le permet. Vos ventes ne sont pas perdues." />
            ) : myOrders.length === 0 && !recherche ? (
              <EmptyState icone={ShoppingBag} titre="Vos ventes apparaîtront ici"
                texte="Quand un client commande par votre lien, vous suivez ici sa livraison et le moment où votre commission devient retirable."
                action={<Button href="/reseller/catalog">Choisir un produit à partager</Button>} />
            ) : (
              <EmptyState icone={ShoppingBag} titre="Aucune vente pour ce filtre"
                action={<Button variant="ghost" onClick={() => { setFilter('all'); setRecherche(''); }}>Voir toutes mes ventes</Button>} />
            )
          ) : (
            filteredOrders.map((order) => {
              const statut = statutVente(order.status);
              const etat = etatCommissionVente(commissions?.get(order.id) || [], order.status, order.resellerCommission);

              return (
                <div 
                  key={order.id}
                  className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3"
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        #{order.orderNumber}
                      </span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', FORMAT_DATE.complet)}
                      </span>
                    </div>

                    {/* REV-01 : un badge pour chacun des 8 statuts (4 n'en avaient pas). */}
                    <StatusPill ton={statut.ton}>{statut.libelle}</StatusPill>
                  </div>

                  {/* Body Details */}
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    
                    {/* Product info */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                        <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-semibold text-sm text-slate-900 line-clamp-2">{order.productName}</h4>
                        <p className="text-xs text-slate-600">
                          Quantité : <strong>{order.quantity}</strong> · Total client : <strong className="tabular-nums">{formatF(order.totalAmount)}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Customer & Location */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs space-y-1 sm:w-72">
                      <p className="font-bold text-slate-800 flex items-center">
                        <span className="text-slate-500 mr-1.5 font-normal">Client :</span>
                        {order.customerName} ({order.customerPhone})
                      </p>
                      <p className="text-slate-600 flex items-start">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0 mt-0.5" />
                        <span>{order.neighborhood} — {order.landmark}</span>
                      </p>
                      {order.driverName && (
                        <p className="text-slate-600 text-xs pt-1 border-t border-slate-200">
                          Livreur : <strong>{order.driverName}</strong>
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Votre commission : quand elle devient retirable (REV-01, REV-02). */}
                  <div className={`rounded-2xl p-3 flex items-center justify-between gap-3 ${etat.ton === 'danger' ? 'bg-rose-50' : 'bg-suguba-menthe'}`}>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-600">Votre commission</p>
                      <p className={`text-sm font-semibold ${etat.ton === 'danger' ? 'text-rose-800' : 'text-suguba-profond'}`}>{etat.libelle}</p>
                    </div>
                    <span className={`shrink-0 text-base font-bold tabular-nums whitespace-nowrap ${etat.ton === 'danger' ? 'text-rose-800 line-through' : 'text-suguba-profond'}`}>
                      +{formatF(etat.ton === 'danger' ? order.resellerCommission : etat.montant)}
                    </span>
                  </div>

                </div>
              );
            })
          )}
        </div>
    </PageReseau>
  );
}
