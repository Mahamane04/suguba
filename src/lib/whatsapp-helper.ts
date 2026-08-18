import { Order } from '@/types';

/**
 * Générateur de Liens et Notifications WhatsApp Automatisées — Suguba Mali
 */
export const whatsappHelper = {
  /**
   * 1. Lien WhatsApp pour le client : Recevoir les alertes et le reçu de commande
   */
  getCustomerReceiptLink(order: Order, appUrl: string = 'https://app.sugubaml.com'): string {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const trackingUrl = `${appUrl}/track/${order.orderNumber}`;
    
    const message = `🎉 *SUGUBA.ML — Reçu de votre Commande #${order.orderNumber}*\n\n` +
      `Bonjour *${order.customerName}*,\n` +
      `Votre commande a bien été enregistrée sur Suguba !\n\n` +
      `📦 *Produit :* ${order.productName} (x${order.quantity})\n` +
      `💰 *Total à payer :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA\n` +
      `📍 *Destination :* ${order.neighborhood} (${order.landmark})\n\n` +
      `🔑 *VOTRE CODE SECRET DE LIVRAISON :* *${order.deliveryOtp}*\n` +
      `⚠️ _Donnez ce code UNIQUEMENT au livreur lors de la remise du colis._\n\n` +
      `📲 *Suivre ma commande en direct :* ${trackingUrl}`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  },

  /**
   * 2. Lien WhatsApp pour contacter le support client Suguba Ops (+223 89 46 00 00)
   */
  getSupportChatLink(orderNumber?: string): string {
    const supportPhone = '22389460000';
    const text = orderNumber
      ? `Bonjour Suguba Support, j'ai une question concernant ma commande #${orderNumber}.`
      : `Bonjour Suguba Support, j'ai besoin d'une assistance.`;
    return `https://api.whatsapp.com/send?phone=${supportPhone}&text=${encodeURIComponent(text)}`;
  },

  /**
   * 3. Message d'assignation envoyé au coursier moto
   */
  getDriverDispatchMessage(order: Order, pickupAddress: string): string {
    return `🛵 *NOUVELLE COURSE ASSIGNÉE SUGUBA #${order.orderNumber}*\n\n` +
      `📦 *Produit :* ${order.productName} (x${order.quantity})\n` +
      `📍 *1. Récupération :* ${pickupAddress}\n` +
      `📍 *2. Livraison :* ${order.customerName} (${order.customerPhone}) à ${order.neighborhood} (Repère : ${order.landmark})\n` +
      `💰 *Montant à encaisser :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA\n` +
      `🔑 *Validation :* Exiger le Code OTP du client.`;
  }
};
