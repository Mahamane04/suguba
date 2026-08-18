# Inventaire des Écrans & États UX — Suguba SaaS

## 1. Cartographie Complète des Écrans

```
📱 APPLICATION SUGUBA MOBILE-FIRST
│
├── 🌐 Espace Public & Découverte
│   ├── [SCR-001] Accueil & Hub Multi-Rôles (/)
│   ├── [SCR-002] Connexion & Choix de Profil (/login)
│   ├── [SCR-003] Page Produit Client (/p/[slug])
│   └── [SCR-004] Confirmation Commande avec Code OTP (/order-success/[orderNumber])
│
├── 🤝 Espace Revendeur (/reseller)
│   ├── [SCR-005] Dashboard Principal (Soldes, Ventes, Classement)
│   ├── [SCR-006] Catalogue Rémunéré & Recherche (/reseller/catalog)
│   ├── [SCR-007] Modale Kit Marketing WhatsApp (ShareModal)
│   ├── [SCR-008] Modale Commande Express WhatsApp (CreateOrderModal)
│   ├── [SCR-009] Suivi des Ventes & Statuts (/reseller/orders)
│   ├── [SCR-010] Mes Commissions & Retraits Mobile Money (/reseller/payouts)
│   └── [SCR-011] Centre Marketing & Scripts de Vente (/reseller/marketing)
│
├── 👨‍💼 Espace Fournisseur (/supplier)
│   ├── [SCR-012] Dashboard Fournisseur & Stocks (/supplier)
│   └── [SCR-013] Formulaire Nouveau Produit Soumis (/supplier/products/new)
│
├── 🛵 Espace Livreur Terrain (/driver)
│   ├── [SCR-014] Courses Actives & Repères de Quartier (/driver)
│   └── [SCR-015] Modale Validation Livraison par Code OTP (OtpValidationModal)
│
└── 🏢 Suguba Master Ops (Admin) (/admin)
    ├── [SCR-016] Tableau de Bord Global des Flux (/admin)
    ├── [SCR-017] Desk Appel Confirmation Client
    ├── [SCR-018] Modale Contrôle Économique & Marges (ProductPricingModal)
    ├── [SCR-019] Dispatch & Assignation des Courses
    └── [SCR-020] Validation des Virements Mobile Money
```

---

## 2. Matrice de Couverture des États UX (Conformité SaaS Factory V3)

Chaque écran de Suguba est conçu avec la gestion rigoureuse des 9 états obligatoires :

| Écran | Default | Loading | Empty | Success | Error | Validation | Disabled | Permission Denied | Network Loss |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **[SCR-006] Catalogue Revendeur** | Grille produits | Skeleton cards | Message recherche vide | Filtre appliqué | Alerte chargement | Filtres valides | Bouton stock 0 grisé | Redirection login | Mode hors-ligne PWA |
| **[SCR-007] Kit WhatsApp** | Visuel + Pitch | Spinner copie | N/A | Toast "Copié !" | Erreur presse-papier | Lien `?ref=` valide | N/A | N/A | Partage natif SMS |
| **[SCR-008] Commande Express** | Formulaire épuré | Bouton validation actif | Champs vides | Carte confirmation | Erreur saisie | Validation téléphone/repère | Bouton grisé si incomplet | N/A | Sauvegarde locale |
| **[SCR-010] Retrait MoMo** | Formulaire choix MoMo | Traitement virement | 0 retrait | Alerte succès | Solde insuffisant | Seuil min. 5 000 F | Grisé si solde < 5k | N/A | Avertissement réseau |
| **[SCR-015] Validation OTP** | Pavé numérique | Vérification code | 4 cases vides | Écran vert "Livré !" | "Code incorrect" | 4 chiffres requis | Grisé si < 4 chiffres | Livreur non assigné | Validation différée |
