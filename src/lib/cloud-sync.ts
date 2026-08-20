'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { sugubaStore } from './store';
import { Order, Product } from '@/types';

class CloudSyncService {
  private isListening = false;
  private isInitialFetched = false;

  public isCloudActive(): boolean {
    return isSupabaseConfigured && supabase !== null;
  }

  // 1. Initialise les abonnements Websockets et le chargement initial
  public async initRealtimeSync(): Promise<void> {
    if (!this.isCloudActive() || !supabase) {
      return;
    }

    // Chargement initial des données Cloud
    if (!this.isInitialFetched) {
      this.isInitialFetched = true;
      await this.fetchProductsFromCloud();
      await this.fetchOrdersFromCloud();
    }

    if (this.isListening) return;
    this.isListening = true;

    try {
      // Pas d'abonnement Realtime anon-key sur `orders` : le schéma corrigé
      // (BUG-006) ne donne plus aucun accès public en lecture à cette table
      // (noms/téléphones/adresses clients), donc Supabase Realtime ne
      // pousserait de toute façon rien à un abonné anonyme. Les pages
      // admin/livreur rafraîchissent via fetchOrdersFromCloud() (route
      // /api/orders/feed, authentifiée) — voir CloudSyncBadge / pages
      // concernées pour un polling périodique si besoin d'un quasi-live.

      // Écouteur en temps réel sur les Produits
      supabase
        .channel('suguba_realtime_products')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              this.syncProductFromCloud(payload.new);
            } else if (payload.eventType === 'UPDATE') {
              this.syncProductUpdateFromCloud(payload.new);
            }
          }
        )
        .subscribe();

      console.log('🟢 Synchronisation Cloud Supabase Websockets activée avec succès !');
    } catch (err) {
      console.warn('Erreur initialisation Supabase Realtime:', err);
    }
  }

  // 2. Récupérer tous les produits depuis Supabase
  public async fetchProductsFromCloud(): Promise<Product[]> {
    if (!this.isCloudActive() || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erreur chargement produits Supabase:', error.message);
        return [];
      }

      if (data && data.length > 0) {
        const cloudProducts: Product[] = data.map((p) => ({
          id: p.id,
          supplierId: p.supplier_id || 'sup-default',
          supplierName: p.supplier_name || 'Fournisseur Certifié',
          name: p.name,
          slug: p.slug,
          category: p.category || 'Général',
          description: p.description || '',
          images: Array.isArray(p.images) ? p.images : [], // BUG-011 : plus de repli Unsplash — voir ProductImage
          supplierPrice: Number(p.supplier_price || 0),
          publicPrice: Number(p.public_price || 0),
          resellerCommission: Number(p.reseller_commission || 0),
          sugubaMargin: Math.max(0, Number(p.public_price || 0) - Number(p.supplier_price || 0) - Number(p.reseller_commission || 0)),
          stockQuantity: Number(p.stock || 10),
          warrantyMonths: 6,
          preparationDelayHours: 2,
          stockLocationType: 'supplier',
          stockLocationAddress: 'Bamako',
          status: (p.status as any) || 'approved',
          marketingPitch: `🔥 NOUVEAUTÉ : ${p.name}\nQualité garantie !\nLivraison rapide à Bamako.`,
          createdAt: p.created_at || new Date().toISOString(),
        }));

        sugubaStore.setProductsFromCloud(cloudProducts);
        return cloudProducts;
      }
      return [];
    } catch (err) {
      console.warn('Exception réseau chargement produits:', err);
      return [];
    }
  }

  // 3. Récupérer toutes les commandes — via /api/orders/feed (authentifié
  // admin/livreur), plus via un SELECT anon direct depuis BUG-006 : cette
  // table contient des données personnelles clients, la clé publique
  // anon n'y a plus accès (voir supabase/schema.sql).
  public async fetchOrdersFromCloud(): Promise<Order[]> {
    try {
      const res = await fetch('/api/orders/feed');
      if (!res.ok) {
        // 401 attendu tant qu'aucune session admin/livreur n'est active —
        // pas une erreur, juste "rien à afficher pour ce visiteur".
        return [];
      }
      const json = await res.json();
      const data = json.orders as any[];

      if (data && data.length > 0) {
        const cloudOrders: Order[] = data.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          productId: o.product_id || '',
          productName: o.product_name,
          productImage: o.product_image || '', // BUG-011 : plus de repli Unsplash — voir ProductImage
          resellerId: o.reseller_id,
          resellerName: o.reseller_name,
          resellerCode: o.reseller_code,
          resellerCommission: Number(o.reseller_commission || 0),
          quantity: Number(o.quantity || 1),
          unitPrice: Number(o.unit_price || 0),
          totalProductAmount: Number(o.total_product_amount || 0),
          deliveryFee: Number(o.delivery_fee || 1500),
          totalAmount: Number(o.total_amount || 0),
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          city: o.city || 'Bamako',
          neighborhood: o.neighborhood || 'Bamako',
          landmark: o.landmark,
          deliveryNotes: o.delivery_notes,
          status: o.status || 'pending_call',
          deliveryOtp: o.delivery_otp,
          failedOtpAttempts: Number(o.failed_otp_attempts || 0),
          paymentMethod: o.payment_method || 'cash_on_delivery',
          paymentCollected: Boolean(o.payment_collected),
          driverId: o.assigned_driver_id,
          driverName: o.assigned_driver_name,
          createdAt: o.created_at || new Date().toISOString(),
          deliveredAt: o.delivered_at,
        }));

        sugubaStore.setOrdersFromCloud(cloudOrders);
        return cloudOrders;
      }
      return [];
    } catch (err) {
      console.warn('Exception réseau chargement commandes:', err);
      return [];
    }
  }

  // 4. Push d'un produit — via /api/products/sync (authentifié
  // fournisseur/admin). Écrire directement dans `products` avec la clé anon
  // n'est plus possible depuis le correctif BUG-006 : seule la lecture des
  // fiches approuvées reste publique.
  public async pushProductToCloud(product: Product): Promise<boolean> {
    try {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Exception push produit:', err);
      return false;
    }
  }

  // 5. Push d'une commande — via /api/orders/sync. La création reste
  // publique (client sans compte), la mise à jour de statut exige une
  // session admin/livreur (voir la route pour le détail).
  public async pushOrderToCloud(order: Order): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Exception push commande:', err);
      return false;
    }
  }

  // 6. Créer une demande de retrait — via /api/payouts/create
  // (authentifié, session revendeur active obligatoire). Corrige BUG-006 :
  // cette méthode écrivait auparavant directement dans `payouts` avec la
  // clé anon ; le schéma corrigé ne donne plus aucun accès public à cette
  // table. `resellerId` n'est plus transmis : la route serveur identifie
  // toujours le revendeur via sa session signée, jamais via le corps de la
  // requête (un revendeur ne doit jamais pouvoir créer un retrait au nom
  // d'un autre).
  public async pushPayoutToCloud(withdrawal: {
    id: string;
    withdrawalCode: string;
    resellerName: string;
    amount: number;
    payoutProvider: string;
    payoutPhone: string;
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/payouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalCode: withdrawal.withdrawalCode,
          resellerName: withdrawal.resellerName,
          amount: withdrawal.amount,
          payoutProvider: withdrawal.payoutProvider,
          payoutPhone: withdrawal.payoutPhone,
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Exception push retrait:', err);
      return false;
    }
  }

  // 7. Mettre à jour le statut du virement — réservé à l'admin, via
  // /api/payouts/initiate (déclenchement réel) ou le webhook Mobile Money
  // (/api/webhooks/momo). Un revendeur ne doit jamais pouvoir changer le
  // statut de son propre retrait depuis le navigateur.
  public async updatePayoutInCloud(
    _withdrawalId: string,
    _status: 'completed' | 'processing' | 'rejected',
    _transactionRef?: string
  ): Promise<boolean> {
    console.warn('[SECURITY] updatePayoutInCloud désactivé côté client — la mise à jour de statut passe par /api/payouts/initiate ou le webhook (BUG-006).');
    return false;
  }

  // Synchronisation interne depuis les événements Realtime
  private syncOrderFromCloud(cloudOrder: any): void {
    const localState = sugubaStore.getState();
    const exists = localState.orders.some(o => o.id === cloudOrder.id || o.orderNumber === cloudOrder.order_number);
    
    if (!exists) {
      const formattedOrder: Order = {
        id: cloudOrder.id,
        orderNumber: cloudOrder.order_number,
        productId: cloudOrder.product_id,
        productName: cloudOrder.product_name,
        productImage: cloudOrder.product_image || '', // BUG-011 : plus de repli Unsplash — voir ProductImage
        resellerId: cloudOrder.reseller_id,
        resellerName: cloudOrder.reseller_name || '',
        resellerCode: cloudOrder.reseller_code || '',
        resellerCommission: Number(cloudOrder.reseller_commission || 0),
        quantity: Number(cloudOrder.quantity || 1),
        unitPrice: Number(cloudOrder.unit_price || 0),
        totalProductAmount: Number(cloudOrder.total_product_amount || 0),
        deliveryFee: Number(cloudOrder.delivery_fee || 1500),
        totalAmount: Number(cloudOrder.total_amount || 0),
        customerName: cloudOrder.customer_name,
        customerPhone: cloudOrder.customer_phone,
        city: cloudOrder.city || 'Bamako',
        neighborhood: cloudOrder.neighborhood,
        landmark: cloudOrder.landmark,
        deliveryNotes: cloudOrder.delivery_notes,
        status: cloudOrder.status || 'pending_call',
        deliveryOtp: cloudOrder.delivery_otp,
        failedOtpAttempts: Number(cloudOrder.failed_otp_attempts || 0),
        paymentMethod: cloudOrder.payment_method || 'cash_on_delivery',
        paymentCollected: Boolean(cloudOrder.payment_collected),
        createdAt: cloudOrder.created_at || new Date().toISOString(),
      };

      sugubaStore.addOrderFromCloud(formattedOrder);

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (_) {}
      }
    }
  }

  private syncOrderUpdateFromCloud(cloudOrder: any): void {
    sugubaStore.updateOrderStatusFromCloud(cloudOrder.id || cloudOrder.order_number, cloudOrder.status, cloudOrder.payment_collected);
  }

  private syncProductFromCloud(cloudProduct: any): void {
    const formattedProduct: Product = {
      id: cloudProduct.id,
      supplierId: cloudProduct.supplier_id || 'sup-default',
      supplierName: cloudProduct.supplier_name || 'Fournisseur Certifié',
      name: cloudProduct.name,
      slug: cloudProduct.slug,
      category: cloudProduct.category || 'Général',
      description: cloudProduct.description || '',
      images: Array.isArray(cloudProduct.images) ? cloudProduct.images : [], // BUG-011 : plus de repli Unsplash — voir ProductImage
      supplierPrice: Number(cloudProduct.supplier_price || 0),
      publicPrice: Number(cloudProduct.public_price || 0),
      resellerCommission: Number(cloudProduct.reseller_commission || 0),
      sugubaMargin: Math.max(0, Number(cloudProduct.public_price || 0) - Number(cloudProduct.supplier_price || 0) - Number(cloudProduct.reseller_commission || 0)),
      stockQuantity: Number(cloudProduct.stock || 10),
      warrantyMonths: 6,
      preparationDelayHours: 2,
      stockLocationType: 'supplier',
      stockLocationAddress: 'Bamako',
      status: (cloudProduct.status as any) || 'approved',
      marketingPitch: `🔥 NOUVEAUTÉ : ${cloudProduct.name}\nQualité garantie !\nLivraison disponible à Bamako.`,
      createdAt: cloudProduct.created_at || new Date().toISOString(),
    };
    sugubaStore.addProductFromCloud(formattedProduct);
  }

  private syncProductUpdateFromCloud(cloudProduct: any): void {
    this.syncProductFromCloud(cloudProduct);
  }
}

export const cloudSyncService = new CloudSyncService();
