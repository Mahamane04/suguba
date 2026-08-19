'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import { sugubaStore } from './store';
import { Order, Product, Commission, Withdrawal, SavTicket } from '@/types';

class CloudSyncService {
  private isListening = false;

  public isCloudActive(): boolean {
    return isSupabaseConfigured && supabase !== null;
  }

  // Initialise les abonnements Websocket temps réel
  public initRealtimeSync(): void {
    if (!this.isCloudActive() || this.isListening || !supabase) {
      return;
    }

    try {
      this.isListening = true;

      // Écouteur en temps réel sur les Commandes
      supabase
        .channel('suguba_realtime_orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              console.log('📦 Nouvelle commande reçue via Cloud Realtime:', payload.new);
              // Mise à jour de l'état local réactif
              this.syncOrderFromCloud(payload.new as any);
            } else if (payload.eventType === 'UPDATE') {
              console.log('🔄 Mise à jour commande via Cloud Realtime:', payload.new);
              this.syncOrderUpdateFromCloud(payload.new as any);
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
            console.log('🛍️ Mise à jour produit Cloud:', payload);
          }
        )
        .subscribe();

      console.log('🟢 Synchronisation Cloud Supabase Websockets activée avec succès !');
    } catch (err) {
      console.warn('Erreur initialisation Supabase Realtime:', err);
    }
  }

  // Synchronisation d'une commande insérée depuis le Cloud
  private syncOrderFromCloud(cloudOrder: any): void {
    const localState = sugubaStore.getState();
    const exists = localState.orders.some(o => o.id === cloudOrder.id || o.orderNumber === cloudOrder.order_number);
    
    if (!exists) {
      const formattedOrder: Order = {
        id: cloudOrder.id,
        orderNumber: cloudOrder.order_number,
        productId: cloudOrder.product_id,
        productName: cloudOrder.product_name,
        productImage: cloudOrder.product_image || '/images/products/placeholder.jpg',
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

      // Notification sonore ou vibration in-app
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (_) {}
      }
    }
  }

  private syncOrderUpdateFromCloud(cloudOrder: any): void {
    // Synchronise la mise à jour
    console.log('Commande synchronisée:', cloudOrder.order_number);
  }

  // Push d'une nouvelle commande vers le Cloud
  public async pushOrderToCloud(order: Order): Promise<boolean> {
    if (!this.isCloudActive() || !supabase) {
      return false;
    }

    try {
      const { error } = await supabase.from('orders').insert({
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
        created_at: order.createdAt,
      });

      if (error) {
        console.warn('Erreur push commande Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Erreur réseau push Cloud:', err);
      return false;
    }
  }
}

export const cloudSyncService = new CloudSyncService();
