'use client';

import { useState, useEffect } from 'react';
import { 
  User, Product, Order, Commission, Withdrawal, AuditLog, 
  ResellerProfile, SupplierProfile, DriverProfile, DiasporaProfile, UserRole, SavTicket, OrderStatus, ResellerTier 
} from '@/types';
import { 
  INITIAL_USERS, INITIAL_SUPPLIERS, INITIAL_RESELLERS, INITIAL_DRIVERS, INITIAL_DIASPORA,
  INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_COMMISSIONS, INITIAL_WITHDRAWALS,
  INITIAL_AUDIT_LOGS, INITIAL_SAV_TICKETS 
} from './mock-data';
import { cloudSyncService } from './cloud-sync';
import { genererNumeroCommande } from './order-number';

// Passé de _v1 à _v2 le 2026-08-21, en même temps que le retrait du catalogue
// de démo (mock-data.ts). hydrateFromLocalStorage écrase les valeurs par
// défaut par le contenu du cache : sans changer cette clé, tout visiteur déjà
// venu aurait conservé indéfiniment les 22 produits fictifs, même purgés du
// code et de la base. Changer la clé rend les anciens caches inertes.
// À rebumper à chaque suppression de données que le cache pourrait ressusciter.
const STORAGE_KEY = 'suguba_platform_state_v2';

export interface SugubaState {
  currentUser: User;
  users: User[];
  suppliers: SupplierProfile[];
  resellers: ResellerProfile[];
  drivers: DriverProfile[];
  diasporaProfiles: DiasporaProfile[];
  products: Product[];
  orders: Order[];
  commissions: Commission[];
  withdrawals: Withdrawal[];
  auditLogs: AuditLog[];
  savTickets: SavTicket[];
}

// Corrige BUG-010 : cette fonction lisait `localStorage` pendant le calcul
// de l'état initial. Sur le serveur, `window` n'existe pas, donc le premier
// rendu SSR utilise toujours l'état par défaut ; mais dans le bundle
// navigateur, ce module est réévalué et `getDefaultState` s'exécutait AVANT
// le premier rendu React, donc le tout premier rendu client reflétait déjà
// le localStorage — différent du HTML envoyé par le serveur. React déclare
// alors un mismatch d'hydratation. La donnée persistée n'est désormais lue
// qu'après le montage (`hydrateFromLocalStorage`, appelée dans le
// `useEffect` de `useSugubaStore`), jamais pendant le rendu initial.
const getDefaultState = (): SugubaState => ({
  currentUser: INITIAL_USERS[3], // Default to Moussa Coulibaly (Revendeur)
  users: INITIAL_USERS,
  suppliers: INITIAL_SUPPLIERS,
  resellers: INITIAL_RESELLERS,
  drivers: INITIAL_DRIVERS,
  diasporaProfiles: INITIAL_DIASPORA,
  products: INITIAL_PRODUCTS,
  orders: INITIAL_ORDERS,
  commissions: INITIAL_COMMISSIONS,
  withdrawals: INITIAL_WITHDRAWALS,
  auditLogs: INITIAL_AUDIT_LOGS,
  savTickets: INITIAL_SAV_TICKETS,
});

let globalState = getDefaultState();
let hasHydratedFromStorage = false;
const listeners = new Set<() => void>();

function notify() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
  }
  listeners.forEach((listener) => listener());
}

export const sugubaStore = {
  getState: () => globalState,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // À appeler une seule fois, côté client, après le montage — jamais
  // pendant le rendu (voir le commentaire sur getDefaultState ci-dessus).
  hydrateFromLocalStorage: () => {
    if (typeof window === 'undefined' || hasHydratedFromStorage) return;
    hasHydratedFromStorage = true;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      globalState = {
        ...globalState,
        ...parsed,
        diasporaProfiles: parsed.diasporaProfiles || INITIAL_DIASPORA,
        savTickets: parsed.savTickets || INITIAL_SAV_TICKETS,
      };
      listeners.forEach((listener) => listener());
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  },

  // Synchronise le solde de démo local avec le vrai solde calculé côté
  // serveur (voir /api/reseller/balance et le grand-livre de commissions
  // dans supabase/schema.sql). Ne fait rien d'autre que remplacer ces deux
  // chiffres — le reste du profil revendeur (code de parrainage, palier,
  // etc.) reste celui des données de démo tant que ce n'est pas aussi
  // branché sur Supabase.
  syncResellerBalance: (resellerId: string, availableBalance: number, pendingBalance: number) => {
    globalState = {
      ...globalState,
      resellers: globalState.resellers.map(r =>
        r.id === resellerId ? { ...r, availableBalance, pendingBalance } : r
      ),
    };
    notify();
  },

  // Auth / Role Switcher
  switchUser: (userId: string) => {
    const user = globalState.users.find(u => u.id === userId);
    if (user) {
      globalState = { ...globalState, currentUser: user };
      notify();
    }
  },

  switchRole: (role: UserRole) => {
    const user = globalState.users.find(u => u.role === role);
    if (user) {
      globalState = { ...globalState, currentUser: user };
      notify();
    }
  },

  // ── Cloud Sync Ingestion Handlers ──
  setProductsFromCloud: (cloudProducts: Product[]) => {
    if (!cloudProducts || cloudProducts.length === 0) return;
    // Fusionner les produits du cloud en évitant les doublons
    const existingMap = new Map(globalState.products.map(p => [p.slug, p]));
    cloudProducts.forEach(p => existingMap.set(p.slug, p));
    globalState = {
      ...globalState,
      products: Array.from(existingMap.values()),
    };
    notify();
  },

  setOrdersFromCloud: (cloudOrders: Order[]) => {
    if (!cloudOrders || cloudOrders.length === 0) return;
    const existingMap = new Map(globalState.orders.map(o => [o.orderNumber, o]));
    cloudOrders.forEach(o => existingMap.set(o.orderNumber, o));
    globalState = {
      ...globalState,
      orders: Array.from(existingMap.values()),
    };
    notify();
  },

  addProductFromCloud: (product: Product) => {
    const exists = globalState.products.some(p => p.id === product.id || p.slug === product.slug);
    if (!exists) {
      globalState = {
        ...globalState,
        products: [product, ...globalState.products],
      };
      notify();
    }
  },

  addOrderFromCloud: (order: Order) => {
    const exists = globalState.orders.some(o => o.id === order.id || o.orderNumber === order.orderNumber);
    if (!exists) {
      globalState = {
        ...globalState,
        orders: [order, ...globalState.orders],
      };
      notify();
    }
  },

  updateOrderStatusFromCloud: (orderIdOrNumber: string, status: OrderStatus, paymentCollected?: boolean) => {
    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber) {
          return {
            ...o,
            status,
            paymentCollected: paymentCollected !== undefined ? paymentCollected : o.paymentCollected,
          };
        }
        return o;
      }),
    };
    notify();
  },

  // 1. Fournisseur : Ajouter Produit
  //
  // Retourne `cloud: false` si la synchro Supabase échoue (session expirée,
  // réseau) — sans ça, un appelant qui ignore le résultat afficherait "produit
  // soumis avec succès" alors que rien n'est arrivé en base, invisible pour
  // l'admin (qui modère via /api/admin/products/pending, jamais le
  // localStorage du fournisseur). Voir src/app/supplier/products/new/page.tsx.
  addSupplierProduct: async (data: {
    supplierId: string;
    supplierName: string;
    name: string;
    category: string;
    description: string;
    images: string[];
    supplierPrice: number;
    stockQuantity: number;
    warrantyMonths: number;
    preparationDelayHours: number;
    stockLocationAddress: string;
    marketingPitch?: string;
    /** Part revendeur par vente choisie par le fournisseur (0 = Suguba décide). */
    resellerCommissionProposee?: number;
  }): Promise<{
    product: Product;
    cloud: boolean;
    publication?: { publie: boolean; prix?: number; commission?: number; raison?: string };
  }> => {
    const newProduct: Product = {
      id: `prd-${Date.now()}`,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category: data.category,
      description: data.description,
      images: data.images, // BUG-011 : plus de repli Unsplash — voir ProductImage
      supplierPrice: Number(data.supplierPrice),
      publicPrice: Number(data.supplierPrice) * 1.3, // Prix suggéré temporaire
      resellerCommission: Math.round(Number(data.supplierPrice) * 0.1),
      resellerCommissionProposee: Number(data.resellerCommissionProposee) || 0,
      sugubaMargin: Math.round(Number(data.supplierPrice) * 0.2),
      stockQuantity: Number(data.stockQuantity),
      warrantyMonths: Number(data.warrantyMonths) || 0,
      preparationDelayHours: Number(data.preparationDelayHours) || 2,
      stockLocationType: 'supplier',
      stockLocationAddress: data.stockLocationAddress,
      status: 'submitted', // Passe obligatoirement en vérification Suguba
      marketingPitch: data.marketingPitch || `🔥 NOUVEAUTÉ : ${data.name}\nQualité garantie !\nLivraison disponible à Bamako.`,
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      products: [newProduct, ...globalState.products],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: data.supplierName,
          role: 'supplier',
          action: 'SUBMIT_PRODUCT',
          entityType: 'product',
          entityId: newProduct.id,
          details: `Nouveau produit "${newProduct.name}" soumis à modération (Prix Fournisseur: ${newProduct.supplierPrice} FCFA).`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    let cloud = false;
    let publication: { publie: boolean; prix?: number; commission?: number; raison?: string } | undefined;
    if (typeof window !== 'undefined') {
      const envoi = await cloudSyncService.pushProductToCloudDetail(newProduct);
      cloud = envoi.ok;
      publication = envoi.publication;
      // Publication automatique réussie : la mémoire locale reprend le prix et
      // la commission du SERVEUR, pas l'estimation « fournisseur × 1,3 ».
      if (publication?.publie) {
        globalState = {
          ...globalState,
          products: globalState.products.map((p) => (p.id === newProduct.id
            ? { ...p, status: 'approved', publicPrice: publication!.prix ?? p.publicPrice, resellerCommission: publication!.commission ?? 0 }
            : p)),
        };
      }
    }
    notify();
    return { product: newProduct, cloud, publication };
  },

  // 2. Admin : Modérer & Fixer l'économie du Produit (Suguba contrôle le modèle)
  approveProduct: (
    productId: string,
    publicPrice: number,
    resellerCommission: number,
    sugubaMargin: number,
    adminName: string
  ) => {
    let approvedProduct: Product | undefined;
    globalState = {
      ...globalState,
      products: globalState.products.map(p => {
        if (p.id === productId) {
          approvedProduct = {
            ...p,
            publicPrice: Number(publicPrice),
            resellerCommission: Number(resellerCommission),
            sugubaMargin: Number(sugubaMargin),
            status: 'approved',
          };
          return approvedProduct;
        }
        return p;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'APPROVE_PRODUCT_PRICING',
          entityType: 'product',
          entityId: productId,
          details: `Produit approuvé. Prix public: ${publicPrice} F, Commission Revendeur: ${resellerCommission} F, Marge Suguba: ${sugubaMargin} F.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    if (approvedProduct && typeof window !== 'undefined') {
      cloudSyncService.pushProductToCloud(approvedProduct).catch(() => {});
    }
    notify();
  },

  // 3. Client ou Revendeur : Créer une commande
  createOrder: (data: {
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
    /**
     * Devis obtenu de /api/orders/quote. S'il est fourni, la commande locale en
     * reprend les montants : ce sont ceux que le serveur enregistrera, calculés
     * par la même fonction. Sans lui (écran hors ligne, ancien appelant), les
     * valeurs locales s'appliquent et le serveur les corrigera de toute façon.
     */
    devis?: { prixUnitaire: number; montantArticles: number; fraisLivraison: number; remise: number; total: number };
  }) => {
    const product = globalState.products.find(p => p.id === data.productId);
    if (!product) throw new Error('Produit introuvable');

    // Uniquement le code explicitement fourni par l'appelant — jamais de
    // repli sur globalState.currentUser. Ce repli existait pour la commande
    // manuelle du dashboard revendeur (CreateOrderModal), mais ce composant
    // passe déjà son propre resellerCode explicitement ; le repli était donc
    // mort pour cet usage et actif uniquement sur le parcours public
    // anonyme (/p/[slug]) — où currentUser vaut toujours le revendeur
    // fictif de démo par défaut. Conséquence réelle : toute commande passée
    // sans lien de parrainage attribuait quand même une commission (sur le
    // champ orders.reseller_commission) à ce faux revendeur. Découvert le
    // 2026-09-08 en testant le parcours visiteur sans compte.
    const reseller = data.resellerCode
      ? globalState.resellers.find(r => r.referralCode.toUpperCase() === data.resellerCode?.toUpperCase())
      : undefined;

    const resellerUser = reseller ? globalState.users.find(u => u.id === reseller?.userId) : undefined;
    const orderNumber = genererNumeroCommande();
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Code secret à 4 chiffres

    // Les montants ne font plus foi ici : /api/orders/sync les recalcule
    // côté serveur à partir du produit en base. On affiche le devis serveur
    // quand on l'a, pour que l'écran de confirmation montre le vrai total.
    const unitPrice = data.devis?.prixUnitaire ?? (product.publicPrice || product.supplierPrice);
    const totalProductAmount = data.devis?.montantArticles ?? unitPrice * data.quantity;
    const deliveryFee = data.devis?.fraisLivraison ?? 1500;
    const discountAmount = data.devis?.remise ?? 0;
    const totalAmount = data.devis?.total ?? totalProductAmount + deliveryFee;
    const commissionAmount = (product.resellerCommission || 0) * data.quantity;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      productId: product.id,
      productName: product.name,
      productImage: product.images[0],
      resellerId: reseller?.id,
      resellerName: resellerUser?.fullName,
      resellerCode: reseller?.referralCode,
      resellerCommission: commissionAmount,
      quantity: data.quantity,
      unitPrice,
      totalProductAmount,
      deliveryFee,
      totalAmount,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      city: data.city || 'Bamako',
      neighborhood: data.neighborhood,
      landmark: data.landmark,
      deliveryNotes: data.deliveryNotes,
      pickupPointId: data.pickupPointId,
      promoCode: data.promoCode,
      discountAmount,
      status: 'pending_call', // En attente d'appel de confirmation Suguba
      deliveryOtp: otp,
      paymentMethod: 'cash_on_delivery',
      paymentCollected: false,
      createdAt: new Date().toISOString(),
    };

    // Créer la commission potentielle si un revendeur est rattaché
    let updatedCommissions = [...globalState.commissions];
    if (reseller && commissionAmount > 0) {
      // Système de Réputation Suguba : Nouveau = 14 jours, Vérifié = 7 jours, VIP = 3 jours
      const safetyDays = reseller.tier === 'vip' ? 3 : reseller.tier === 'verified' ? 7 : 14;
      const newCommission: Commission = {
        id: `com-${Date.now()}`,
        commissionCode: `COM-${Math.floor(100 + Math.random() * 900)}`,
        resellerId: reseller.id,
        resellerName: resellerUser?.fullName || 'Revendeur',
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        productName: product.name,
        amount: commissionAmount,
        status: 'potential',
        safetyWindowDays: safetyDays,
        unlockAt: new Date(Date.now() + safetyDays * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      updatedCommissions = [newCommission, ...updatedCommissions];
    }

    globalState = {
      ...globalState,
      orders: [newOrder, ...globalState.orders],
      commissions: updatedCommissions,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: resellerUser?.fullName || data.customerName,
          role: resellerUser ? 'reseller' : 'customer',
          action: 'CREATE_ORDER',
          entityType: 'order',
          entityId: newOrder.id,
          details: `Commande ${orderNumber} créée pour ${data.customerName} (${data.neighborhood}). Montant: ${totalAmount} FCFA. Code OTP généré: ${otp}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    // Sync order to Supabase PostgreSQL Cloud in background
    if (typeof window !== 'undefined') {
      cloudSyncService.pushOrderToCloud(newOrder).catch((err) => {
        console.warn('Background Supabase cloud push non-blocking error:', err);
      });
    }
    notify();
    return newOrder;
  },

  // 4. Admin : Valider l'appel téléphonique de confirmation
  // Pousse vers Supabase : sans cela, l'admin voyait la commande passer en
  // « confirmée » et rejoindre la file de dispatch dans SON navigateur, alors
  // qu'en base elle restait indéfiniment en `pending_call`. Sur un autre
  // appareil — ou après un simple rechargement — la commande retombait dans la
  // file d'appels, et aucun livreur ne pouvait jamais lui être assigné.
  confirmOrderCall: (orderId: string, adminName: string) => {
    let commandeConfirmee: typeof globalState.orders[number] | undefined;

    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          commandeConfirmee = {
            ...o,
            status: 'confirmed',
            callVerifiedBy: adminName,
            callVerifiedAt: new Date().toISOString(),
          };
          return commandeConfirmee;
        }
        return o;
      }),
      commissions: globalState.commissions.map(c => {
        if (c.orderId === orderId) {
          return { ...c, status: 'pending' };
        }
        return c;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'CALL_CONFIRMED',
          entityType: 'order',
          entityId: orderId,
          details: `Appel téléphonique client confirmé pour la commande ${orderId}. Prêt pour dispatching livreur.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    if (commandeConfirmee && typeof window !== 'undefined') {
      cloudSyncService.pushOrderToCloud(commandeConfirmee).catch(() => {});
    }
    notify();
  },

  // 5. Admin : Assigner un Livreur
  //
  // Prend directement l'identité du livreur (fournie par l'appelant depuis
  // une vraie liste, voir /api/admin/drivers/active) plutôt que de la
  // chercher dans state.drivers — ce tableau ne contient que des livreurs
  // fictifs (mock-data.ts), jamais les vrais comptes livreur. Pousse aussi
  // vers Supabase (l'ancienne version ne faisait que notify() local : un
  // dispatch n'atteignait jamais l'appareil du vrai livreur assigné).
  assignDriver: (orderId: string, driverId: string, driverName: string, driverPhone: string | undefined, adminName: string) => {
    let updatedOrder: typeof globalState.orders[number] | undefined;

    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          updatedOrder = {
            ...o,
            driverId,
            driverName,
            driverPhone,
            status: 'dispatched',
          };
          return updatedOrder;
        }
        return o;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'ASSIGN_DRIVER',
          entityType: 'order',
          entityId: orderId,
          details: `Livreur assigné : ${driverName} (${driverPhone || 'téléphone non renseigné'}) pour la commande ${orderId}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    if (updatedOrder && typeof window !== 'undefined') {
      cloudSyncService.pushOrderToCloud(updatedOrder).catch(() => {});
    }
    notify();
  },


  // 9. Revendeur : Demander un retrait Mobile Money ou en Agence
  requestWithdrawal: (data: {
    resellerId: string;
    amount: number;
    payoutProvider: 'Orange Money' | 'Moov Money' | 'Mobi Cash' | 'Agence Suguba';
    payoutPhone: string;
  }) => {
    const reseller = globalState.resellers.find(r => r.id === data.resellerId);
    if (!reseller) throw new Error('Revendeur introuvable');

    if (data.amount < 5000) {
      throw new Error('Le montant minimum de retrait est de 5 000 FCFA');
    }

    if (data.amount > reseller.availableBalance) {
      throw new Error('Solde disponible insuffisant');
    }

    const resellerUser = globalState.users.find(u => u.id === reseller.userId);
    const isAgency = data.payoutProvider === 'Agence Suguba';
    const pickupCode = isAgency ? `SUG-${Math.floor(1000 + Math.random() * 9000)}` : undefined;
    const agencyLocation = isAgency ? 'Agence Centrale Suguba — Hamdallaye ACI 2000, Bamako' : undefined;

    const newWithdrawal: Withdrawal = {
      id: `wth-${Date.now()}`,
      withdrawalCode: `WTH-${Math.floor(1000 + Math.random() * 9000)}`,
      resellerId: reseller.id,
      resellerName: resellerUser?.fullName || 'Revendeur',
      amount: data.amount,
      payoutProvider: data.payoutProvider,
      payoutPhone: data.payoutPhone,
      pickupCode,
      agencyLocation,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      resellers: globalState.resellers.map(r => {
        if (r.id === data.resellerId) {
          return {
            ...r,
            availableBalance: r.availableBalance - data.amount,
          };
        }
        return r;
      }),
      withdrawals: [newWithdrawal, ...globalState.withdrawals],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: resellerUser?.fullName || 'Revendeur',
          role: 'reseller',
          action: 'REQUEST_WITHDRAWAL',
          entityType: 'withdrawal',
          entityId: newWithdrawal.id,
          details: isAgency
            ? `Demande de retrait espèces en agence de ${data.amount} FCFA. Code Guichet généré : ${pickupCode}.`
            : `Demande de retrait de ${data.amount} FCFA vers ${data.payoutProvider} (${data.payoutPhone}).`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    if (typeof window !== 'undefined') {
      cloudSyncService.pushPayoutToCloud({
        id: newWithdrawal.id,
        withdrawalCode: newWithdrawal.withdrawalCode,
        resellerName: newWithdrawal.resellerName,
        amount: newWithdrawal.amount,
        payoutProvider: newWithdrawal.payoutProvider,
        payoutPhone: newWithdrawal.payoutPhone,
      }).catch(() => {});
    }
    notify();
    return newWithdrawal;
  },

  // 10. Admin : Valider le virement Mobile Money ou décaissement Guichet
  processWithdrawal: (withdrawalId: string, transactionRef: string, adminName: string) => {
    const withdrawal = globalState.withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) return;

    globalState = {
      ...globalState,
      withdrawals: globalState.withdrawals.map(w => {
        if (w.id === withdrawalId) {
          return {
            ...w,
            status: 'completed',
            transactionReference: transactionRef || `MOMO-CI-${Math.floor(100000 + Math.random() * 900000)}`,
            processedAt: new Date().toISOString(),
          };
        }
        return w;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'PROCESS_WITHDRAWAL_PAID',
          entityType: 'withdrawal',
          entityId: withdrawalId,
          details: `Virement/Décaissement de ${withdrawal.amount} FCFA validé vers ${withdrawal.payoutProvider} (${withdrawal.payoutPhone}). Réf: ${transactionRef}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    if (typeof window !== 'undefined') {
      cloudSyncService.updatePayoutInCloud(withdrawalId, 'completed', transactionRef).catch(() => {});
    }
    notify();
  },

  // 11. Admin / Guichetier : Valider un retrait par Code en Agence (Espèces)
  processAgencyPickupCode: (pickupCodeInput: string, adminName: string): { success: boolean; message: string; withdrawal?: Withdrawal } => {
    const cleanCode = pickupCodeInput.trim().toUpperCase();
    const withdrawal = globalState.withdrawals.find(
      w => (w.pickupCode && w.pickupCode.toUpperCase() === cleanCode) || w.withdrawalCode.toUpperCase() === cleanCode
    );

    if (!withdrawal) {
      return { success: false, message: `Code de retrait "${cleanCode}" introuvable.` };
    }

    if (withdrawal.status === 'completed') {
      return { success: false, message: `Ce code a déjà été utilisé et payé le ${new Date(withdrawal.processedAt || '').toLocaleDateString('fr-FR')}.` };
    }

    const ref = `GUICHET-CASH-${Math.floor(1000 + Math.random() * 9000)}`;
    sugubaStore.processWithdrawal(withdrawal.id, ref, adminName);

    return {
      success: true,
      message: `Retrait validé avec succès ! Remettez ${withdrawal.amount.toLocaleString('fr-FR')} FCFA en espèces à ${withdrawal.resellerName}.`,
      withdrawal: { ...withdrawal, status: 'completed', transactionReference: ref },
    };
  },

  // Mise à jour rapide du stock fournisseur
  // Pousse vers Supabase : le fournisseur ajustait son stock dans son propre
  // navigateur pendant que la base gardait l'ancienne quantité — un article
  // épuisé restait donc commandable par les clients, et un réapprovisionnement
  // n'était jamais visible.
  updateProductStock: (productId: string, newStockQuantity: number) => {
    let produitMisAJour: Product | undefined;

    globalState = {
      ...globalState,
      products: globalState.products.map(p => {
        if (p.id === productId) {
          produitMisAJour = {
            ...p,
            stockQuantity: Math.max(0, newStockQuantity),
          };
          return produitMisAJour;
        }
        return p;
      })
    };
    if (produitMisAJour && typeof window !== 'undefined') {
      cloudSyncService.pushProductToCloud(produitMisAJour).catch(() => {});
    }
    notify();
  },


  // Réinitialiser les données de démo
  resetDemoData: () => {
    globalState = {
      currentUser: INITIAL_USERS[3],
      users: INITIAL_USERS,
      suppliers: INITIAL_SUPPLIERS,
      resellers: INITIAL_RESELLERS,
      drivers: INITIAL_DRIVERS,
      diasporaProfiles: INITIAL_DIASPORA,
      products: INITIAL_PRODUCTS,
      orders: INITIAL_ORDERS,
      commissions: INITIAL_COMMISSIONS,
      withdrawals: INITIAL_WITHDRAWALS,
      auditLogs: INITIAL_AUDIT_LOGS,
      savTickets: INITIAL_SAV_TICKETS,
    };
    notify();
  },

  // ── Mode Production / Purge des données fantômes pour tests réels ──
  purgeAllGhostData: (options?: { keepProducts?: boolean }) => {
    const keepProducts = options?.keepProducts ?? true;
    
    globalState = {
      ...globalState,
      // Réinitialiser toutes les commandes à zéro
      orders: [],
      // Réinitialiser les commissions à zéro
      commissions: [],
      // Réinitialiser les retraits à zéro
      withdrawals: [],
      // Réinitialiser les tickets SAV
      savTickets: [],
      // Conserver ou vider les produits selon option
      products: keepProducts ? globalState.products : [],
      // Réinitialiser les soldes des revendeurs à 0 FCFA
      resellers: globalState.resellers.map(r => ({
        ...r,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        successfulOrdersCount: 0,
      })),
      // Journal d'audit avec l'action de purge
      auditLogs: [
        {
          id: `log-purge-${Date.now()}`,
          actorName: globalState.currentUser.fullName || 'Super Admin',
          role: 'admin',
          action: 'production_database_purged',
          entityType: 'database',
          entityId: 'global_state',
          details: 'Purge intégrale des données fantômes (commandes, retraits, commissions réinitialisés à 0) pour démarrage en conditions réelles.',
          createdAt: new Date().toISOString(),
        }
      ],
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    }
    notify();
  },

  // ── Configuration du compte Super Admin ──
  updateAdminProfile: (fullName: string, phone: string, city: string = 'Bamako') => {
    globalState = {
      ...globalState,
      users: globalState.users.map(u => {
        if (u.role === 'admin' || u.id === 'usr-admin-1') {
          return {
            ...u,
            fullName: fullName.trim() || u.fullName,
            phone: phone.trim() || u.phone,
            city: city.trim() || u.city,
          };
        }
        return u;
      }),
      currentUser: globalState.currentUser.role === 'admin' ? {
        ...globalState.currentUser,
        fullName: fullName.trim() || globalState.currentUser.fullName,
        phone: phone.trim() || globalState.currentUser.phone,
        city: city.trim() || globalState.currentUser.city,
      } : globalState.currentUser,
    };
    notify();
  },


  updateResellerTier: (resellerId: string, tier: ResellerTier, adminName: string = 'Super Admin') => {
    globalState = {
      ...globalState,
      resellers: globalState.resellers.map(r => {
        if (r.id === resellerId) {
          return { ...r, tier };
        }
        return r;
      }),
      auditLogs: [
        {
          id: `log-tier-res-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'reseller_tier_updated',
          entityType: 'reseller_profile',
          entityId: resellerId,
          details: `Palier revendeur mis à jour : Statut passé à ${tier.toUpperCase()}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  }
};

// React hook pour consommer le store avec réactivité en temps réel
export function useSugubaStore() {
  const [state, setState] = useState<SugubaState>(sugubaStore.getState());

  useEffect(() => {
    const unsubscribe = sugubaStore.subscribe(() => {
      setState(sugubaStore.getState());
    });
    // Lit localStorage seulement après le montage (post-hydratation) pour
    // que le tout premier rendu client corresponde exactement au HTML
    // rendu par le serveur — voir le commentaire sur getDefaultState.
    sugubaStore.hydrateFromLocalStorage();
    setState(sugubaStore.getState());
    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
