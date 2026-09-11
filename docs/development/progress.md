# Journal de Progression — Suguba V1

> Mis à jour le 2026-09-11. Historique détaillé : `git log` et `REPRISE.md`.

| Tâche | Module | Description | Statut |
| :--- | :--- | :--- | :--- |
| `TASK-001` | Auth / Profils | Connexion Google/email, choix du profil, `/register/complete` imposé | ✅ Terminé (refait le 2026-09-10) |
| `TASK-002` | Fournisseur | Dépôt produit (6 photos, part revendeur), publication automatique | ✅ Terminé (2026-09-11) |
| `TASK-003` | Admin Ops | Réglages économiques, tarification, tableau de simulation, `/admin/products` | ✅ Terminé (2026-09-11) |
| `TASK-004` | Revendeur | Tableau de bord sur données réelles, paliers 14/7/3 | ✅ Terminé |
| `TASK-005` | Partage WhatsApp | Partage photo + texte + lien en un clic (`src/lib/partage.ts`) ; l'ancienne `ShareModal` est supprimée | ✅ Terminé (2026-09-11) |
| `TASK-006` | Commande Express | Saisie manuelle de commande client WhatsApp (`CreateOrderModal`) | ✅ Terminé |
| `TASK-007` | Client sans compte | Commande depuis `/p/[slug]`, devis calculé par le serveur | ✅ Terminé |
| `TASK-008` | Desk d'Appel | Confirmation téléphonique des commandes | ✅ Terminé |
| `TASK-009` | Dispatch Livreur | Assignation aux seuls livreurs vérifiés au guichet | ✅ Terminé |
| `TASK-010` | Preuve OTP | Validation du code côté serveur | ✅ Terminé |
| `TASK-011` | Commissions | Cycle `pending` → `locked` → `available`, côté serveur | ✅ Terminé |
| `TASK-012` | Retraits | Versements SasPay (Orange, Moov, Mobi Cash — **pas Wave**, non couvert au Mali) | ✅ Code terminé, aucun versement réel |
| `TASK-013` | Affiches | Affiche 1080×1920 pour statut WhatsApp (`src/lib/affiche.ts`) | ✅ Terminé (2026-09-11) |
| `TASK-014` | PWA | Service worker v3, photos allégées avant l'envoi | ✅ Terminé (2026-09-11) |
| `TASK-015` | Catalogue | Remplir avec de vrais produits photographiés | ⏳ À faire |
| `TASK-016` | Diaspora | Brancher le rôle sur la base | ⏳ À faire |
