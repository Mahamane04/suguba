import { QUANTITE_MAX } from './pricing';

/** REQ-013 : seules les intentions du client traversent le réseau. */
export interface OrderInput {
  productId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  city: string;
  neighborhood: string;
  landmark: string;
  deliveryNotes?: string;
  resellerCode?: string;
  pickupPointId?: string;
  promoCode?: string;
}

export function normaliserCommande(value: unknown): OrderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Commande invalide.');
  }
  const input = value as Record<string, unknown>;
  const texte = (key: string, label: string, max: number, required = true): string => {
    const value = input[key];
    if (!required && (value === undefined || value === null)) return '';
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
      throw new Error(`${label} invalide.`);
    }
    return value.trim();
  };
  if (!Number.isInteger(input.quantity) || Number(input.quantity) < 1 || Number(input.quantity) > QUANTITE_MAX) {
    throw new Error(`Choisissez une quantité entre 1 et ${QUANTITE_MAX}.`);
  }
  const phone = texte('customerPhone', 'Numéro de téléphone', 30).replace(/[\s().-]/g, '');
  if (!/^\+?\d{8,15}$/.test(phone)) throw new Error('Numéro de téléphone invalide.');
  return {
    productId: texte('productId', 'Produit', 150),
    quantity: Number(input.quantity),
    customerName: texte('customerName', 'Nom', 120),
    customerPhone: phone,
    city: texte('city', 'Ville', 80),
    neighborhood: texte('neighborhood', 'Quartier', 200),
    landmark: texte('landmark', 'Repère', 500),
    deliveryNotes: texte('deliveryNotes', 'Instructions', 1000, false) || undefined,
    resellerCode: texte('resellerCode', 'Code revendeur', 80, false).toUpperCase() || undefined,
    pickupPointId: texte('pickupPointId', 'Point relais', 100, false) || undefined,
    promoCode: texte('promoCode', 'Code promo', 80, false).toUpperCase() || undefined,
  };
}
