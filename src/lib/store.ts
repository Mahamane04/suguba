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

const STORAGE_KEY = 'suguba_platform_state_v1';

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

const getInitialState = (): SugubaState => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          diasporaProfiles: parsed.diasporaProfiles || INITIAL_DIASPORA,
          savTickets: parsed.savTickets || INITIAL_SAV_TICKETS,
        };
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
  }
  return {
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
  };
};

let globalState = getInitialState();
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
  addSupplierProduct: (data: {
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
  }) => {
    const newProduct: Product = {
      id: `prd-${Date.now()}`,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category: data.category,
      description: data.description,
      images: data.images.length > 0 ? data.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'],
      supplierPrice: Number(data.supplierPrice),
      publicPrice: Number(data.supplierPrice) * 1.3, // Prix suggéré temporaire
      resellerCommission: Math.round(Number(data.supplierPrice) * 0.1),
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
    if (typeof window !== 'undefined') {
      cloudSyncService.pushProductToCloud(newProduct).catch(() => {});
    }
    notify();
    return newProduct;
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
  }) => {
    const product = globalState.products.find(p => p.id === data.productId);
    if (!product) throw new Error('Produit introuvable');

    let reseller = data.resellerCode 
      ? globalState.resellers.find(r => r.referralCode.toUpperCase() === data.resellerCode?.toUpperCase())
      : undefined;

    // Si le client n'a pas de code mais que la session actuelle est un revendeur créant une commande manuelle
    if (!reseller && globalState.currentUser.role === 'reseller') {
      reseller = globalState.resellers.find(r => r.userId === globalState.currentUser.id);
    }

    const resellerUser = reseller ? globalState.users.find(u => u.id === reseller?.userId) : undefined;
    const orderNumber = `SG-${Math.floor(10000 + Math.random() * 90000)}`;
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Code secret à 4 chiffres

    const unitPrice = product.publicPrice || product.supplierPrice;
    const totalProductAmount = unitPrice * data.quantity;
    const deliveryFee = 1500;
    const totalAmount = totalProductAmount + deliveryFee;
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
  confirmOrderCall: (orderId: string, adminName: string) => {
    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'confirmed',
            callVerifiedBy: adminName,
            callVerifiedAt: new Date().toISOString(),
          };
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
    notify();
  },

  // 5. Admin : Assigner un Livreur
  assignDriver: (orderId: string, driverId: string, adminName: string) => {
    const driver = globalState.drivers.find(d => d.id === driverId);
    const driverUser = driver ? globalState.users.find(u => u.id === driver.userId) : undefined;

    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            driverId,
            driverName: driverUser?.fullName || 'Livreur Suguba',
            driverPhone: driverUser?.phone,
            status: 'dispatched',
          };
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
          details: `Livreur assigné : ${driverUser?.fullName} (${driverUser?.phone}) pour la commande ${orderId}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  // 6. Livreur : Récupérer colis & passer en transit
  setOrderInTransit: (orderId: string) => {
    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          return { ...o, status: 'in_transit' };
        }
        return o;
      }),
    };
    notify();
  },

  // 7. Livreur : Saisir le Code OTP du client (Protection Antifraude 3 tentatives)
  verifyDeliveryOtp: (orderId: string, inputOtp: string, driverName: string) => {
    const order = globalState.orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Commande introuvable' };

    // Vérification du blocage antifraude
    if ((order.failedOtpAttempts || 0) >= 3) {
      return { 
        success: false, 
        message: '⛔ SÉCURITÉ : Commande bloquée après 3 tentatives erronées. Veuillez contacter le support Suguba Ops pour débloquer.' 
      };
    }

    if (order.deliveryOtp.trim() !== inputOtp.trim()) {
      const attempts = (order.failedOtpAttempts || 0) + 1;
      const remaining = Math.max(0, 3 - attempts);

      globalState = {
        ...globalState,
        orders: globalState.orders.map(o => {
          if (o.id === orderId) {
            return {
              ...o,
              failedOtpAttempts: attempts,
            };
          }
          return o;
        }),
        auditLogs: [
          {
            id: `log-${Date.now()}`,
            actorName: driverName,
            role: 'driver',
            action: 'OTP_ATTEMPT_FAILED',
            entityType: 'order',
            entityId: orderId,
            details: `Échec saisie OTP (${inputOtp}) pour la commande ${order.orderNumber}. Tentative ${attempts}/3.`,
            createdAt: new Date().toISOString(),
          },
          ...globalState.auditLogs
        ]
      };
      notify();

      return { 
        success: false, 
        message: `Code OTP incorrect. ${remaining > 0 ? `Il vous reste ${remaining} tentative(s).` : 'Commande bloquée pour sécurité.'}` 
      };
    }

    // OTP Valide : Mettre à jour la commande
    const now = new Date().toISOString();

    // Calcul de la promotion automatique de palier de réputation
    let promotedTier = '';
    const currentReseller = globalState.resellers.find(r => r.id === order.resellerId);
    if (currentReseller) {
      const newOrdersCount = currentReseller.successfulOrdersCount + 1;
      const newTier = newOrdersCount >= 30 ? 'vip' : newOrdersCount >= 10 ? 'verified' : 'new';
      if (newTier !== currentReseller.tier) {
        promotedTier = newTier;
      }
    }

    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'delivered',
            paymentCollected: true,
            failedOtpAttempts: 0,
            deliveredAt: now,
          };
        }
        return o;
      }),
      // Verrouiller la commission en sécurité (LOCKED)
      commissions: globalState.commissions.map(c => {
        if (c.orderId === orderId) {
          return {
            ...c,
            status: 'locked',
            unlockAt: new Date(Date.now() + (c.safetyWindowDays || 7) * 24 * 60 * 60 * 1000).toISOString(),
          };
        }
        return c;
      }),
      // Augmenter le solde en attente du revendeur et mettre à jour le rang de réputation
      resellers: globalState.resellers.map(r => {
        if (r.id === order.resellerId) {
          const newCount = r.successfulOrdersCount + 1;
          const newTier = newCount >= 30 ? 'vip' : newCount >= 10 ? 'verified' : 'new';
          return {
            ...r,
            pendingBalance: r.pendingBalance + order.resellerCommission,
            successfulOrdersCount: newCount,
            tier: newTier,
          };
        }
        return r;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: driverName,
          role: 'driver',
          action: 'OTP_VERIFICATION_DELIVERED',
          entityType: 'order',
          entityId: orderId,
          details: `Livraison confirmée par OTP (${inputOtp}). ${order.totalAmount} FCFA encaissés. Commission de ${order.resellerCommission} FCFA verrouillée en sécurité pour ${order.resellerName}.${promotedTier ? ` 🎉 Revendeur promu au palier ${promotedTier.toUpperCase()} !` : ''}`,
          createdAt: now,
        },
        ...globalState.auditLogs
      ]
    };
    notify();
    return { success: true, message: 'Livraison validée avec succès ! Montant encaissé.' };
  },

  // 7b. Admin : Débloquer les tentatives OTP d'une commande
  resetOrderOtpLock: (orderId: string, adminName: string) => {
    globalState = {
      ...globalState,
      orders: globalState.orders.map(o => {
        if (o.id === orderId) {
          return { ...o, failedOtpAttempts: 0 };
        }
        return o;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'RESET_OTP_LOCK',
          entityType: 'order',
          entityId: orderId,
          details: `Déblocage des tentatives OTP effectué pour la commande ${orderId}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  // 8. Débloquer la commission (manuellement ou simulation fin de délai J+7) -> AVAILABLE
  unlockCommissionToAvailable: (commissionId: string) => {
    const commission = globalState.commissions.find(c => c.id === commissionId);
    if (!commission || commission.status !== 'locked') return;

    globalState = {
      ...globalState,
      commissions: globalState.commissions.map(c => {
        if (c.id === commissionId) {
          return { ...c, status: 'available' };
        }
        return c;
      }),
      resellers: globalState.resellers.map(r => {
        if (r.id === commission.resellerId) {
          return {
            ...r,
            pendingBalance: Math.max(0, r.pendingBalance - commission.amount),
            availableBalance: r.availableBalance + commission.amount,
            totalEarned: r.totalEarned + commission.amount,
          };
        }
        return r;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: 'Système Suguba Automatique',
          role: 'admin',
          action: 'COMMISSION_UNLOCKED',
          entityType: 'commission',
          entityId: commissionId,
          details: `Délai de sécurité expiré. Commission ${commission.commissionCode} de ${commission.amount} FCFA transférée vers le solde disponible de ${commission.resellerName}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  // 9. Revendeur : Demander un retrait Mobile Money ou en Agence
  requestWithdrawal: (data: {
    resellerId: string;
    amount: number;
    payoutProvider: 'Orange Money' | 'Wave' | 'Moov Money' | 'Agence Suguba';
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
        resellerId: newWithdrawal.resellerId,
        resellerName: newWithdrawal.resellerName,
        amount: newWithdrawal.amount,
        payoutProvider: newWithdrawal.payoutProvider,
        payoutPhone: newWithdrawal.payoutPhone,
        status: 'pending',
        createdAt: newWithdrawal.createdAt,
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
  updateProductStock: (productId: string, newStockQuantity: number) => {
    globalState = {
      ...globalState,
      products: globalState.products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            stockQuantity: Math.max(0, newStockQuantity),
          };
        }
        return p;
      })
    };
    notify();
  },

  // Ajout de nouveau produit fournisseur
  addProduct: (productData: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prd-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    globalState = {
      ...globalState,
      products: [newProduct, ...globalState.products]
    };
    notify();
    return newProduct;
  },

  // Créer un ticket de réclamation SAV / Garantie
  createSavTicket: (data: Omit<SavTicket, 'id' | 'ticketNumber' | 'createdAt' | 'status'>) => {
    const newTicket: SavTicket = {
      ...data,
      id: `sav-${Date.now()}`,
      ticketNumber: `SAV-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      savTickets: [newTicket, ...globalState.savTickets],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          actorName: 'Desk SAV Suguba',
          role: 'admin',
          action: 'CREATE_SAV_TICKET',
          entityType: 'order',
          entityId: data.orderId,
          details: `Ticket SAV #${newTicket.ticketNumber} ouvert pour la commande #${data.orderNumber} (${data.customerName}). Motif : ${data.issueDescription}.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
    return newTicket;
  },

  // Assigner un livreur pour l'échange de produit défectueux
  dispatchSavCourier: (ticketId: string, driverId: string) => {
    const driver = globalState.drivers.find(d => d.id === driverId);
    const driverUser = globalState.users.find(u => u.id === driver?.userId);
    const swapOtp = Math.floor(1000 + Math.random() * 9000).toString();

    globalState = {
      ...globalState,
      savTickets: globalState.savTickets.map(t => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'courier_dispatched',
            driverId,
            driverName: driverUser?.fullName || 'Livreur Moto',
            driverPhone: driverUser?.phone || '+223 70 00 00 00',
            swapOtp,
          };
        }
        return t;
      })
    };
    notify();
  },

  // Clôturer un ticket SAV (Échange validé ou réparation effectuée)
  resolveSavTicket: (ticketId: string, notes?: string) => {
    globalState = {
      ...globalState,
      savTickets: globalState.savTickets.map(t => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'resolved',
            notes: notes || t.notes,
            resolvedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    };
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

  // ── Inscription Revendeur (Vente sans stock & Mobile Money) ──
  registerReseller: (data: {
    fullName: string;
    phone: string;
    city?: string;
    neighborhood?: string;
    momoProvider?: 'Orange Money' | 'Wave' | 'Moov Money';
    momoNumber?: string;
    referralSponsorCode?: string;
  }) => {
    const userId = `usr-reseller-${Date.now()}`;
    const resellerId = `res-${Date.now()}`;
    const cleanName = data.fullName.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '') || 'SUGUBA';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    const referralCode = `${cleanName}${randomDigits}`;

    const newUser: User = {
      id: userId,
      phone: data.phone.trim(),
      fullName: data.fullName.trim(),
      role: 'reseller',
      city: data.city?.trim() || 'Bamako',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const newReseller: ResellerProfile = {
      id: resellerId,
      userId: userId,
      referralCode: referralCode,
      tier: 'new',
      pendingBalance: 0,
      availableBalance: 0,
      totalEarned: 0,
      successfulOrdersCount: 0,
      momoNumber: data.momoNumber?.trim() || data.phone.trim(),
      momoProvider: data.momoProvider || 'Orange Money',
      neighborhood: data.neighborhood?.trim() || 'Hamdallaye ACI 2000',
      status: 'active',
      joinedAt: new Date().toISOString(),
    };

    const auditLog: AuditLog = {
      id: `log-reg-reseller-${Date.now()}`,
      actorName: data.fullName.trim(),
      role: 'reseller',
      action: 'reseller_registered',
      entityType: 'reseller_profile',
      entityId: resellerId,
      details: `Nouveau revendeur inscrit : ${data.fullName} (${data.phone}) avec code affilié ${referralCode}.`,
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      users: [newUser, ...globalState.users],
      resellers: [newReseller, ...globalState.resellers],
      currentUser: newUser,
      auditLogs: [auditLog, ...globalState.auditLogs],
    };
    notify();
    return { user: newUser, reseller: newReseller };
  },

  // ── Inscription Fournisseur (Dépôt produits & Stock) ──
  registerSupplier: (data: {
    companyName: string;
    managerName: string;
    phone: string;
    city?: string;
    warehouseAddress: string;
    warehouseNeighborhood: string;
    category?: string;
    rccmOrNif?: string;
  }) => {
    const userId = `usr-supplier-${Date.now()}`;
    const supplierId = `sup-${Date.now()}`;

    const newUser: User = {
      id: userId,
      phone: data.phone.trim(),
      fullName: `${data.managerName.trim()} (${data.companyName.trim()})`,
      role: 'supplier',
      city: data.city?.trim() || 'Bamako',
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };

    const newSupplier: SupplierProfile = {
      id: supplierId,
      userId: userId,
      companyName: data.companyName.trim(),
      managerName: data.managerName.trim(),
      warehouseAddress: data.warehouseAddress.trim(),
      warehouseNeighborhood: data.warehouseNeighborhood.trim(),
      contactPhone: data.phone.trim(),
      category: data.category?.trim() || 'Général & Import',
      rccmOrNif: data.rccmOrNif?.trim() || undefined,
      status: 'pending_approval',
      totalProducts: 0,
      totalRevenue: 0,
      submittedAt: new Date().toISOString(),
    };

    const auditLog: AuditLog = {
      id: `log-reg-supplier-${Date.now()}`,
      actorName: data.managerName.trim(),
      role: 'supplier',
      action: 'supplier_onboarding_submitted',
      entityType: 'supplier_profile',
      entityId: supplierId,
      details: `Dépôt de candidature Fournisseur : ${data.companyName} (${data.managerName}, ${data.phone}) - En attente de validation admin.`,
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      users: [newUser, ...globalState.users],
      suppliers: [newSupplier, ...globalState.suppliers],
      currentUser: newUser,
      auditLogs: [auditLog, ...globalState.auditLogs],
    };
    notify();
    return { user: newUser, supplier: newSupplier };
  },

  // ── Inscription Livreur (Courses & OTP) ──
  registerDriver: (data: {
    fullName: string;
    phone: string;
    city?: string;
    vehicleType: string;
    licensePlate: string;
    zone: string;
    idDocumentNumber?: string;
  }) => {
    const userId = `usr-driver-${Date.now()}`;
    const driverId = `drv-${Date.now()}`;

    const newUser: User = {
      id: userId,
      phone: data.phone.trim(),
      fullName: data.fullName.trim(),
      role: 'driver',
      city: data.city?.trim() || 'Bamako',
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };

    const newDriver: DriverProfile = {
      id: driverId,
      userId: userId,
      vehicleType: data.vehicleType.trim() || 'Moto Jakarta',
      licensePlate: data.licensePlate.trim() || 'En cours d\'immatriculation',
      zone: data.zone.trim() || 'Communes de Bamako',
      idDocumentNumber: data.idDocumentNumber?.trim() || undefined,
      status: 'pending_approval',
      activeStatus: false,
      totalDeliveries: 0,
      rating: 5.0,
      submittedAt: new Date().toISOString(),
    };

    const auditLog: AuditLog = {
      id: `log-reg-driver-${Date.now()}`,
      actorName: data.fullName.trim(),
      role: 'driver',
      action: 'driver_onboarding_submitted',
      entityType: 'driver_profile',
      entityId: driverId,
      details: `Candidature Livreur déposée : ${data.fullName} (${data.phone}, ${data.vehicleType}) - En attente de validation admin.`,
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      users: [newUser, ...globalState.users],
      drivers: [newDriver, ...globalState.drivers],
      currentUser: newUser,
      auditLogs: [auditLog, ...globalState.auditLogs],
    };
    notify();
    return { user: newUser, driver: newDriver };
  },

  // ── Inscription Espace Diaspora (Achat pour proches au Mali) ──
  registerDiaspora: (data: {
    fullName: string;
    phone: string;
    countryOfResidence: string;
    currency: 'EUR' | 'USD' | 'CAD' | 'GBP';
    beneficiaryNameInMali: string;
    beneficiaryPhoneInMali: string;
    beneficiaryNeighborhoodInMali: string;
  }) => {
    const userId = `usr-diaspora-${Date.now()}`;
    const diasporaId = `dia-${Date.now()}`;

    const newUser: User = {
      id: userId,
      phone: data.phone.trim(),
      fullName: data.fullName.trim(),
      role: 'diaspora',
      city: data.countryOfResidence.trim(),
      country: data.countryOfResidence.trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const newDiaspora: DiasporaProfile = {
      id: diasporaId,
      userId: userId,
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      countryOfResidence: data.countryOfResidence.trim(),
      currency: data.currency || 'EUR',
      beneficiaryNameInMali: data.beneficiaryNameInMali.trim(),
      beneficiaryPhoneInMali: data.beneficiaryPhoneInMali.trim(),
      beneficiaryNeighborhoodInMali: data.beneficiaryNeighborhoodInMali.trim(),
      totalOrdersSent: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const auditLog: AuditLog = {
      id: `log-reg-diaspora-${Date.now()}`,
      actorName: data.fullName.trim(),
      role: 'diaspora',
      action: 'diaspora_account_created',
      entityType: 'diaspora_profile',
      entityId: diasporaId,
      details: `Compte Diaspora créé : ${data.fullName} (${data.countryOfResidence}) -> Bénéficiaire : ${data.beneficiaryNameInMali} (${data.beneficiaryPhoneInMali}, Bamako).`,
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      users: [newUser, ...globalState.users],
      diasporaProfiles: [newDiaspora, ...(globalState.diasporaProfiles || [])],
      currentUser: newUser,
      auditLogs: [auditLog, ...globalState.auditLogs],
    };
    notify();
    return { user: newUser, diaspora: newDiaspora };
  },

  // ── Approbation & Modération Admin des Profils ──
  approveSupplier: (supplierId: string, adminName: string = 'Super Admin') => {
    const supplier = globalState.suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    globalState = {
      ...globalState,
      suppliers: globalState.suppliers.map(s => {
        if (s.id === supplierId) {
          return { ...s, status: 'approved', approvedAt: new Date().toISOString() };
        }
        return s;
      }),
      users: globalState.users.map(u => {
        if (u.id === supplier.userId) {
          return { ...u, status: 'active' };
        }
        return u;
      }),
      auditLogs: [
        {
          id: `log-app-sup-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'supplier_approved',
          entityType: 'supplier_profile',
          entityId: supplierId,
          details: `Fournisseur ${supplier.companyName} (${supplier.contactPhone}) validé et autorisé à publier des stocks.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  rejectSupplier: (supplierId: string, reason: string = 'Non conforme', adminName: string = 'Super Admin') => {
    globalState = {
      ...globalState,
      suppliers: globalState.suppliers.map(s => {
        if (s.id === supplierId) return { ...s, status: 'rejected' };
        return s;
      }),
      auditLogs: [
        {
          id: `log-rej-sup-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'supplier_rejected',
          entityType: 'supplier_profile',
          entityId: supplierId,
          details: `Fournisseur rejeté. Motif : ${reason}`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  approveDriver: (driverId: string, adminName: string = 'Super Admin') => {
    const driver = globalState.drivers.find(d => d.id === driverId);
    if (!driver) return;

    globalState = {
      ...globalState,
      drivers: globalState.drivers.map(d => {
        if (d.id === driverId) {
          return { ...d, status: 'approved', activeStatus: true, approvedAt: new Date().toISOString() };
        }
        return d;
      }),
      users: globalState.users.map(u => {
        if (u.id === driver.userId) {
          return { ...u, status: 'active' };
        }
        return u;
      }),
      auditLogs: [
        {
          id: `log-app-drv-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'driver_approved',
          entityType: 'driver_profile',
          entityId: driverId,
          details: `Livreur validé et activé pour les courses à Bamako.`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };
    notify();
  },

  rejectDriver: (driverId: string, reason: string = 'Non conforme', adminName: string = 'Super Admin') => {
    globalState = {
      ...globalState,
      drivers: globalState.drivers.map(d => {
        if (d.id === driverId) return { ...d, status: 'rejected', activeStatus: false };
        return d;
      }),
      auditLogs: [
        {
          id: `log-rej-drv-${Date.now()}`,
          actorName: adminName,
          role: 'admin',
          action: 'driver_rejected',
          entityType: 'driver_profile',
          entityId: driverId,
          details: `Livreur rejeté. Motif : ${reason}`,
          createdAt: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
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
    setState(sugubaStore.getState());
    const unsubscribe = sugubaStore.subscribe(() => {
      setState(sugubaStore.getState());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
