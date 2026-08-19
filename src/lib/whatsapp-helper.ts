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
  },

  /**
   * 4. Relance WhatsApp Client Injoignable (Français)
   */
  getUnreachableFollowUpLink(order: Order): string {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const message = `👋 *Bonjour ${order.customerName}, c'est le Service Client Suguba Mali.*\n\n` +
      `Nous avons tenté de vous joindre par téléphone pour confirmer votre commande *#${order.orderNumber}* :\n` +
      `📦 *Produit :* ${order.productName}\n` +
      `💰 *Montant :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA (Paiement à la livraison)\n` +
      `📍 *Quartier :* ${order.neighborhood} (${order.landmark})\n\n` +
      `👉 *Êtes-vous toujours disponible pour être livré aujourd'hui ?*\n` +
      `_Répondez simplement *OUI* à ce message ou indiquez-nous l'heure qui vous arrange pour l'envoi du livreur moto._`;

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  },

  /**
   * 5. Relance WhatsApp Client Injoignable (Bambara / Bamanankan)
   */
  getBambaraFollowUpLink(order: Order): string {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const message = `👋 *I ni ce ${order.customerName}, Suguba Mali de bɛ weleli kɛ.*\n\n` +
      `An ye i wele telefone kan nka an m'a sɔrɔ ka i ka commande #${order.orderNumber} lajɛ :\n` +
      `📦 *Produit :* ${order.productName}\n` +
      `💰 *Sɔngɔ :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA (I bɛ sara minɛ tuma de la)\n` +
      `📍 *Sigiyɔrɔ :* ${order.neighborhood}\n\n` +
      `👉 *Yala an bɛ se ka moto livreur bila ka na i fɛ bi wa ?*\n` +
      `_I ka *AWO* jaabi bila nin message kɔnɔ walima waati min bɛ i sɔrɔ._`;

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  },

  /**
   * 6. Rappel WhatsApp Jour de Livraison
   */
  getDeliveryReminderLink(order: Order): string {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const message = `🛵 *SUGUBA.ML — Votre Colis #${order.orderNumber} est en route !*\n\n` +
      `Bonjour *${order.customerName}*,\n` +
      `Votre livreur arrive aujourd'hui à votre repère (*${order.landmark}*).\n\n` +
      `💵 *Montant exact à préparer :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA\n` +
      `🔑 *Votre Code Secret OTP :* *${order.deliveryOtp}*\n\n` +
      `En cas de question ou retard, contactez notre centre d'opérations au *+223 89 46 00 00*.`;

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  }
};
