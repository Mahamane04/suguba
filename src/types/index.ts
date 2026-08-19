export type UserRole = 'admin' | 'supplier' | 'reseller' | 'driver' | 'customer' | 'diaspora';

export type UserStatus = 'pending_approval' | 'active' | 'suspended' | 'rejected';

export type ResellerTier = 'new' | 'verified' | 'vip';

export type ProductStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

export type OrderStatus = 
  | 'new'            // Commande passée par client ou revendeur
  | 'pending_call'   // En attente d'appel de confirmation Suguba
  | 'confirmed'      // Confirmée par téléphone par Suguba
  | 'dispatched'     // Livreur assigné et en route vers fournisseur/hub
  | 'in_transit'     // Colis récupéré, en cours de livraison au client
  | 'delivered'      // Livré (OTP validé par le livreur)
  | 'cancelled'      // Annulée avant expédition
  | 'returned';      // Client a refusé le colis

export type CommissionStatus = 
  | 'potential'            // Commande créée
  | 'pending'              // Commande confirmée / en livraison
  | 'locked'               // Livré & payé, en période de sécurité (J+7 / J+14)
  | 'available'            // Sécurité écoulée, solde retirable
  | 'withdrawal_requested' // Retrait demandé
  | 'paid'                 // Virement Mobile Money effectué
  | 'cancelled'            // Annulé (commande non aboutie)
  | 'reversed';            // Annulé pour retour / contestation

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  role: UserRole;
  city: string;
  country?: string;
  status?: UserStatus;
  avatarUrl?: string;
  createdAt: string;
}

export interface SupplierProfile {
  id: string;
  userId: string;
  companyName: string;
  managerName?: string;
  warehouseAddress: string;
  warehouseNeighborhood: string;
  contactPhone: string;
  category?: string;
  rccmOrNif?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  totalProducts: number;
  totalRevenue: number;
  submittedAt?: string;
  approvedAt?: string;
}

export interface ResellerProfile {
  id: string;
  userId: string;
  referralCode: string;
  tier: ResellerTier;
  pendingBalance: number;    // Commissions en attente / verrouillées
  availableBalance: number;  // Commissions retirables
  totalEarned: number;
  successfulOrdersCount: number;
  momoNumber?: string;
  momoProvider?: 'Orange Money' | 'Wave' | 'Moov Money';
  status?: 'active' | 'pending_verification' | 'suspended';
  neighborhood?: string;
  joinedAt?: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: string;
  licensePlate: string;
  zone?: string;
  idDocumentNumber?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  activeStatus: boolean;
  totalDeliveries: number;
  rating: number;
  submittedAt?: string;
  approvedAt?: string;
}

export interface DiasporaProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  countryOfResidence: string;
  currency: 'EUR' | 'USD' | 'CAD' | 'GBP';
  beneficiaryNameInMali: string;
  beneficiaryPhoneInMali: string;
  beneficiaryNeighborhoodInMali: string;
  totalOrdersSent: number;
  status: 'active' | 'pending_verification';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
}

export interface Product {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  images: string[];
  videoUrl?: string;
  supplierPrice: number;       // Prix demandé par le fournisseur (ex: 30 000 F)
  publicPrice: number;         // Prix public fixé par Suguba (ex: 40 000 F)
  resellerCommission: number;  // Gain revendeur fixe par vente (ex: 4 000 F)
  sugubaMargin: number;        // Marge nette Suguba (ex: 6 000 F)
  stockQuantity: number;
  warrantyMonths: number;
  preparationDelayHours: number;
  stockLocationType: 'supplier' | 'suguba_hub';
  stockLocationAddress: string;
  status: ProductStatus;
  isFeatured?: boolean;
  marketingPitch: string;      // Texte de vente prêt à copier pour WhatsApp
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;         // ex: SG-10492
  productId: string;
  productName: string;
  productImage: string;
  resellerId?: string;         // ID du revendeur affilié (si vente apportée par revendeur)
  resellerName?: string;
  resellerCode?: string;
  resellerCommission: number;
  quantity: number;
  unitPrice: number;
  totalProductAmount: number;
  deliveryFee: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  city: string;
  neighborhood: string;        // Quartier (ex: Hamdallaye ACI 2000, Badalabougou, etc.)
  landmark: string;            // Repère visuel (ex: En face de la station Total)
  deliveryNotes?: string;
  status: OrderStatus;
  deliveryOtp: string;         // Code secret à 4 chiffres (ex: 5832)
  failedOtpAttempts?: number;  // Nombre d'échecs de saisie OTP
  otpLockedUntil?: string;     // Blocage temporaire après 3 échecs
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  paymentMethod: 'cash_on_delivery' | 'mobile_money';
  paymentCollected: boolean;
  callVerifiedBy?: string;
  callVerifiedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface Commission {
  id: string;
  commissionCode: string;
  resellerId: string;
  resellerName: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  amount: number;
  status: CommissionStatus;
  safetyWindowDays: number;
  unlockAt: string;            // Date à laquelle la commission passe en AVAILABLE
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  withdrawalCode: string;
  resellerId: string;
  resellerName: string;
  amount: number;
  payoutProvider: 'Orange Money' | 'Wave' | 'Moov Money' | 'Virement' | 'Agence Suguba';
  payoutPhone: string;
  pickupCode?: string;         // Code secret à 6 chiffres pour retrait espèces au guichet
  agencyLocation?: string;     // Nom / Adresse du Hub Suguba (ex: Hamdallaye ACI 2000)
  status: WithdrawalStatus;
  transactionReference?: string;
  processedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorName: string;
  role: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export type SavResolutionType = 'swap_new' | 'repair' | 'refund';
export type SavTicketStatus = 'open' | 'courier_dispatched' | 'swapped' | 'resolved' | 'rejected';

export interface SavTicket {
  id: string;
  ticketNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  supplierName: string;
  issueDescription: string;
  resolutionType: SavResolutionType;
  status: SavTicketStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  swapOtp?: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
}

