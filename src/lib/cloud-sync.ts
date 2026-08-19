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
      // Écouteur en temps réel sur les Commandes
      supabase
        .channel('suguba_realtime_orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              this.syncOrderFromCloud(payload.new);
            } else if (payload.eventType === 'UPDATE') {
              this.syncOrderUpdateFromCloud(payload.new);
            }
          }
        )
        .subscribe();

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
          images: Array.isArray(p.images) && p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'],
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

  // 3. Récupérer toutes les commandes depuis Supabase
  public async fetchOrdersFromCloud(): Promise<Order[]> {
    if (!this.isCloudActive() || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erreur chargement commandes Supabase:', error.message);
        return [];
      }

      if (data && data.length > 0) {
        const cloudOrders: Order[] = data.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          productId: o.product_id || '',
          productName: o.product_name,
          productImage: o.product_image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
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

  // 4. Push d'un produit vers Supabase
  public async pushProductToCloud(product: Product): Promise<boolean> {
    if (!this.isCloudActive() || !supabase) return false;

    try {
      const { error } = await supabase.from('products').upsert({
        id: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        description: product.description,
        supplier_price: product.supplierPrice,
        public_price: product.publicPrice,
        reseller_commission: product.resellerCommission,
        stock: product.stockQuantity,
        images: product.images,
        status: product.status,
        supplier_id: product.supplierId,
        supplier_name: product.supplierName,
        created_at: product.createdAt,
      });

      if (error) {
        console.warn('Erreur push produit Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exception push produit:', err);
      return false;
    }
  }

  // 5. Push d'une commande vers Supabase
  public async pushOrderToCloud(order: Order): Promise<boolean> {
    if (!this.isCloudActive() || !supabase) return false;

    try {
      const { error } = await supabase.from('orders').upsert({
        id: order.id,
        order_number: order.orderNumber,
        product_id: order.productId,
        product_name: order.productName,
        product_image: order.productImage,
        reseller_id: order.resellerId,
        reseller_name: order.resellerName,
        reseller_code: order.resellerCode,
        reseller_commission: order.resellerCommission,
        quantity: order.quantity,
        unit_price: order.unitPrice,
        total_product_amount: order.totalProductAmount,
        delivery_fee: order.deliveryFee,
        total_amount: order.totalAmount,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        city: order.city,
        neighborhood: order.neighborhood,
        landmark: order.landmark,
        delivery_notes: order.deliveryNotes,
        status: order.status,
        delivery_otp: order.deliveryOtp,
        payment_method: order.paymentMethod,
        payment_collected: order.paymentCollected,
        assigned_driver_id: order.driverId,
        assigned_driver_name: order.driverName,
        created_at: order.createdAt,
      });

      if (error) {
        console.warn('Erreur push commande Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exception push commande:', err);
      return false;
    }
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
        productImage: cloudOrder.product_image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
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
      images: Array.isArray(cloudProduct.images) ? cloudProduct.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'],
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
