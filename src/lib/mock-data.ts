import { User, SupplierProfile, ResellerProfile, DriverProfile, DiasporaProfile, Product, Order, Commission, Withdrawal, AuditLog, SavTicket } from '@/types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-1',
    phone: '+223 89 46 00 00',
    fullName: 'Directeur Opérations Suguba',
    role: 'admin',
    city: 'Bamako',
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'usr-supplier-1',
    phone: '+223 76 12 34 56',
    fullName: 'Ibrahim Diarra (Diarra Électronique)',
    role: 'supplier',
    city: 'Bamako (Grand Marché)',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'usr-supplier-2',
    phone: '+223 65 98 76 54',
    fullName: 'Oumar Koné (Koné Import Solaire)',
    role: 'supplier',
    city: 'Bamako (Zone Industrielle)',
    createdAt: '2026-01-12T11:00:00Z',
  },
  {
    id: 'usr-reseller-1',
    phone: '+223 79 11 22 33',
    fullName: 'Moussa Coulibaly',
    role: 'reseller',
    city: 'Bamako (Hamdallaye ACI 2000)',
    createdAt: '2026-01-15T14:30:00Z',
  },
  {
    id: 'usr-reseller-2',
    phone: '+223 66 44 55 66',
    fullName: 'Awa Diakité',
    role: 'reseller',
    city: 'Bamako (Badalabougou)',
    createdAt: '2026-01-20T09:15:00Z',
  },
  {
    id: 'usr-driver-1',
    phone: '+223 74 88 99 00',
    fullName: 'Amadou Traoré',
    role: 'driver',
    city: 'Bamako',
    createdAt: '2026-01-18T16:00:00Z',
  },
  {
    id: 'usr-driver-2',
    phone: '+223 60 22 33 44',
    fullName: 'Bakary Samaké',
    role: 'driver',
    city: 'Bamako',
    createdAt: '2026-01-22T10:00:00Z',
  }
];

export const INITIAL_SUPPLIERS: SupplierProfile[] = [
  {
    id: 'sup-1',
    userId: 'usr-supplier-1',
    companyName: 'Diarra Électronique Bamako',
    managerName: 'Ibrahim Diarra',
    warehouseAddress: 'Grand Marché, Rue 24, Porte 12',
    warehouseNeighborhood: 'Grand Marché',
    contactPhone: '+223 76 12 34 56',
    category: 'Électronique & Énergie',
    status: 'approved',
    totalProducts: 14,
    totalRevenue: 2450000,
  },
  {
    id: 'sup-2',
    userId: 'usr-supplier-2',
    companyName: 'Koné Import Solaire & Maison',
    managerName: 'Oumar Koné',
    warehouseAddress: 'Zone Industrielle Sotuba, Hangar 4',
    warehouseNeighborhood: 'Sotuba',
    contactPhone: '+223 65 98 76 54',
    category: 'Solaire & Équipements',
    status: 'approved',
    totalProducts: 8,
    totalRevenue: 1890000,
  }
];

export const INITIAL_RESELLERS: ResellerProfile[] = [
  {
    id: 'res-1',
    userId: 'usr-reseller-1',
    referralCode: 'MOUSSA123',
    tier: 'verified',
    pendingBalance: 12000,
    availableBalance: 25500,
    totalEarned: 184000,
    successfulOrdersCount: 28,
    momoNumber: '+223 79 11 22 33',
    momoProvider: 'Orange Money',
    status: 'active',
    neighborhood: 'Hamdallaye ACI 2000',
  },
  {
    id: 'res-2',
    userId: 'usr-reseller-2',
    referralCode: 'AWA_BKO',
    tier: 'new',
    pendingBalance: 18000,
    availableBalance: 10000,
    totalEarned: 45000,
    successfulOrdersCount: 7,
    momoNumber: '+223 66 44 55 66',
    momoProvider: 'Wave',
    status: 'active',
    neighborhood: 'Badalabougou',
  }
];

export const INITIAL_DRIVERS: DriverProfile[] = [
  {
    id: 'drv-1',
    userId: 'usr-driver-1',
    vehicleType: 'Moto Sanili 125',
    licensePlate: 'BA-4821-MD',
    zone: 'Communes IV, V, VI',
    status: 'approved',
    activeStatus: true,
    totalDeliveries: 142,
    rating: 4.9,
  },
  {
    id: 'drv-2',
    userId: 'usr-driver-2',
    vehicleType: 'Moto Jakarta Express',
    licensePlate: 'BA-9912-MD',
    zone: 'Communes I, II, III',
    status: 'approved',
    activeStatus: true,
    totalDeliveries: 88,
    rating: 4.8,
  }
];

export const INITIAL_DIASPORA: DiasporaProfile[] = [
  {
    id: 'dia-1',
    userId: 'usr-diaspora-1',
    fullName: 'Sekou Traoré',
    phone: '+33 6 12 34 56 78',
    countryOfResidence: 'France 🇫🇷 (Paris)',
    currency: 'EUR',
    beneficiaryNameInMali: 'Fatoumata Traoré (Mère)',
    beneficiaryPhoneInMali: '+223 76 99 88 77',
    beneficiaryNeighborhoodInMali: 'Kalaban Coura',
    totalOrdersSent: 3,
    status: 'active',
    createdAt: '2026-02-01T12:00:00Z',
  }
];

// Vide le 2026-08-21 avant ouverture commerciale : catalogue fictif (22 articles a prix inventes).
// Ces entrees etaient injectees dans le store a chaque visite et fusionnees
// avec les vraies donnees Supabase : la boutique publique restait donc
// peuplee d articles inexistants meme apres purge de la base, et un visiteur
// pouvait les commander. Le catalogue vient desormais uniquement de Supabase.
export const INITIAL_PRODUCTS: Product[] = [];

// Vide le 2026-08-21 avant ouverture commerciale : commandes fictives.
// Ces entrees etaient injectees dans le store a chaque visite et fusionnees
// avec les vraies donnees Supabase : la boutique publique restait donc
// peuplee d articles inexistants meme apres purge de la base, et un visiteur
// pouvait les commander. Le catalogue vient desormais uniquement de Supabase.
export const INITIAL_ORDERS: Order[] = [];

// Vide le 2026-08-21 avant ouverture commerciale : commissions fictives.
// Ces entrees etaient injectees dans le store a chaque visite et fusionnees
// avec les vraies donnees Supabase : la boutique publique restait donc
// peuplee d articles inexistants meme apres purge de la base, et un visiteur
// pouvait les commander. Le catalogue vient desormais uniquement de Supabase.
export const INITIAL_COMMISSIONS: Commission[] = [];

// Vide le 2026-08-21 avant ouverture commerciale : retraits fictifs.
// Ces entrees etaient injectees dans le store a chaque visite et fusionnees
// avec les vraies donnees Supabase : la boutique publique restait donc
// peuplee d articles inexistants meme apres purge de la base, et un visiteur
// pouvait les commander. Le catalogue vient desormais uniquement de Supabase.
export const INITIAL_WITHDRAWALS: Withdrawal[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    actorName: 'Directeur Opérations Suguba',
    role: 'admin',
    action: 'CONFIRM_ORDER',
    entityType: 'order',
    entityId: 'ord-10428',
    details: 'Appel client réussi avec Mme Fatoumata Bamba. Commande validée pour livraison Hamdallaye.',
    createdAt: '2026-02-18T09:30:00Z',
  },
  {
    id: 'log-2',
    actorName: 'Amadou Traoré',
    role: 'driver',
    action: 'OTP_VERIFICATION_DELIVERED',
    entityType: 'order',
    entityId: 'ord-10427',
    details: 'Code OTP 9142 saisi avec succès. 41 500 FCFA encaissés. Commission de 4 000 FCFA bloquée en sécurité pour Moussa Coulibaly.',
    createdAt: '2026-02-17T15:45:00Z',
  }
];

// Vide le 2026-08-21 avant ouverture commerciale : tickets SAV rattaches a des commandes fictives.
// Ces entrees etaient injectees dans le store a chaque visite et fusionnees
// avec les vraies donnees Supabase : la boutique publique restait donc
// peuplee d articles inexistants meme apres purge de la base, et un visiteur
// pouvait les commander. Le catalogue vient desormais uniquement de Supabase.
export const INITIAL_SAV_TICKETS: SavTicket[] = [];

