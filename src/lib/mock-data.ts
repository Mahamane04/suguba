import { User, SupplierProfile, ResellerProfile, DriverProfile, Product, Order, Commission, Withdrawal, AuditLog } from '@/types';

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
    warehouseAddress: 'Grand Marché, Rue 24, Porte 12',
    warehouseNeighborhood: 'Grand Marché',
    contactPhone: '+223 76 12 34 56',
    totalProducts: 14,
    totalRevenue: 2450000,
  },
  {
    id: 'sup-2',
    userId: 'usr-supplier-2',
    companyName: 'Koné Import Solaire & Maison',
    warehouseAddress: 'Zone Industrielle Sotuba, Hangar 4',
    warehouseNeighborhood: 'Sotuba',
    contactPhone: '+223 65 98 76 54',
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
  }
];

export const INITIAL_DRIVERS: DriverProfile[] = [
  {
    id: 'drv-1',
    userId: 'usr-driver-1',
    vehicleType: 'Moto Sanili 125',
    licensePlate: 'BA-4821-MD',
    activeStatus: true,
    totalDeliveries: 142,
    rating: 4.9,
  },
  {
    id: 'drv-2',
    userId: 'usr-driver-2',
    vehicleType: 'Moto Jakarta Express',
    licensePlate: 'BA-9912-MD',
    activeStatus: true,
    totalDeliveries: 88,
    rating: 4.8,
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prd-robot-petrin',
    supplierId: 'sup-1',
    supplierName: 'Diarra Électronique',
    name: 'Robot Pétrin & Mixeur Pâtissier Multifonction Inox (6.5L - 1000W)',
    slug: 'robot-petrin-mixeur-patissier-inox',
    category: 'Électroménager',
    description: 'Robot professionnel tout-en-un avec grand bol en acier inoxydable de 6.5L, fouet métallique, crochet pétrisseur pour pâte à pain/beignets et hachoir à viande. Moteur puissant 1000W à 6 vitesses avec fonction Pulse. Idéal pour familles et traiteurs à Bamako.',
    images: [
      'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=800&q=80',
      'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80'
    ],
    supplierPrice: 45000,
    publicPrice: 65000,
    resellerCommission: 7000,
    sugubaMargin: 13000,
    stockQuantity: 20,
    warrantyMonths: 12,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `🎂 LE ROBOT PÂTISSIER & PÉTRIN INOX INDISPENSABLE À BAMAKO !
Préparez vos gâteaux, pains, pâtes et jus comme un chef avec ce Robot Pétrin 6.5L 1000W.
✅ Bol inox XXL 6.5L & 3 accessoires professionnels
✅ Moteur cuivre garanti 12 mois
💰 Prix promo : 65 000 FCFA
🛵 Livraison à domicile partout à Bamako - Payez à la réception !
Commandez directement ici : `,
    createdAt: '2026-02-15T08:00:00Z',
  },
  {
    id: 'prd-1',
    supplierId: 'sup-1',
    supplierName: 'Diarra Électronique',
    name: 'Smart TV Samsung 43" Full HD Cristal',
    slug: 'smart-tv-samsung-43',
    category: 'Électronique & TV',
    description: 'Téléviseur intelligent Samsung 43 pouces Full HD avec applications intégrées (YouTube, Netflix, Prime). Écran ultra-lumineux avec récepteur intégré et ports HDMI/USB.',
    images: [
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
      'https://images.unsplash.com/photo-1577979749830-f1d742b96791?w=800&q=80'
    ],
    supplierPrice: 110000,
    publicPrice: 145000,
    resellerCommission: 10000,
    sugubaMargin: 25000,
    stockQuantity: 23,
    warrantyMonths: 12,
    preparationDelayHours: 2,
    stockLocationType: 'supplier',
    stockLocationAddress: 'Grand Marché, Diarra Électro',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `🔥 PROMO FLASH BAMAKO : Smart TV Samsung 43" Full HD
Profitez d'une qualité d'image exceptionnelle avec YouTube et Netflix intégrés !
✅ Garantie 12 mois offerte
💰 Prix Spécial : 145 000 FCFA
🛵 Livraison rapide partout à Bamako - Paiement à la réception !
Commandez vite ici : `,
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'prd-2',
    supplierId: 'sup-1',
    supplierName: 'Diarra Électronique',
    name: 'Mixeur Blender Multifonction 2-en-1 Puissant 600W',
    slug: 'mixeur-blender-multifonction-600w',
    category: 'Électroménager',
    description: 'Blender puissant idéal pour les sauces locales, jus de fruits frais, épices et glaces. Lames en acier inoxydable et bol incassable haute résistance.',
    images: [
      'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&q=80'
    ],
    supplierPrice: 30000,
    publicPrice: 40000,
    resellerCommission: 4000,
    sugubaMargin: 6000,
    stockQuantity: 45,
    warrantyMonths: 6,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `⚡ LE MIXEUR INDISPENSABLE POUR VOTRE CUISINE !
Mixeur Blender 2-en-1 avec moulin à épices puissant 600W.
✅ Bol incassable & lames inox
💰 Prix client : 40 000 FCFA
🛵 Livraison express Bamako - Payez quand vous recevez !
Cliquez pour commander : `,
    createdAt: '2026-02-05T12:00:00Z',
  },
  {
    id: 'prd-3',
    supplierId: 'sup-2',
    supplierName: 'Koné Import Solaire',
    name: 'Kit Solaire Domestique Autonome 4 Lampes + Chargeur Téléphone',
    slug: 'kit-solaire-domestique-autonome',
    category: 'Énergie Solaire',
    description: 'Solution anti-délestage complète avec panneau solaire photovoltaïque, batterie lithium longue autonomie 10 heures, 4 ampoules LED basse consommation et sorties USB universelles.',
    images: [
      'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=800&q=80',
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80'
    ],
    supplierPrice: 45000,
    publicPrice: 65000,
    resellerCommission: 6500,
    sugubaMargin: 13500,
    stockQuantity: 30,
    warrantyMonths: 12,
    preparationDelayHours: 2,
    stockLocationType: 'supplier',
    stockLocationAddress: 'Zone Industrielle Sotuba',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `☀️ FINI LES COUPURES D'ÉLECTRICITÉ À LA MAISON !
Kit Solaire complet prêt à l'emploi : 4 ampoules lumineuses + recharge de tous vos téléphones.
✅ Autonomie 10 heures garantie
💰 Prix : 65 000 FCFA
🛵 Livraison express partout à Bamako - Paiement à la réception !
Commandez directement : `,
    createdAt: '2026-02-10T15:00:00Z',
  },
  {
    id: 'prd-boubou-bazin',
    supplierId: 'sup-1',
    supplierName: 'Atelier Couture Bamako & Bazin',
    name: 'Ensemble Boubou Bazin Riche Getzner Brodé avec Voile Soie',
    slug: 'ensemble-boubou-bazin-riche-brode',
    category: 'Mode & Textile',
    description: 'Magnifique ensemble boubou traditionnel malien en véritable Bazin Riche Getzner 100% coton teinté à la main à Bamako. Broderie royale de haute précision au col et aux manches, livré avec son voile en soie assorti. Idéal pour cérémonies, mariages et fêtes religieuses.',
    images: [
      'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800&q=80',
      'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80'
    ],
    supplierPrice: 25000,
    publicPrice: 39000,
    resellerCommission: 5000,
    sugubaMargin: 9000,
    stockQuantity: 15,
    warrantyMonths: 3,
    preparationDelayHours: 1,
    stockLocationType: 'supplier',
    stockLocationAddress: 'Marché Rose de Bamako',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `✨ L'ÉLÉGANCE MALIENNE PAR EXCELLENCE !
Ensemble Boubou Bazin Riche Getzner Brodé Prestige.
✅ Bazin 100% pur coton brillant & broderie soignée
💰 Prix spécial : 39 000 FCFA
🛵 Livraison à domicile partout à Bamako - Payez quand vous recevez !
Commandez vite ici : `,
    createdAt: '2026-02-16T09:00:00Z',
  },
  {
    id: 'prd-pack-chebe-karite',
    supplierId: 'sup-2',
    supplierName: 'Nature & Beauté Sahel',
    name: 'Pack Soin Capillaire Bio Chébé & Beurre de Karité Pur du Mali (4 Produits)',
    slug: 'pack-soin-capillaire-chebe-karite-mali',
    category: 'Beauté & Cosmétique',
    description: 'Coffret complet de soins naturels fortifiants contre la casse et pour la pousse rapide des cheveux crépus et bouclés : Huile de Chébé pure de 250ml, Baume au Beurre de Karité vierge non raffiné 200g, Shampoing doux aux plantes et Sérum antichute.',
    images: [
      'https://images.unsplash.com/photo-1608248597359-54859f9c7333?w=800&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80'
    ],
    supplierPrice: 10000,
    publicPrice: 17500,
    resellerCommission: 2500,
    sugubaMargin: 5000,
    stockQuantity: 50,
    warrantyMonths: 6,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `🌿 LE SECRET DES CHEVEUX LONGS ET FORTS !
Pack Bio 100% Naturel Chébé & Karité du Mali.
✅ Fini la casse, stimule la repousse rapide
💰 Prix Promo : 17 500 FCFA
🛵 Livraison à Bamako - Paiement à la réception !
Cliquez ici pour commander : `,
    createdAt: '2026-02-16T11:00:00Z',
  },
  {
    id: 'prd-ventilateur-rechargeable',
    supplierId: 'sup-2',
    supplierName: 'Koné Import Solaire',
    name: 'Ventilateur Solaire Rechargeable Silencieux 16" avec Lampe LED & Télécommande',
    slug: 'ventilateur-solaire-rechargeable-silencieux',
    category: 'Maison & Confort',
    description: 'Ventilateur sur pied 16 pouces ultra-puissant et silencieux avec batterie lithium rechargeable intégrée (autonomie 8 heures en vitesse moyenne). Port USB pour recharger smartphones et torche LED intégrée en cas de coupure de courant nocturne.',
    images: [
      'https://images.unsplash.com/photo-1618944847823-289eb6e2808c?w=800&q=80',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80'
    ],
    supplierPrice: 28000,
    publicPrice: 42000,
    resellerCommission: 4500,
    sugubaMargin: 9500,
    stockQuantity: 25,
    warrantyMonths: 12,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `💨 DORMEZ AU FRAIS MÊME PENDANT LES COUPURES DE COURANT !
Ventilateur Rechargeable Solaire 16" avec télécommande et lumière LED.
✅ Autonomie 8 heures • Recharge solaire et secteur
💰 Prix Spécial : 42 000 FCFA
🛵 Livraison rapide partout à Bamako - Payez à la réception !
Commandez votre ventilateur ici : `,
    createdAt: '2026-02-16T14:00:00Z',
  },
  {
    id: 'prd-powerbank-ecouteurs',
    supplierId: 'sup-1',
    supplierName: 'Diarra Électronique',
    name: 'Pack High-Tech : Écouteurs Sans Fil Bluetooth 5.3 + Powerbank 20 000mAh',
    slug: 'pack-hightech-ecouteurs-sansfil-powerbank',
    category: 'High-Tech & Accessoires',
    description: 'Duo indispensable pour smartphone : Écouteurs sans fil avec réduction de bruit et boîtier indicateur LED de batterie + Powerbank compact haute capacité 20 000mAh capable de recharger 4 à 5 fois n\'importe quel téléphone Android ou iPhone avec charge rapide 22.5W.',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80',
      'https://images.unsplash.com/photo-1609081219090-a6d8173087ec?w=800&q=80'
    ],
    supplierPrice: 12000,
    publicPrice: 19900,
    resellerCommission: 3000,
    sugubaMargin: 4900,
    stockQuantity: 35,
    warrantyMonths: 6,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `🔋 NE TOMBEZ PLUS JAMAIS EN PANNE DE BATTERIE !
Pack Écouteurs Sans Fil Bluetooth + Powerbank 20 000 mAh Charge Rapide.
✅ Son stéréo haute fidélité & Charge 5 fois votre téléphone
💰 Prix Choc : 19 900 FCFA
🛵 Livraison express Bamako - Paiement à la réception !
Commandez maintenant : `,
    createdAt: '2026-02-16T16:00:00Z',
  },
  {
    id: 'prd-4',
    supplierId: 'sup-1',
    supplierName: 'Diarra Électronique',
    name: 'Smartphone Android 4G 128Go Double SIM Écran 6.5"',
    slug: 'smartphone-android-128go-4g',
    category: 'Téléphones & Tablettes',
    description: 'Smartphone performant avec 128Go de stockage, 4Go RAM, batterie 5000 mAh longue autonomie, quadruple capteur photo haute définition.',
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&q=80'
    ],
    supplierPrice: 65000,
    publicPrice: 85000,
    resellerCommission: 6000,
    sugubaMargin: 14000,
    stockQuantity: 27,
    warrantyMonths: 12,
    preparationDelayHours: 1,
    stockLocationType: 'suguba_hub',
    stockLocationAddress: 'Hub Suguba ACI 2000',
    status: 'approved',
    isFeatured: true,
    marketingPitch: `📱 NOUVEAU SMARTPHONE 128 GO FLUIDE & RAPIDE !
Double SIM 4G, batterie 5000mAh pour tenir 2 jours entiers.
✅ Neuf dans sa boîte scellée avec garantie 1 an
💰 Prix exceptionnel : 85 000 FCFA
🛵 Livraison Bamako dans la journée.
Commander sans tarder : `,
    createdAt: '2026-02-12T09:00:00Z',
  },
  {
    id: 'prd-5',
    supplierId: 'sup-2',
    supplierName: 'Koné Import Solaire',
    name: 'Ventilateur Rechargeable Solaire 16" avec Télécommande',
    slug: 'ventilateur-rechargeable-solaire-16',
    category: 'Électroménager',
    description: 'Grand ventilateur silencieux haute puissance avec batterie rechargeable intégrée et panneau solaire. Autonomie jusqu à 8 heures en vitesse continue.',
    images: [
      'https://images.unsplash.com/photo-1618944847828-82e943c3bdb7?w=800&q=80'
    ],
    supplierPrice: 35000,
    publicPrice: 48000,
    resellerCommission: 5000,
    sugubaMargin: 8000,
    stockQuantity: 18,
    warrantyMonths: 6,
    preparationDelayHours: 2,
    stockLocationType: 'supplier',
    stockLocationAddress: 'Zone Industrielle Sotuba',
    status: 'submitted', // En attente de modération par Suguba
    isFeatured: false,
    marketingPitch: `💨 RESTEZ AU FRAIS MÊME PENDANT LES COUPURES !
Ventilateur rechargeable 16 pouces solaire avec port USB.
💰 Prix : 48 000 FCFA
🛵 Livraison partout à Bamako.`,
    createdAt: '2026-02-16T14:00:00Z',
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-10428',
    orderNumber: 'SG-10428',
    productId: 'prd-1',
    productName: 'Smart TV Samsung 43" Full HD Cristal',
    productImage: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    resellerCode: 'MOUSSA123',
    resellerCommission: 10000,
    quantity: 1,
    unitPrice: 145000,
    totalProductAmount: 145000,
    deliveryFee: 2000,
    totalAmount: 147000,
    customerName: 'Fatoumata Bamba',
    customerPhone: '+223 75 44 33 22',
    city: 'Bamako',
    neighborhood: 'Hamdallaye ACI 2000',
    landmark: 'En face de la clinique Pasteur, Immeuble vert',
    deliveryNotes: 'Appeler avant de venir, présente après 15h.',
    status: 'in_transit',
    deliveryOtp: '5832',
    driverId: 'drv-1',
    driverName: 'Amadou Traoré',
    driverPhone: '+223 74 88 99 00',
    paymentMethod: 'cash_on_delivery',
    paymentCollected: false,
    callVerifiedBy: 'usr-admin-1',
    callVerifiedAt: '2026-02-18T09:30:00Z',
    createdAt: '2026-02-18T08:15:00Z',
  },
  {
    id: 'ord-10427',
    orderNumber: 'SG-10427',
    productId: 'prd-2',
    productName: 'Mixeur Blender Multifonction 2-en-1 Puissant 600W',
    productImage: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    resellerCode: 'MOUSSA123',
    resellerCommission: 4000,
    quantity: 1,
    unitPrice: 40000,
    totalProductAmount: 40000,
    deliveryFee: 1500,
    totalAmount: 41500,
    customerName: 'Kadiatou Sangaré',
    customerPhone: '+223 66 11 99 88',
    city: 'Bamako',
    neighborhood: 'Kalaban Coura',
    landmark: 'Près du terrain de football, Rue 12',
    status: 'delivered',
    deliveryOtp: '9142',
    driverId: 'drv-1',
    driverName: 'Amadou Traoré',
    driverPhone: '+223 74 88 99 00',
    paymentMethod: 'cash_on_delivery',
    paymentCollected: true,
    callVerifiedBy: 'usr-admin-1',
    callVerifiedAt: '2026-02-17T11:00:00Z',
    deliveredAt: '2026-02-17T15:45:00Z',
    createdAt: '2026-02-17T10:20:00Z',
  },
  {
    id: 'ord-10426',
    orderNumber: 'SG-10426',
    productId: 'prd-3',
    productName: 'Kit Solaire Domestique Autonome 4 Lampes',
    productImage: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=800&q=80',
    resellerId: 'res-2',
    resellerName: 'Awa Diakité',
    resellerCode: 'AWA_BKO',
    resellerCommission: 6500,
    quantity: 1,
    unitPrice: 65000,
    totalProductAmount: 65000,
    deliveryFee: 2000,
    totalAmount: 67000,
    customerName: 'Seydou Touré',
    customerPhone: '+223 72 33 44 55',
    city: 'Bamako',
    neighborhood: 'Yirimadio',
    landmark: 'À 50m du stade du 26 Mars, près de la boulangerie',
    status: 'pending_call', // Nouvelle commande attendant l'appel de confirmation Suguba
    deliveryOtp: '3419',
    paymentMethod: 'cash_on_delivery',
    paymentCollected: false,
    createdAt: '2026-02-18T10:05:00Z',
  }
];

export const INITIAL_COMMISSIONS: Commission[] = [
  {
    id: 'com-1',
    commissionCode: 'COM-001',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    orderId: 'ord-10427',
    orderNumber: 'SG-10427',
    productName: 'Mixeur Blender Multifonction 2-en-1',
    amount: 4000,
    status: 'locked', // Période de sécurité en cours (J+7)
    safetyWindowDays: 7,
    unlockAt: '2026-02-24T15:45:00Z',
    createdAt: '2026-02-17T15:45:00Z',
  },
  {
    id: 'com-2',
    commissionCode: 'COM-002',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    orderId: 'ord-10428',
    orderNumber: 'SG-10428',
    productName: 'Smart TV Samsung 43"',
    amount: 10000,
    status: 'pending', // En cours de livraison
    safetyWindowDays: 7,
    unlockAt: '2026-02-25T18:00:00Z',
    createdAt: '2026-02-18T08:15:00Z',
  },
  {
    id: 'com-3',
    commissionCode: 'COM-003',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    orderId: 'ord-10399',
    orderNumber: 'SG-10399',
    productName: 'Smartphone Android 128Go',
    amount: 6000,
    status: 'available', // Sécurité passée, disponible pour retrait
    safetyWindowDays: 7,
    unlockAt: '2026-02-10T12:00:00Z',
    createdAt: '2026-02-03T12:00:00Z',
  },
  {
    id: 'com-4',
    commissionCode: 'COM-004',
    resellerId: 'res-2',
    resellerName: 'Awa Diakité',
    orderId: 'ord-10426',
    orderNumber: 'SG-10426',
    productName: 'Kit Solaire Domestique Autonome',
    amount: 6500,
    status: 'potential',
    safetyWindowDays: 14, // Nouveau revendeur = 14 jours
    unlockAt: '2026-03-04T10:00:00Z',
    createdAt: '2026-02-18T10:05:00Z',
  }
];

export const INITIAL_WITHDRAWALS: Withdrawal[] = [
  {
    id: 'wth-1',
    withdrawalCode: 'WTH-8821',
    resellerId: 'res-1',
    resellerName: 'Moussa Coulibaly',
    amount: 20000,
    payoutProvider: 'Orange Money',
    payoutPhone: '+223 79 11 22 33',
    status: 'completed',
    transactionReference: 'OM-CI-20260215-99412',
    processedAt: '2026-02-15T16:20:00Z',
    createdAt: '2026-02-15T14:10:00Z',
  },
  {
    id: 'wth-2',
    withdrawalCode: 'WTH-8890',
    resellerId: 'res-2',
    resellerName: 'Awa Diakité',
    amount: 10000,
    payoutProvider: 'Wave',
    payoutPhone: '+223 66 44 55 66',
    status: 'pending',
    createdAt: '2026-02-18T09:00:00Z',
  }
];

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
