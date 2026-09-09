# Suguba — Fiche de reprise (9 septembre 2026)

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
6. **SasPay est désormais la seule passerelle de paiement** (2026-09-09) — encaissement
   **et** versement, code fait, build vérifié :
   - `src/lib/saspay.ts`, `/api/payments/saspay/create`, `/api/payments/saspay/status`,
     `/api/webhooks/saspay`, `supabase/migration-saspay.sql`.
   - **Supprimés** : LigdiCash (`src/lib/ligdicash.ts` + ses 2 routes), CinetPay/Wave
     (`src/lib/momo-gateway.ts`, `/api/webhooks/momo`), et le desk de paiement manuel
     `MobileMoneyPaymentDesk` (codes USSD à recopier + lien Wave vers le 89 46 00 00),
     remplacé par `SasPayPaymentDesk`. `.env.example` nettoyé de PayDunya, CinetPay, Wave
     et de la passerelle SMS (l'OTP maison ayant été retiré en août).
   - Contrairement à LigdiCash, **SasPay signe ses webhooks** (HMAC-SHA256 sur
     `timestamp.corps`, tolérance 5 min). Signature vérifiée en temps constant, 9 cas de
     test passés (corps modifié, signature forgée, mauvais secret, rejeu, horodatage
     rajeuni…). Une notification non signée est rejetée en **403**, pas ignorée.
   - Le corps du webhook n'est jamais la source de vérité malgré la signature : chaque
     notification déclenche une re-vérification `GET /payments/{id}/verify/`.
   - **Bug d'argent corrigé au passage** : `momoGateway.createPayout` basculait en « mode
     simulation » dès qu'aucune clé n'était configurée — il renvoyait `success: true` avec
     un faux numéro de transaction, et `/api/payouts/initiate` marquait alors le retrait
     `completed` **en consommant les commissions du revendeur, sans qu'un centime bouge**.
     La nouvelle route n'a aucun mode dégradé : sans clé elle échoue, et un retrait ne passe
     `completed` qu'à la confirmation du webhook (`processing` en attendant).
   - ✅ **Mis en service le 2026-09-09** et vérifié en production : clé `sk_live_`
     authentifiée, réseaux Mali actifs, portefeuilles `ML/XOF` et `XX/USD` ouverts,
     migration appliquée, code déployé (commit `e802fb1`), webhook `9e74305b` actif et
     abonné aux 4 events `transaction.*`. Test signé de bout en bout : **200**. Rejets
     confirmés en 403 sur signature forgée, rejeu hors tolérance et corps modifié.
   - ⚠️ **Aucun paiement réel n'a encore été encaissé** : le solde `ML/XOF` est à 0. Le
     premier vrai client reste le seul test qui vaille.

---

## ⚠️ À vérifier en tout premier

**Migrations SQL à confirmer comme appliquées** (l'utilisateur les a appliquées au fil de la
session précédente, mais à reconfirmer avant de considérer le sujet clos) :
- `migration-multi-role.sql`
- `migration-suppliers.sql`
- `migration-drivers.sql`
- `migration-order-status.sql`
- `migration-saspay.sql` — **nouvelle, jamais appliquée**. Ajoute
  `payment_transaction_id` + `payment_network` sur `orders` et `payouts`, avec index
  UNIQUE partiels. Sans elle, aucun paiement SasPay ne peut être rattaché à une commande.

Vérification rapide (lecture seule, service_role) : tenter un `select` sur les colonnes/tables
attendues (`suppliers`, `drivers`, `orders.payment_invoice_token`, etc.) plutôt que de supposer.

**SasPay est en service** (2026-09-09, tout vérifié en production). Ce qui reste à
surveiller : le solde `ML/XOF` est à **0**, et c'est de ce solde que partent les versements
de commissions. Un `POST /payouts/initialize/` sur un wallet vide échoue en `422` — la route
remet alors le retrait en `pending` et rend son solde au revendeur, donc rien n'est perdu,
mais le virement ne part pas. **Encaisser avant de verser, ou approvisionner le wallet.**

Commande de contrôle de l'intégration (lecture seule, aucune transaction) :

```bash
KEY=$(grep '^SASPAY_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -H "Authorization: Bearer $KEY" https://api.saspay.me/api/v1/merchant-webhook-subscriptions/
curl -s -H "Authorization: Bearer $KEY" https://api.saspay.me/api/v1/merchant-balances/
```

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
8. ~~**Versement des commissions**~~ — code fait le 2026-09-09 via SasPay Payouts. Reste à
   valider avec de vraies clés : aucun virement réel n'a encore été déclenché.
9. **Revendeurs payés en Wave** — `payouts.payment_method` accepte encore `wave`, que SasPay
   ne couvre pas au Mali. La route de versement le refuse explicitement (422 avec un message
   lisible) plutôt que d'échouer obscurément, mais ces revendeurs ne peuvent pas être payés
   automatiquement : il faut leur demander un numéro Orange, Moov ou Mobi Cash.

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
- **Le webhook SasPay ne transporte PAS nos `metadata`.** Son `data` ne contient que l'id de
  transaction SasPay, sa référence interne, le statut et les montants — aucun numéro de
  commande Suguba. Le mécanisme LigdiCash (`custom_data.reference` = notre `order_number`)
  est donc **irreproductible**. D'où deux conséquences structurantes :
  1. on stocke l'id SasPay sur la ligne **à l'initiation** (`payment_transaction_id`), et le
     webhook retrouve la commande par cet id ;
  2. on encaisse via `POST /payments/softpay/` (qui renvoie l'id tout de suite) et **non**
     via `POST /checkout-sessions/`, dont le champ `transaction` vaut `null` à la création —
     un webhook y serait impossible à rattacher. Ne pas « simplifier » vers checkout-sessions.
- **Softpay ne pousse pas toujours sur le téléphone.** Si la réponse contient une
  `checkout_url` non vide, **aucune demande n'arrivera sur le téléphone du client** : il faut
  le rediriger, sinon le paiement n'a jamais lieu. C'est le comportement normal d'Orange
  Money et des cartes, et un même réseau peut basculer d'un mode à l'autre sans préavis.
  Toujours tester `checkout_url` avant de conclure au push.
- **SasPay ne couvre pas Wave au Mali.** Réseaux disponibles : `orange_ml`, `moov_ml`,
  `mobi_cash_ml`. Ne pas ajouter `wave_ml` « au cas où » — un code réseau inconnu fait un 422
  `invalid_method`. (Wave existe chez SasPay en Côte d'Ivoire et au Sénégal, pas au Mali.)
- **Le portail Diaspora utilise le réseau global `card`** — carte bancaire via Stripe,
  **facturée en USD** quel que soit le `country` envoyé, avec conversion automatique depuis
  le XOF au taux configuré sur le compte. `return_url` y est **obligatoire** (422 sinon), et
  `customer.phone` reste exigé même s'il n'est jamais utilisé.
- **Le `signing_secret` du webhook SasPay n'est affiché qu'une seule fois**, à la création
  dans le tableau de bord. Perdu, il faut en générer un nouveau (Webhooks → Changer le
  secret). Il n'est jamais renvoyé en lecture par l'API.
- **Créer ou modifier un webhook SasPay se fait uniquement au tableau de bord**, pas par API
  (la clé ne donne accès qu'à la consultation et à l'historique de livraison).
- **Le `matcher` du middleware ne couvrait qu'une seule route API** (`/api/payouts/initiate`).
  Toutes les autres se défendaient elles-mêmes — ce qui marche tant que chaque auteur y
  pense, mais une nouvelle route écrite sans son contrôle serait restée ouverte sans que
  rien ne le signale. Étendu le 2026-09-09 à toutes les routes à rôle
  (`/api/admin|driver|supplier|reseller/*`, `/api/payouts/*`) et à celles exigeant une
  session. Les routes gardent leur propre contrôle : défense en profondeur, pas délégation.
  ⚠️ `/api/payouts/` mélange deux rôles (`create` → revendeur, `initiate` → admin) : deux
  entrées explicites, jamais un préfixe commun.
- **Deux sens du mot « retrait » chez SasPay, à ne pas confondre.** Le versement d'une
  commission (Suguba → revendeur) est un **payout**, et il produit un event
  `transaction.*` — pas un `settlement.*`. Les events `settlement.*` (pastilles « Retrait
  demandé/approuvé/réussi… » du dashboard) concernent le retrait de ton propre solde SasPay
  vers ta banque : aucun rapport avec les commissions, et la doc précise que la forme de
  leur `data` n'est pas garantie. Ne pas s'y abonner.
- **Le modèle d'abonnement webhook n'a pas de champ `is_active`.** Un script qui le lit
  obtient `None` et pourrait conclure à tort que l'abonnement est inactif. Sa seule
  existence suffit.
- **`payouts.status` n'accepte que `pending`/`processing`/`completed`/`rejected`** (contrainte
  CHECK). Écrire `failed` ferait échouer la mise à jour — même famille de piège que
  l'incohérence de statut des commandes corrigée en août. Un versement raté s'écrit
  `rejected`.
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
