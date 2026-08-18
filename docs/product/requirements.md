# Spécifications & Exigences Produit (Requirements) — Suguba V1

| ID | Module | Description | Critères d'Acceptation |
| :--- | :--- | :--- | :--- |
| **REQ-001** | Auth / Profils | Connexion & Inscription multi-rôles (Fournisseur, Revendeur, Livreur, Admin) avec gestion de session sécurisée. | L'utilisateur peut se connecter, voir son profil et être redirigé vers son espace dédié selon son rôle. |
| **REQ-002** | Catalogue Fournisseur | Le fournisseur ajoute un produit avec photos, prix fournisseur, stock, localisation et délai. | Le produit est créé avec le statut `SUBMITTED` et n'est pas public tant qu'il n'est pas approuvé. |
| **REQ-003** | Modération Suguba | L'admin modère les produits, fixe le Prix Public, la Commission Revendeur fixe, et la Marge Suguba. | Le statut passe à `APPROVED` et le produit apparaît dans le catalogue des revendeurs avec les gains nets affichés. |
| **REQ-004** | Espace Revendeur | Dashboard revendeur avec solde disponible, solde en attente, statistiques de vente et classement. | Le revendeur visualise clairement ses gains financiers en FCFA et l'état de ses commandes. |
| **REQ-005** | Partage & Liens Affiliés | Bouton de partage WhatsApp en 1-clic avec texte pré-rédigé, photos téléchargeables et lien `?ref=CODE`. | Le clic ouvre WhatsApp avec le message prêt à l'envoi et le lien rattaché au revendeur. |
| **REQ-006** | Commande Express Revendeur | Le revendeur peut saisir lui-même la commande d'un client conclue sur WhatsApp. | La commande est enregistrée avec le nom, téléphone, quartier, repère, et liée automatiquement au revendeur. |
| **REQ-007** | Tunnel Client Public | Le client accédant à un lien produit peut commander en 1 étape sans créer de compte. | Formulaire épuré (Nom, Téléphone, Ville/Quartier, Repère) avec confirmation immédiate et numéro de commande. |
| **REQ-008** | Centre d'Appel Suguba | L'administrateur confirme la commande par téléphone ou WhatsApp avant de lancer la livraison. | Statut passe de `NEW` à `CONFIRMED` avec historique des notes d'appel. |
| **REQ-009** | Dispatch & Livreur | L'admin assigne un livreur. Le livreur voit les détails du colis, du client et le montant à encaisser. | Le livreur reçoit l'ordre de mission et peut appeler le client en 1 tap. |
| **REQ-010** | Preuve de Livraison OTP | Le client reçoit un code OTP secret à 4 chiffres. Le livreur doit saisir ce code pour valider la livraison. | La validation par OTP passe la commande à `DELIVERED`, encaisse le montant et passe la commission en `LOCKED`. |
| **REQ-011** | Machine d'État Commissions | Gestion des commissions : `PENDING` -> `LOCKED` (période de sécurité 7 ou 14 jours) -> `AVAILABLE`. | Après écoulement du délai, le montant passe automatiquement dans le solde disponible retirable. |
| **REQ-012** | Retraits Mobile Money | Le revendeur peut demander un retrait vers Orange Money, Wave ou Moov (seuil min. 5 000 FCFA). | La demande est enregistrée, vérifiée par l'admin et enregistrée dans le registre d'audit. |
