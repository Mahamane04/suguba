# Registre des Décisions d'Architecture (ADR) — Suguba

> Mis à jour le 2026-09-11. Contexte complet et pièges : `REPRISE.md` à la racine.

## ADR-001 : Choix de Next.js 15 App Router & React 19
- **Statut** : ACCEPTÉ
- **Contexte** : Nécessité de servir de nombreuses routes avec un rendu hybride (SSR + statique) et des routes API pour les webhooks.
- **Conséquence** : Compatible Vercel. Piège connu : `next dev` ne détecte pas tout, toujours valider par `npm run build`.

## ADR-002 : Authentification par Téléphone & OTP à 4 Chiffres
- **Statut** : REMPLACÉ par ADR-006 (2026-08-26)
- **Contexte** : Aucune passerelle SMS réelle n'a jamais été branchée : ce chemin ne délivrait aucun code à un vrai utilisateur.

## ADR-003 : Validation de Livraison par Code OTP Client Secret
- **Statut** : ACCEPTÉ
- **Conséquence** : Seul le client détient le code ; la validation se fait **côté serveur** (`/api/driver/verify-delivery-otp`), avec vérification d'appartenance de la commande et verrou à 3 tentatives.

## ADR-004 : Séquestre de Sécurité des Commissions
- **Statut** : ACCEPTÉ (précisé le 2026-09-09)
- **Conséquence** : La commission passe en `locked` à la livraison, puis `available` après 14 jours (nouveau revendeur), 7 jours (dès 10 ventes livrées) ou 3 jours (dès 30). Appliqué côté serveur.

## ADR-005 : Synchronisation Hybride (mémoire locale + Supabase)
- **Statut** : ACCEPTÉ, encadré par ADR-012
- **Conséquence** : Le catalogue est gardé dans la mémoire du téléphone et resynchronisé ; les montants, statuts et droits ne sont jamais décidés par le navigateur.

## ADR-006 : Connexion par Google ou lien email uniquement
- **Statut** : ACCEPTÉ (2026-08-26, parcours refait le 2026-09-10)
- **Conséquence** : Aucun compte n'est créé sans rôle choisi ; `/register/complete` (nom, WhatsApp, champs du rôle) est imposé par le middleware tant que le profil n'a pas de numéro.

## ADR-007 : SasPay, seule passerelle de paiement
- **Statut** : ACCEPTÉ (2026-09-09)
- **Conséquence** : Encaissement (Softpay) et versement des commissions (Payouts). Webhooks signés, toujours re-vérifiés par l'API. Aucun mode « simulation ». Wave n'est pas couvert au Mali.

## ADR-008 : Plus de validation manuelle des comptes
- **Statut** : ACCEPTÉ (2026-09-10)
- **Conséquence** : Tous les comptes naissent actifs. Le contrôle se fait là où il y a de la valeur : délai des commissions (revendeur), vérification physique au guichet (livreur, `drivers.active_status`).

## ADR-009 : Tarification calculée par le serveur
- **Statut** : ACCEPTÉ (2026-09-10)
- **Conséquence** : `src/lib/pricing.ts` (fonctions pures) calcule plancher, commission et devis ; les montants d'une commande sont figés dans `pricing_snapshot`. Aucune route n'accepte un montant du navigateur, sauf la part revendeur choisie par le fournisseur (ADR-011).

## ADR-010 : Publication automatique des produits
- **Statut** : ACCEPTÉ (2026-09-11, décision de l'utilisateur)
- **Conséquence** : Un produit avec au moins une photo et un prix rentable part en vente au prix recommandé ; l'admin contrôle après coup (`/admin/products`). Un produit retiré par l'admin n'est jamais republié automatiquement.

## ADR-011 : Part revendeur choisie par le fournisseur
- **Statut** : ACCEPTÉ (2026-09-11, décision de l'utilisateur)
- **Conséquence** : Prix client = prix fournisseur + part revendeur + part Suguba (% du prix de vente ou % de la part revendeur, réglé par l'admin), toujours relevé au plancher des coûts. Colonne `products.commission_proposee`.

## ADR-012 : Aucune donnée d'API dans le cache hors ligne
- **Statut** : ACCEPTÉ (2026-09-11)
- **Conséquence** : Le service worker (v3) garde pages et photos, jamais les réponses `/api/` (données privées sur téléphone partagé, réponses périmées trompeuses).

## ADR-013 : Partage natif avec photo
- **Statut** : ACCEPTÉ (2026-09-11)
- **Conséquence** : Partage en un clic via Web Share (photo + texte + lien), repli sur `wa.me` ; aperçu Open Graph généré par le serveur. Les affiches sont générées avant le clic de partage (exigence iPhone).
