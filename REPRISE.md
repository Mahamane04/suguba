# Suguba — Fiche de reprise (11 septembre 2026)

État réel du projet, basé sur l'historique git vérifié (dernier commit : `ddfe83c`, déployé et
vérifié en production). C'est LA fiche de référence : les documents de `docs/` renvoient ici.

---

## Lot déployé le 11 septembre 2026 — REQ-013 / TASK-017

**Lot REQ-013 / TASK-017 : commande confirmée après enregistrement atomique.**
`/api/orders/create` (en production) crée les commandes ; `/api/orders/sync` ne sert plus
qu'aux mises à jour internes authentifiées. Les trois formulaires (produit, revendeur,
diaspora) attendent le reçu serveur avant tout succès ou démarrage de paiement.

- Identifiant et numéro de commande, code secret et montants générés/calculés côté serveur.
- Attribution par le code revendeur transmis explicitement, même si son profil n'est
  pas chargé dans le navigateur. Un code inconnu ou une erreur de lecture est signalé.
- Transaction PostgreSQL unique : commande + commission `pending` + reçu de reprise.
  Échec d'une écriture = annulation complète. Même clé = même reçu, sans doublon.
- Clé de reprise aléatoire conservée dans l'onglet, seul son hash stocké en base.
  Bouton « Reprendre ma commande » après coupure/rechargement ; pas de remplacement
  silencieux des coordonnées d'une demande incertaine.
- Devis serveur dans les trois formulaires, ancien devis invalidé lors d'un changement
  de quantité/ville. Aucun coût de repli après une erreur de lecture des réglages.
- La confirmation n'affiche jamais une autre commande ni un ancien brouillon local.
- `npm test` exécute maintenant le code réel et PostgreSQL embarqué (PGlite), avec les
  migrations du dépôt. Les anciens exemples sont conservés via `npm run test:legacy`.

**Déploiement effectué :** la migration `supabase/migration-order-creation.sql` a été
appliquée sur Supabase production avant la publication du commit `ddfe83c`. Elle ajoute
`order_creation_requests` et `create_order_with_commission`, et retire l'ancienne politique
d'INSERT public sur les commandes. L'URL `https://app.sugubaml.com` répond en HTTP 200
depuis Vercel. Aucun paiement réel ni écriture de test en production n'a été effectué pour
ce lot. Après déploiement, recharger les anciens onglets : leur ancien parcours de création
`/api/orders/sync` n'est plus accepté.

Preuves et limites : `docs/qa/order-creation-tests.md`. Dans les sections suivantes, toute
mention de création de commande via `/api/orders/sync` est antérieure à ce lot : la création
passe désormais par `/api/orders/create`.

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


7. **Plus aucune validation manuelle des inscriptions** (2026-09-10) — tous les comptes naissent
   **actifs**. L'ancienne approbation admin ne vérifiait rien : l'admin ne voyait que des
   données saisies par le candidat (nom, téléphone, numéro de pièce tapé au clavier). Elle
   ajoutait un délai, pas de la sécurité. Le contrôle se déplace là où il y a de la valeur :
   - revendeur → délai de sécurité des commissions, puis le retrait ;
   - fournisseur → modération des produits (`products.status`) ;
   - **livreur → vérification PHYSIQUE au guichet de Bamako**, seule exception.
   Deux notions désormais séparées : `profile_roles.status` (le compte fonctionne) et
   `drivers.active_status` (le livreur peut recevoir des courses). Ce dernier existait déjà
   avec `DEFAULT false` mais n'était lu nulle part ; il devient le seul verrou du dispatch.
   Panneau admin « Livreurs — vérification au guichet » : **note de constat obligatoire**
   (pièce présentée, permis, assurance, moto), horodatée avec l'agent (`verified_at/by/note`,
   `migration-livreurs-agence.sql`). Le livreur non vérifié voit son espace avec la liste de ce
   qu'il doit apporter. `/pending-approval` ne sert plus qu'aux comptes **suspendus**.
   Vérifié : 16 tests contre la base réelle (dispatch vide sans vérification, constat exigé,
   dossier incomplet refusé, retrait d'autorisation, traçabilité).


8. **Tarification automatique et boutiques** (2026-09-10) — déployé ; `migration-tarification.sql`
   et `migration-boutiques.sql` appliquées (vérifié en lecture le 2026-09-10).
   - **Moteur** `src/lib/pricing.ts` (fonctions pures, même code côté admin et serveur) :
     plancher Suguba = coûts variables (paiement 1,5 %, provision refus 4 %, message,
     déficit livraison) + coûts fixes ÷ **volume de référence** + marge nette minimale (5 %).
     Commission = 70 % du reste, arrondie **vers le bas**. Vérifié sur 50 000 tirages : un
     produit « ok » ne passe jamais sous la marge minimale, le prix minimal est bien le plus
     bas prix rentable.
   - **Réglages** dans `platform_settings` (écran admin « Réglages économiques ») : coûts,
     part revendeur, livraison par ville, points relais, codes promo, retrait minimum. Les
     coûts fixes par défaut (300 000 F/mois) sont une **estimation provisoire** signalée
     « non confirmée » tant que l'admin ne les a pas remplacés.
   - L'admin ne fixe plus que le **prix de vente** (`/api/admin/products/price`), la
     commission est calculée ; un prix sous le plancher est refusé.
   - **Devis serveur unique** (`calculerCommande`) pour l'affichage (`/api/orders/quote`) et
     l'enregistrement (`/api/orders/create` depuis le 2026-09-11, auparavant `/api/orders/sync`). Remise promo prise sur la marge Suguba, jamais
     sur la commission, et plafonnée pour ne **jamais vendre à perte**.
   - **Boutiques** : fournisseur `/s/<adresse>` (reconstruite, composant serveur),
     revendeur `/r/<code>` (sélection depuis le catalogue). Aperçus de partage Open Graph.
     Aucune coordonnée fournisseur publiée.
   - **Supprimé** : fausses chaînes de marque `/c/`, faux tableau de bord `/business`, faux
     réseau d'ambassadrices, note « 4.9/5 » inventée, option « acompte » qui ne faisait rien.

9. **Design system** (2026-09-09 → 11) — un seul vert `suguba-brand` (#09b500), slate, texte
   ≥ 11 px, composant `<Button>` ; tableaux de bord fournisseur et revendeur convertis. Les
   « promesses d'argent » sans mécanisme (parrainage, défis, académie) ne sont plus proposées
   depuis le tableau de bord revendeur.
10. **Parcours d'inscription refait** (2026-09-10) — plus aucun compte créé en silence : sans
    rôle choisi, la connexion Google/email mène au choix du profil ; `/register/complete`
    (nom, WhatsApp obligatoire, champs du rôle) est imposé par le middleware tant que le profil
    n'a pas de numéro. Carte « Client » = achat sans compte.
11. **Partage WhatsApp et cartes produit** (2026-09-11) — partage photo + texte + lien en un clic
    (`src/lib/partage.ts`), aperçu Open Graph de `/p/[slug]`, carte unique `ProductCard`
    (carrousel, logo WhatsApp), jusqu'à 6 photos par produit, photos allégées avant l'envoi,
    ajout de photos aux produits existants (`/admin/products`, bouton du fournisseur).
12. **Affiches pour statut WhatsApp** (2026-09-11) — `src/lib/affiche.ts` + `AfficheModal`
    (1080×1920 ou carré), code revendeur réel, jamais de téléphone ; `/reseller/marketing`
    refait, `/reseller/story-generator` redirige.
13. **Page produit honnête** (2026-09-11) — garantie inventée retirée (« 6 mois certifiés » sur
    tous les produits), nombre réel de livraisons, bouton « Une question ? ». Un produit pas en
    vente affiche « Pas encore en vente » (plus de partage à « 0 F »).
14. **Service worker v3** (2026-09-11) — plus aucune réponse d'API en cache (données privées),
    seul l'accueil préchargé, caches plafonnés.
15. **Publication automatique des produits** (2026-09-11) — décision de l'utilisateur : plus de
    validation avant la mise en vente ; contrôle après coup dans `/admin/products`
    (« Nouveautés fournisseurs », Prix, Retirer).
16. **Part revendeur choisie par le fournisseur** (2026-09-11) — prix client = fournisseur + part
    revendeur + part Suguba (% du prix de vente ou % de la part revendeur, réglable avec un
    tableau de simulation), toujours relevé au plancher. `migration-part-revendeur.sql` appliquée.
17. **iPhone : barre du bas qui flottait** après fermeture du clavier — masquée pendant la saisie
    (`useClavierOuvert`).

---

## ⚠️ À vérifier en tout premier

**Migrations** — vérifiées présentes en base par lecture (service_role) les 2026-09-10 et 11 :
`migration-saspay.sql`, `migration-tarification.sql`, `migration-boutiques.sql`,
`migration-livreurs-agence.sql`, `migration-part-revendeur.sql`, `migration-order-creation.sql`
(table `order_creation_requests` présente). Les plus anciennes (`multi-role`, `suppliers`,
`drivers`, `order-status`, `commission-safety-window`, `sav`) ont été appliquées en août ;
`migration-suivi-commande.sql` : table `track_attempts` vérifiée le 2026-09-11 (voir ci-dessous).

Vérification rapide (lecture seule, service_role) : tenter un `select` sur les colonnes/tables
attendues plutôt que de supposer. **Toute nouvelle migration doit être appliquée AVANT de pousser**
le code qui la lit : sinon devis et commandes cassent en production.

**Réglage à faire par l'admin** : la part Suguba est à 8 % du prix de vente par défaut. Avec les
coûts actuels, ce taux ne couvre pas les frais : les prix sont relevés au plancher. Pour que le
pourcentage décide réellement du prix, viser **12 à 13 %** (tableau de simulation des réglages).

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

## Chantiers non commencés et décisions en attente

**Décisions de l'utilisateur en attente** (ne pas trancher à sa place) :
- Pages qui promettent de l'argent sans mécanisme (point 10 ci-dessous) : supprimer ou brancher.
- Forcer le **choix du compte Google** à chaque connexion (`prompt: 'select_account'`) —
  proposé, mis de côté par l'utilisateur.
- **Numéro du support** `+223 89 46 00 00` : c'est aussi celui de l'agent WhatsApp Micro Office
  (« Fatouma ») — les clients Suguba tomberaient sur lui. Voulu ou non ?
- **Formulaire fournisseur** : garantie, délai de préparation et adresse du stock sont demandés
  mais jamais enregistrés (aucune colonne) — ajouter en base ou retirer du formulaire.

**À tester en vrai** (jamais fait de bout en bout) : partage WhatsApp avec photo et affiche en
statut sur un vrai téléphone (Android et iPhone), dépôt de photos, publication automatique d'un
dépôt fournisseur, premier paiement SasPay réel.

1. **Rôle Diaspora** — même traitement que Fournisseur/Livreur (table réelle, dashboard,
   inscription). Prochain sur la liste, jamais démarré.
2. **Remplir le catalogue** — le vrai blocage commercial. Au 2026-09-11 : 5 produits `[DÉMO]`
   **sans photo**, et un portable créé par l'admin, en attente de prix.
3. **Terminer le multi-rôle côté UI** — sélecteur d'espace dans le Header, page pour
   demander un rôle supplémentaire (`/api/auth/request-role` existe déjà côté serveur).
4. **Parcours invité** — suivi de commande sans compte, invitation à devenir revendeur
   juste après une livraison réussie.
5. **Vérification d'identité** fournisseurs/livreurs.
6. **Scores calculés** (livreurs, boutiques) — décision explicite de ne PAS les simuler tant
   qu'il n'y a pas de vraies transactions. Ne jamais initialiser un score à une valeur par défaut.
7. **Refonte UI/UX** — audit complet de tous les rôles fait le 2026-09-11 :
   `docs/ux/audit-ux-2026-09-11.md` (constats avec preuves, grille de satisfaction, plan en 10
   phases, protocole de vérification). **Phase 0 (confiance) à faire en premier** : 12 écrans
   affichent le compte démo « Moussa » (`state.currentUser`), les retraits affichent 184 000 F
   fictifs, la page diaspora promet une garantie et un taux BCEAO sans mécanisme.
8. ~~**Versement des commissions**~~ — code fait le 2026-09-09 via SasPay Payouts. Reste à
   valider avec de vraies clés : aucun virement réel n'a encore été déclenché.
9. **Revendeurs payés en Wave** — `payouts.payment_method` accepte encore `wave`, que SasPay
   ne couvre pas au Mali. La route de versement le refuse explicitement (422 avec un message
   lisible) plutôt que d'échouer obscurément, mais ces revendeurs ne peuvent pas être payés
   automatiquement : il faut leur demander un numéro Orange, Moov ou Mobi Cash.
10. **Promesses d'argent sans mécanisme derrière** (relevé le 2026-09-10) — plus proposées
   depuis le tableau de bord revendeur, mais les pages existent encore :
   `/reseller/referrals` (« +1 000 F par vente de filleul », aucune table ni route),
   `/reseller/challenges` (primes de 5 000 à 25 000 F en dur), `/reseller/academy`
   (scripts « 25 000 à 100 000 F / semaine », « 3 000 à 7 000 F par article »). À supprimer
   ou à brancher sur un vrai mécanisme — décision de l'utilisateur.

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
- **Les numéros de commande étaient tirés dans 90 000 valeurs, sans contrôle d'unicité.**
  `SG-${Math.floor(10000 + Math.random() * 90000)}` — alors que `orders.order_number` est
  `UNIQUE NOT NULL`. Paradoxe des anniversaires : 49 % de risque de collision dès la 350ᵉ
  commande, 99,6 % dès la 1000ᵉ. À la collision, l'INSERT échoue — et comme la synchro part
  en arrière-plan sans que personne n'attende son résultat, **l'échec était silencieux** :
  le client voyait sa confirmation et son code secret, mais la commande n'existait nulle
  part. Ni paiement, ni livreur, ni trace. Corrigé le 2026-09-10 : 8 caractères sur un
  alphabet de 30 symboles sans ambiguïté visuelle (6,5 × 10¹¹ combinaisons), et tout échec
  de synchronisation est désormais journalisé en `console.error` avec le numéro concerné.
  Le SMS n'est plus envoyé si la commande n'a pas atteint la base.
- **La base refusait le statut « submitted » des produits** (découvert le 2026-09-10). La
  contrainte de `schema.sql` n'autorisait que `pending / approved / rejected / archived`,
  alors que toute l'application utilise `submitted` pour un dépôt en attente de modération.
  **Chaque dépôt de produit par un fournisseur échouait donc en base** : il voyait son article
  dans son navigateur, l'admin ne le recevait jamais. Cause la plus probable du « catalogue
  vide » signalé depuis août. Corrigé dans `migration-tarification.sql` (section 4). Même
  famille que la contrainte des statuts de commande : vérifier les CHECK contre le code avant
  de chercher ailleurs.
- **Les montants d'une commande venaient du navigateur** (corrigé le 2026-09-10).
  `/api/orders/sync` enregistrait tels quels prix, total, commission et statut, sur une route
  publique : commission de 500 000 F sur son propre code, commande créée « livrée »
  (commission disponible sans livraison), total à 100 F pour un article à 45 000 F — que la
  route SasPay « relisait en base » en toute confiance. Tout est désormais calculé par le
  serveur à partir du produit en base et figé dans `pricing_snapshot`. Les mises à jour ne
  touchent plus aucun montant. **Règle : aucune route ne doit accepter un montant du
  navigateur.**
- **La synchro produit acceptait statut et prix du navigateur** : un fournisseur pouvait
  publier son article « approuvé » sans modération, avec la commission de son choix, et
  écraser la fiche d'un autre. L'approbation ne passe plus que par la tarification admin, et
  un changement de prix fournisseur sur un produit approuvé le renvoie en modération.
- **La page produit promettait une remise jamais appliquée.** Codes promo, frais par ville et
  point relais étaient calculés dans la page, pendant que la commande gardait 1 500 F et aucune
  remise. Le client lisait un total, le livreur en réclamait un autre.
- **Le prix fournisseur est lisible publiquement** (lecture anon des produits approuvés, et
  `cloud-sync` fait `select('*')`). La marge Suguba s'en déduit. Non corrigé : le resserrer
  demande de revoir le chargement des produits côté navigateur. Ne pas y ajouter de colonnes
  de marge — elles sont calculées à la volée côté admin.
- **Deux sources de vérité pour les rôles, écrites de façon incohérente.** `profile_roles`
  est la source de vérité du multi-rôle, mais `/api/admin/promote` et
  `scripts/create-admin.js` n'écrivaient que `profiles.role`. Le repli de `chargerRoles()`
  masquait le problème — mais il ne jouait que tant que `profile_roles` était **vide** pour
  ce compte. Dès qu'une première ligne y apparaissait (une demande de rôle revendeur, par
  exemple), la carte se reconstruisait exclusivement à partir de la table et **le rôle admin
  disparaissait en silence** : l'administrateur devenait un simple revendeur en attente, sans
  message d'erreur. Corrigé le 2026-09-09 aux deux bouts — `chargerRoles()` réinjecte le
  rôle principal du profil quand il n'a pas de ligne à lui (sans jamais écraser une ligne
  existante), et les deux points de promotion écrivent désormais `profile_roles`.
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
- **Passer les comptes « actifs à la création » a failli casser l'inscription Google.** Le
  callback n'envoyait vers `/register/complete` que si `status !== 'active'` ET pas de téléphone.
  Avec des comptes toujours actifs, un inscrit Google aurait filé vers son tableau de bord
  sans jamais donner numéro ni quartier. La condition ne porte plus que sur le téléphone.
  Leçon : changer une valeur par défaut oblige à relire toutes les conditions qui la testaient.
- **Toute connexion d'une adresse inconnue créait un compte « revendeur » en silence**
  (corrigé le 2026-09-10). `/login` n'envoie aucun rôle, et `supabase-exchange` retombait sur
  `'reseller'` par défaut ; `/auth/callback` n'envoyait vers `/register/complete` que les
  comptes non actifs — or tous naissent actifs. Résultat : ni rôle choisi, ni nom confirmé,
  ni numéro, ni fiche fournisseur/livreur (0 ligne dans `suppliers` et `drivers`). Désormais :
  sans rôle explicite, **rien n'est créé** (`needsRole`) ; `/register/complete` fait choisir le
  profil puis crée le compte ; le rôle reste modifiable tant qu'aucun numéro n'est enregistré ;
  le numéro est obligatoire ; le middleware renvoie vers le formulaire toute session dont le
  « phone » est encore un email (admin exempté). Les 2 comptes créés en silence le 2026-09-10
  seront invités à choisir leur profil à leur prochaine connexion.
- **Les partages WhatsApp n'étaient qu'un lien nu** (corrigé le 2026-09-11). Deux causes :
  `api.whatsapp.com/send?text=` ne transporte que du texte, et `/p/[slug]` étant `'use client'`
  sans métadonnées, WhatsApp ne trouvait aucune image d'aperçu. Désormais : `src/lib/partage.ts`
  partage photo + texte + lien en un clic (Web Share avec fichier, image préchargée au toucher
  car Safari refuse un partage trop long après le geste), repli texte puis `wa.me` ;
  `app/p/[slug]/layout.tsx` produit l'aperçu (logo Suguba tant que le produit n'a pas de photo).
  Carte produit unique `components/product/ProductCard.tsx` (carrousel, logo WhatsApp) utilisée
  par l'accueil, le catalogue revendeur et les boutiques ; dépôt de **plusieurs photos**
  (`PhotosUploader`, 6 max, la première = principale). ⚠️ Au 2026-09-11, **aucun produit n'a de
  photo** : le partage part sans image tant que le catalogue n'est pas photographié.
  Pour en ajouter à un produit EXISTANT : `/admin/products` (filtre « Sans photo », onglet
  « Produits » de la barre du bas) ou bouton « Photos » du tableau de bord fournisseur. Route
  dédiée `/api/products/images` : ne touche qu'aux photos, n'accepte que des URL de notre
  stockage `product-images`, fournisseur limité à ses produits, statut inchangé.
- **Les outils marketing revendeur affichaient de fausses données** (corrigé le 2026-09-11).
  `BannerGeneratorModal` et `/reseller/story-generator` prenaient le revendeur dans les données
  de démonstration (`state.resellers[0]`) : code et **téléphone d'un autre** sur l'affiche, ventes
  non attribuées. La page Marketing proposait des « kits » pour des produits inexistants (Smart TV
  145 000 F, kit solaire 65 000 F) et une garantie inventée ; le studio stories envoyait le lien
  du revendeur à quickchart.io. Remplacés par `src/lib/affiche.ts` (canvas 1080×1920 ou carré,
  sans bibliothèque, jamais de téléphone) + `AfficheModal` (aperçu PUIS partage : générer au
  clic ferait refuser le partage sur iPhone). `/reseller/story-generator` redirige vers
  `/reseller/marketing`. Bouton « affiche » sur les cartes du catalogue revendeur.
- **`/api/auth/me` renvoyait 401 à tout visiteur non connecté** (corrigé le 2026-09-11) : elle
  figurait dans les routes « session requise » du middleware alors qu'elle sert précisément à
  répondre `{ authenticated: false }`. Une erreur rouge dans la console, sur chaque page.
- **Tester une page à rôle en local sans exposer le vrai `SESSION_SECRET`** : lancer le serveur
  avec un secret jetable (`env SESSION_SECRET=… npm run dev`), signer la session de test avec
  lui, et l'ouvrir sur `127.0.0.1` (cookies séparés de `localhost`). Un jeton signé avec le vrai
  secret serait valable en production : ne jamais l'écrire dans une conversation.
- **Une garantie inventée s'affichait sur tous les produits** (corrigé le 2026-09-11) :
  `cloud-sync.ts` fixait `warrantyMonths: 6` en dur, et la page produit affichait « Garantie 6
  mois — Service certifié » (la page devis B2B, « Garantie certifiée »). La table `products` n'a
  **aucune** colonne garantie. Remplacé par des engagements réels (paiement à la livraison, code
  secret remis au livreur, livré par Suguba) et le nombre réel de livraisons réussies du produit
  (`/api/products/livraisons`, affiché seulement s'il est > 0).
  ⚠️ Non corrigé : le formulaire fournisseur demande garantie, délai de préparation et adresse
  du stock, **jamais enregistrés** (aucune colonne). À ajouter en base ou à retirer du formulaire.
- **Photos allégées avant l'envoi** (2026-09-11, `src/lib/compression-image.ts`) : 1600 px,
  JPEG 0,82. Une photo de téléphone de 8 à 13 Mo était refusée (limite serveur 5 Mo) ; vérifié :
  13,8 Mo → 0,67 Mo. En cas d'échec, le fichier d'origine part tel quel.
- **Le service worker v2 mettait en cache toutes les réponses d'API** (corrigé le 2026-09-11,
  `public/sw.js` v3) : commandes, soldes, données admin restaient lisibles hors ligne sur un
  téléphone partagé. Il préchargeait aussi 27 pages à la première visite, sans plafond. La v3 ne
  met jamais `/api/` en cache, ne précharge que l'accueil, plafonne pages (40) et photos (200),
  et supprime les anciens caches à l'activation. Le SW n'est enregistré qu'en production : pour
  le tester en local, l'enregistrer à la main (`navigator.serviceWorker.register('/sw.js')`).
- **Un produit pas en vente pouvait être partagé à « 0 F »** (corrigé le 2026-09-11, signalé
  par l'utilisateur avec capture). Deux bugs combinés :
  1. `/admin/products/new` enregistrait via `/api/products/sync` — qui crée TOUJOURS un produit
     `submitted` à prix 0 depuis la tarification automatique — puis affichait « Produit publié ! ».
     Le formulaire appelle désormais `/api/admin/products/price` (commission calculée, prix sous
     le plancher refusé avec le prix minimal) et dit la vérité s'il n'a pas pu publier.
  2. `/p/[slug]` cherche le produit dans la mémoire locale SANS regarder son statut ; sur le
     téléphone de l'admin (qui y charge les produits en attente), la page s'affichait à 0 F avec
     le bouton de partage. Le destinataire, lui, voyait « Produit introuvable ». La page affiche
     désormais « Pas encore en vente » (ni commande ni partage), et le partage comme l'affiche
     refusent un produit sans prix. Règle : **« en vente » = `approved` ET prix > 0**, partout.
- **La barre du bas « flottait » au milieu de l'écran sur iPhone** (corrigé le 2026-09-11,
  signalé avec capture sur /admin). Ce n'était ni un zoom ni un conteneur transformé : l'écart
  valait la hauteur du clavier. Safari repositionne mal les éléments `fixed` en bas après la
  fermeture du clavier. `src/lib/useClavierOuvert.ts` masque la barre du bas et le bouton
  WhatsApp flottant pendant la saisie ; les réafficher force Safari à les recalculer.
  ⚠️ Détecter la fin de saisie avec `relatedTarget` de l'événement `focusout`, **jamais**
  `document.activeElement` lu juste après : selon le navigateur il désigne encore l'ancien
  champ, et la barre restait masquée pour de bon.
- **Tester du focus ou des minuteries dans le panneau Browser masqué** : la page n'a pas le
  focus (aucun vrai `focusin`) et Chrome ralentit les minuteries à ~1 par seconde. Déclencher
  les `FocusEvent` à la main et attendre plusieurs secondes avant de conclure.
- **Publication automatique des produits** (décision de l'utilisateur, 2026-09-11) : plus de
  validation manuelle avant la mise en vente. `src/lib/publication-auto.ts` publie au **prix
  recommandé** du moteur (commission calculée) si le produit a au moins une photo et qu'un prix
  rentable existe ; sinon il reste « en attente » avec la raison, renvoyée au fournisseur.
  Déclenchée au dépôt fournisseur (`/api/products/sync`), au changement de prix fournisseur
  (retarification) et à l'ajout de photos (`/api/products/images`). Un produit **retiré** par
  l'admin (`rejected`/`archived`) n'est jamais republié automatiquement. Contrôle après coup :
  `/admin/products` → « Nouveautés fournisseurs » (14 jours), boutons « Prix » et « Retirer »
  (`/api/admin/products/status`). Pas de période d'essai pour les nouveaux fournisseurs (option
  proposée, écartée pour l'instant — facile à ajouter dans `publierAutomatiquement`).
  ⚠️ Les prix publiés dépendent des réglages économiques : tant que les coûts fixes par défaut
  (estimation) n'ont pas été remplacés par les vrais, les prix recommandés en héritent.
- **Part revendeur choisie par le fournisseur** (décision de l'utilisateur, 2026-09-11) — colonne
  `products.commission_proposee` (`migration-part-revendeur.sql`). Réglages économiques :
  `modePartSuguba` = `prix_vente` (Suguba prend X % du prix client) | `part_revendeur` (X % de la
  part revendeur) | `auto` (le moteur calcule, comme avant), `tauxPartSuguba`, `minimumPartSuguba`.
  Prix client = fournisseur + part revendeur + part Suguba (`prixDepuisPartRevendeur`), **relevé
  au plancher** s'il ne couvre pas les coûts. `calculerTarif(…, commissionProposee)` impose la
  part choisie partout (publication auto, tarification admin, recalcul des réglages, devis,
  commande) — sinon la commission figée sur la commande différerait de celle affichée. Tableau
  de simulation dans « Réglages économiques ». Aperçu du prix pour le fournisseur via
  `/api/products/apercu-prix` (ne renvoie jamais les coûts). ⚠️ Le mode `part_revendeur` avec un
  petit % ne couvre pas les coûts : c'est le relèvement au plancher qui protège la marge.
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
