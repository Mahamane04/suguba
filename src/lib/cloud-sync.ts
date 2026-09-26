'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { sugubaStore } from './store';
import { privateSessionGeneration } from './order-access-client';
import { Order, Product } from '@/types';
import { modeRemiseCommande, normaliserEtapes, normaliserModeRemise, normaliserTypeOffre } from './offre';

class CloudSyncService {
  private isListening = false;
  private ordersRequest = 0;
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
      sugubaStore.marquerCatalogueCharge();
      // Les commandes ne sont plus tirées ici : ce chemin s'exécute pour
      // TOUT visiteur (bouton CloudSyncBadge compris), donc un client, un
      // fournisseur ou un diaspora déclenchait systématiquement un
      // /api/orders/feed → 401 (bruit console à chaque page, sur toute
      // l'application). Seul CloudSyncInitializer, qui connaît le rôle réel
      // via /api/auth/me, appelle désormais fetchOrdersFromCloudSiEligible.
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

      // Plus d'abonnement Realtime sur `products` (2026-09-26, lot A) : la clé
      // publique n'a plus accès aux colonnes de prix, et Realtime ne sait pas
      // filtrer par colonne. Le catalogue se relit par /api/catalogue toutes
      // les deux minutes quand l'app est visible, et au retour sur l'app
      // (voir CloudSyncInitializer).
      setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.rafraichirCatalogue();
      }, 120_000);

      console.log('🟢 Catalogue Suguba synchronisé.');
    } catch (err) {
      console.warn('Erreur initialisation Supabase Realtime:', err);
    }
  }

  private dernierChargement = 0;

  /** Relecture du catalogue, au plus une fois toutes les 20 secondes (sauf `forcer`). */
  public async rafraichirCatalogue(forcer = false): Promise<void> {
    if (!forcer && Date.now() - this.dernierChargement < 20_000) return;
    await this.fetchProductsFromCloud();
  }

  // 2. Récupérer les produits approuvés — par /api/catalogue (2026-09-26,
  // lot A) et non plus en lisant la table avec la clé publique : le serveur
  // ne renvoie que les colonnes permises au rôle de la personne connectée
  // (le prix fournisseur n'est jamais envoyé à un visiteur ni à un revendeur).
  public async fetchProductsFromCloud(): Promise<Product[]> {
    if (!this.isCloudActive()) return [];
    this.dernierChargement = Date.now();

    try {
      let data: any[] | null = null;
      let error: { message: string } | null = null;
      try {
        const res = await fetch('/api/catalogue', { cache: 'no-store', credentials: 'same-origin' });
        const j = await res.json().catch(() => null);
        if (res.ok && Array.isArray(j?.products)) data = j.products;
        else error = { message: j?.error || `HTTP ${res.status}` };
      } catch (e) {
        error = { message: (e as Error).message };
      }

      if (error) {
        console.warn('Erreur chargement produits Supabase:', error.message);
        return [];
      }

      // Lecture réussie mais VIDE traitée comme les autres : deuxième
      // paramètre `true` (voir son commentaire dans store.ts) — sans lui, un
      // catalogue qui vient de se vider entièrement (tout rejeté) laissait
      // les anciens produits affichés indéfiniment chez qui les avait déjà
      // chargés. Une erreur réseau/RLS, elle, ne touche pas au cache (`return`
      // plus haut) : on ne veut vider l'affichage que sur une réponse fiable.
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
          resellerCommissionProposee: Number(p.commission_proposee) || 0,
          modePrix: p.mode_prix === 'gros' ? 'gros' : 'fixe',
          prixConseille: p.prix_conseille == null ? null : Number(p.prix_conseille),
          typeOffre: normaliserTypeOffre(p.type_offre),
          modeRemise: normaliserModeRemise(p.mode_remise),
          fraisRemise: Number(p.frais_remise) || 0,
          offreInclus: p.offre_inclus || null,
          modeCommande: p.mode_commande === 'devis' ? 'devis' : 'achat',
          etapes: normaliserEtapes(p.etapes),
          prixCatalogue: p.prix_catalogue && Number(p.prix_catalogue.prix) > 0
            ? { prix: Number(p.prix_catalogue.prix), mention: p.prix_catalogue.mention === 'partenaire' ? 'partenaire' : 'des' }
            : null,
          sugubaMargin: Math.max(0, Number(p.public_price || 0) - Number(p.supplier_price || 0) - Number(p.reseller_commission || 0)),
          stockQuantity: Number(p.stock ?? 0),
          warrantyMonths: 0, // Aucune colonne garantie en base : ne jamais en afficher une inventée.
          preparationDelayHours: 2,
          stockLocationType: 'supplier',
          stockLocationAddress: 'Bamako',
          status: (p.status as any) || 'approved',
          marketingPitch: `🔥 NOUVEAUTÉ : ${p.name}\nQualité garantie !\nLivraison rapide à Bamako.`,
          createdAt: p.created_at || new Date().toISOString(),
        }));

        sugubaStore.setProductsFromCloud(cloudProducts, true);
        return cloudProducts;
      }
      sugubaStore.setProductsFromCloud([], true);
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
  // N'appelle /api/orders/feed que pour les rôles qu'elle sert réellement —
  // la route renvoie 401 pour tout le reste (voir son commentaire). Évite le
  // 401 systématique constaté en vérification phase 9 sur l'accueil et le
  // suivi, où AUCUN visiteur n'est admin/livreur/revendeur.
  public async fetchOrdersFromCloudSiEligible(role: string | null | undefined): Promise<Order[]> {
    if (!role || !['admin', 'driver', 'reseller'].includes(role)) return [];
    return this.fetchOrdersFromCloud();
  }

  public async fetchOrdersFromCloud(): Promise<Order[]> {
    const identity = sugubaStore.getState().currentUser;
    const generation = privateSessionGeneration();
    const request = ++this.ordersRequest;
    const stillCurrent = () => { const current = sugubaStore.getState().currentUser; return request === this.ordersRequest && generation === privateSessionGeneration() && current.id === identity.id && current.role === identity.role; };
    sugubaStore.setOrdersSync('loading');
    try {
      const res = await fetch('/api/orders/feed');
      if (!res.ok) {
        if (stillCurrent()) {
          if ([401,403].includes(res.status)) sugubaStore.setOrdersFromCloud([]);
          sugubaStore.setOrdersSync([401,403].includes(res.status) ? 'forbidden' : 'error');
        }
        // 401 attendu tant qu'aucune session admin/livreur n'est active —
        // pas une erreur, juste "rien à afficher pour ce visiteur".
        return [];
      }
      const json = await res.json();
      if (!stillCurrent()) return [];
      if (!Array.isArray(json.orders) || json.cloud !== true) { sugubaStore.setOrdersSync('error'); return []; }
      const data = json.orders as any[];
      sugubaStore.setOrdersSync('ready');

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
          deliveryFee: Number(o.delivery_fee ?? 0),
          totalAmount: Number(o.total_amount || 0),
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          city: o.city || 'Bamako',
          neighborhood: o.neighborhood || 'Bamako',
          landmark: o.landmark,
          deliveryNotes: o.delivery_notes,
          status: o.status || 'pending_call',
          failedOtpAttempts: Number(o.failed_otp_attempts || 0),
          paymentMethod: o.payment_method || 'cash_on_delivery',
          modeRemise: modeRemiseCommande(o.pricing_snapshot),
          paymentCollected: Boolean(o.payment_collected),
          driverId: o.assigned_driver_id,
          driverName: o.assigned_driver_name,
          createdAt: o.created_at || new Date().toISOString(),
          deliveredAt: o.delivered_at,
          pickedUpAt: o.picked_up_at || undefined,
          pickupLocation: o.pickup_location || null,
          clientPosition: o.client_position || null,
        }));

        sugubaStore.setOrdersFromCloud(cloudOrders);
        return cloudOrders;
      }
      sugubaStore.setOrdersFromCloud([]);
      return [];
    } catch (err) {
      if (stillCurrent()) sugubaStore.setOrdersSync('error');
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

  // Même envoi, avec le résultat de la publication automatique (publié ou
  // non, prix calculé, raison) — voir src/lib/publication-auto.ts.
  public async pushProductToCloudDetail(product: Product): Promise<{
    ok: boolean;
    publication?: { publie: boolean; prix?: number; commission?: number; raison?: string };
  }> {
    try {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.success !== false, publication: json.publication };
    } catch (err) {
      console.warn('Exception push produit:', err);
      return { ok: false };
    }
  }

  // 5. Mise à jour d'une commande existante, avec une session interne.
  // La création passe exclusivement par /api/orders/create.
  public async pushOrderToCloud(order: Order): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });

      if (!res.ok) {
        // Conserver une trace de la mise à jour interne refusée.
        const detail = await res.json().catch(() => ({} as any));
        console.error(
          `[SYNC] Commande ${order.orderNumber} NON mise à jour (HTTP ${res.status}) :`,
          detail?.error || 'raison inconnue',
        );
        return false;
      }
      const json = await res.json().catch(() => null);
      return json?.success === true && json?.cloud === true;
    } catch (err) {
      console.error(`[SYNC] Commande ${order.orderNumber} NON mise à jour (réseau) :`, err);
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
}

export const cloudSyncService = new CloudSyncService();
