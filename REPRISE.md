# Suguba — Fiche de reprise (8 septembre 2026)

État réel du projet, basé sur l'historique git vérifié — remplace la version du 22 août,
restée figée alors que le projet a beaucoup avancé depuis.

---

## Fait et déployé

1. **Audit de sécurité initial** — RLS resserrées, session signée HMAC, middleware par rôle.
2. **Multi-rôle** (`profile_roles`) — un compte peut cumuler plusieurs rôles (ex: revendeur + livreur).
3. **Téléphone/OTP maison entièrement retiré** (2026-08-26) — aucune passerelle SMS réelle
   n'a jamais été branchée, ce chemin ne délivrait donc jamais de code à un vrai utilisateur.
   Inscription/connexion se font désormais uniquement via **Google** ou lien magique par
   **email**, pour les 4 rôles (revendeur, fournisseur, livreur, diaspora).
   - `/register/complete` collecte les champs métier propres à chaque rôle après le retour Google.
   - `AuthHashCatcher` (2026-09-08) intercepte les retours OAuth Google mal redirigés vers `/`
     au lieu de `/auth/callback`, et les renvoie au bon endroit.
4. **Rôle Fournisseur branché sur Supabase** (2026-08-26) :
   - Vraie table `suppliers` (`migration-suppliers.sql`), dashboard réel, dépôt produit fiable.
   - Faille corrigée : un fournisseur pouvait usurper l'identité d'un autre sur un produit déposé.
   - Faille corrigée : l'admin ne voyait les dépôts produits que depuis son propre navigateur
     (RLS bloquait la lecture anonyme des produits non approuvés).
5. **Rôle Livreur branché sur Supabase** (2026-08-26), avec une faille sérieuse trouvée et
   corrigée au passage :
   - **Avant le correctif** : n'importe quel livreur connecté voyait TOUTES les commandes de
     TOUS les clients (noms, téléphones, adresses), y compris le code OTP de livraison en
     clair pour des commandes qui n'étaient pas les siennes — la validation se faisait
     entièrement côté navigateur.
   - Validation OTP déplacée entièrement côté serveur (`/api/driver/verify-delivery-otp`),
     avec vérification d'appartenance de la commande et verrou à 3 tentatives.
   - Le dispatch admin→livreur ne poussait jamais vers Supabase (`assignDriver` ne faisait
     que `notify()` local) — un vrai livreur ne voyait jamais ses courses assignées depuis
     son propre appareil. Corrigé.
   - Incohérence de statut en base (`assigned_driver`/`in_delivery` dans la contrainte CHECK
     vs `dispatched`/`in_transit` utilisé par tout le code applicatif) qui aurait fait
     échouer silencieusement toute vraie mise à jour de dispatch — corrigée
     (`migration-order-status.sql`).
6. **PayDunya remplacé par LigdiCash** (2026-08-26) — code fait et déployé :
   - `src/lib/ligdicash.ts`, `/api/payments/ligdicash/create`, `/api/webhooks/ligdicash`.
   - LigdiCash ne signe pas ses webhooks (contrairement à PayDunya) : chaque notification
     est re-vérifiée auprès de LigdiCash via un jeton stocké côté serveur à la création
     (`migration-ligdicash.sql`, colonne `payment_invoice_token`).
   - ⏳ **Bloqué sur les clés API** — en attente de `LIGDICASH_API_KEY` / `LIGDICASH_API_TOKEN`
     de la part de l'équipe LigdiCash (documents envoyés, réponse en attente).

---

## ⚠️ À vérifier en tout premier

**Migrations SQL à confirmer comme appliquées** (l'utilisateur les a appliquées au fil de la
session précédente, mais à reconfirmer avant de considérer le sujet clos) :
- `migration-multi-role.sql`
- `migration-suppliers.sql`
- `migration-drivers.sql`
- `migration-order-status.sql`
- `migration-ligdicash.sql`

Vérification rapide (lecture seule, service_role) : tenter un `select` sur les colonnes/tables
attendues (`suppliers`, `drivers`, `orders.payment_invoice_token`, etc.) plutôt que de supposer.

**Clés LigdiCash** — vérifier si reçues depuis la dernière session ; si oui, les ajouter dans
Vercel (`LIGDICASH_API_KEY`, `LIGDICASH_API_TOKEN`) et tester un paiement réel avant qu'un
vrai client s'en serve.

---

## Chantiers non commencés

1. **Rôle Diaspora** — même traitement que Fournisseur/Livreur (table réelle, dashboard,
   inscription). Prochain sur la liste, jamais démarré.
2. **Remplir le catalogue** — toujours vide, le vrai blocage commercial.
3. **Terminer le multi-rôle côté UI** — sélecteur d'espace dans le Header, page pour
   demander un rôle supplémentaire (`/api/auth/request-role` existe déjà côté serveur).
4. **Parcours invité** — suivi de commande sans compte, invitation à devenir revendeur
   juste après une livraison réussie.
5. **Vérification d'identité** fournisseurs/livreurs.
6. **Scores calculés** (livreurs, boutiques) — décision explicite de ne PAS les simuler tant
   qu'il n'y a pas de vraies transactions. Ne jamais initialiser un score à une valeur par défaut.
7. **Audit mobile des tableaux de bord authentifiés** (fait sur les pages publiques seulement).
8. **Versement des commissions (Payout LigdiCash)** — non commencé.

---

## Pièges déjà rencontrés (ne pas les redécouvrir)

- **`next dev` ne détecte pas tout.** Toujours tester avec un vrai `npm run build` avant de
  conclure qu'un déploiement va réussir (un `useSearchParams()` sans `<Suspense>` a déjà fait
  échouer tous les déploiements Vercel silencieusement).
- **Le Service Worker PWA cache les anciens bundles JS.** En cas de comportement qui ne colle
  pas avec le code déployé : `unregister()` le SW + vider les caches avant de chercher ailleurs.
- **`localStorage` peut ressusciter des données supprimées du code et de la base.** Changer la
  clé de stockage (`suguba_platform_state_v1` → `v2` → ...) invalide les anciens caches.
- **Le statut vivait dans un cookie de session signé de 7 jours, pas seulement en base** —
  toute action admin qui change un statut doit forcer un rafraîchissement de session.
- **Ne jamais faire de boucles `curl` rapprochées sur la prod** — déclenche le Attack
  Challenge Mode de Vercel (403 sur tout le site, pas juste l'IP fautive).
- **Deux clés Supabase différentes existent** : ancien format JWT (`anon`, `service_role`) et
  nouveau (`sb_publishable_...`, `sb_secret_...`). Ne pas les confondre.
- **Vercel ne relit pas les variables d'environnement sans un nouveau déploiement explicite.**
- **Aucun environnement de test/sandbox séparé n'existe** — une seule base Supabase, un seul
  déploiement Vercel, utilisés en conditions réelles. Toute donnée de test doit être marquée
  clairement et nettoyée après usage.
- **LigdiCash n'a pas de sandbox** — un compte réel temporaire est fourni pendant
  l'intégration ; les tests se feront avec de vraies petites transactions.
- **RLS ne donne à la clé anon qu'un accès en LECTURE aux produits `approved`** — un dépôt
  fournisseur "submitted" est invisible à l'admin sans passer par une route service_role
  authentifiée (`/api/admin/products/pending`, même principe pour les commandes livreur).

---

## Identifiants et emplacements utiles

- Projet Supabase : `jwbryyaysptokzmfwijo` — `https://jwbryyaysptokzmfwijo.supabase.co`
- Domaine prod : `https://app.sugubaml.com` (hébergé sur Vercel)
- Admin : `+22371360525` / `infos@sugubaml.com`
- Scripts utiles : `scripts/create-admin.js`, `scripts/link-admin-google.js`,
  `scripts/purge-test-data.js` (`--confirm` obligatoire pour agir réellement)
- `.env.local` contient les vraies clés (Supabase service_role, SESSION_SECRET, OTP_PEPPER) —
  jamais les réafficher dans le chat, toujours passer par `grep` + copie locale si besoin
