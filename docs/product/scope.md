# Périmètre V1 & Hors Périmètre — Suguba SaaS

## 1. Périmètre V1 (Inclus)
- **Multi-Portails Dédiés (5 rôles)** :
  1. Espace Fournisseur (Ajout produits, gestion stock, suivi facturation).
  2. Espace Revendeur (Catalogue rémunéré, kits marketing WhatsApp, liens affiliés, saisie de commande express, suivi des commissions et retraits).
  3. Tunnel Client Public & Tracking (Commande 1-étape sans compte, fiche produit responsive, statut de commande).
  4. Espace Livreur Terrain (Liste des livraisons, guidage repères, validation par OTP client).
  5. Back-Office Suguba Ops (Modération catalogue, fixation des marges et commissions fixes, desk de confirmation téléphonique, dispatch livreurs, approbation des retraits).
- **Moteur Économique & Commissions** :
  - Prix Fournisseur + Commission Revendeur Fixe + Marge Suguba = Prix Public.
  - Machine d'états comptable : `PENDING` $\rightarrow$ `LOCKED` (délai de sécurité 7j/14j) $\rightarrow$ `AVAILABLE` $\rightarrow$ `PAID`.
- **Preuve de Livraison Sécurisée** : Code OTP à 4 chiffres généré pour chaque commande et remis au livreur.
- **Demandes de Retrait** : Vers Mobile Money (Orange Money, Wave, Moov).
- **Interface Mobile-First / PWA** : Accessible sur smartphone, réactive, avec mode hors-ligne basique et navigation intuitive au pouce.

## 2. Hors Périmètre V1 (Reporté en V1.1 / V2)
- Flotte interne de 100+ livreurs salariés avec géolocalisation GPS en temps réel temps continu (V1 utilise livreurs partenaires/indépendants avec dispatch semi-automatique).
- Passerelle bancaire internationale Visa/Mastercard (priorité absolue à Mobile Money et Cash à la livraison).
- Système complexe de commissions multi-niveaux / MLM (V1 utilise commission fixe unitaire par produit).
- Entrepôts logistiques géants automatisés (V1 utilise modèle hybride : stock chez le fournisseur + petit hub Suguba pour best-sellers).
