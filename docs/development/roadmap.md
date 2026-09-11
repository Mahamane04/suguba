# Feuille de Route & Jalons (Roadmap) — Suguba V1

> Mis à jour le 2026-09-11. État détaillé : `REPRISE.md` à la racine.

## Jalons réalisés
- [x] **M0 : Cadrage & Architecture**
- [x] **M1 : Socle technique & multi-rôle** (`profile_roles`), connexion Google/email
- [x] **M2 : Catalogue fournisseur** — dépôt avec plusieurs photos, publication automatique (2026-09-11)
- [x] **M3 : Expérience revendeur** — partage WhatsApp photo + lien en un clic, affiches pour statut, boutique `/r/<code>`
- [x] **M4 : Tunnel client sans compte & suivi de commande**
- [x] **M5 : Logistique terrain, desk d'appel & preuve OTP côté serveur**
- [x] **M6 : Moteur de commissions** (séquestre 14/7/3 jours) & retraits
- [x] **M9 : PWA** — service worker v3 sans cache d'API, photos allégées
- [x] **M10 : Paiement réel SasPay** (2026-09-09) — `src/lib/saspay.ts`, `/api/payments/saspay/*`, `/api/webhooks/saspay`, versements via `/api/payouts/initiate`. En service ; aucun paiement réel encaissé à ce jour.
- [x] **M11 : Tarification automatique** — moteur serveur, réglages économiques, devis unique (2026-09-10)
- [x] **M12 : Part revendeur choisie par le fournisseur** + tableau de simulation admin (2026-09-11)

## Prochains jalons
- [ ] **Remplir le catalogue** avec de vrais produits photographiés (blocage commercial n° 1)
- [ ] **Premier paiement et premier versement réels** via SasPay
- [ ] **Rôle Diaspora** branché sur la base
- [ ] **Tests réels sur téléphone** : partage avec photo, affiche en statut, dépôt de photos
- [ ] Décisions en attente de l'utilisateur : voir `REPRISE.md`
