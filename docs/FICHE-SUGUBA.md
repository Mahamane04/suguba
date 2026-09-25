# SUGUBA — Fiche de référence

> Mise à jour le **25 septembre 2026** (soir : reçu client avec QR de remise, scan
> livreur et admin, photos SAV). Résumé de tout ce qu'il faut savoir sur la
> plateforme : à quoi elle sert, qui fait quoi, comment l'argent circule, comment elle
> est protégée et comment on la fait évoluer. Pour le détail page par page, voir le
> **guide des parcours** (`/admin/guide`, réservé à l'administrateur général).

---

## 1. En une phrase

Suguba est une plateforme de **social commerce malienne** : des **fournisseurs** publient
leurs produits, des **revendeurs** les partagent (WhatsApp, Facebook, leur boutique) sans
avoir de stock et touchent une commission, des **livreurs** apportent le colis au client,
qui paie **à la livraison** ou par **Orange / Moov Money**. Suguba prend une part sur
chaque vente et orchestre le tout.

| | |
|---|---|
| Adresse | https://app.sugubaml.com |
| Code | GitHub `Mahamane04/suguba` (branche `main`) |
| Hébergement | **Vercel** — chaque `git push` sur `main` déploie automatiquement |
| Base de données | **Supabase** (PostgreSQL) |
| Paiements | **SasPay** (Orange Money Mali, Moov Money Mali) |
| Support | WhatsApp **+223 89 46 00 00** |

---

## 2. Les rôles

Un même compte peut **cumuler plusieurs rôles** (ex. revendeur + livreur). Il bascule
de l'un à l'autre dans **Compte › Profils**.

| Rôle | Ce qu'il fait | Espace |
|---|---|---|
| **Client / visiteur** | Achète, suit sa commande, suit des boutiques. Pas besoin de compte pour commander. | `/`, `/p/…`, `/panier`, `/track` |
| **Revendeur** | Choisit des produits, les partage, vend, encaisse des commissions, ouvre sa boutique. | `/reseller/…` |
| **Fournisseur** | Publie ses produits (prix fournisseur ou prix de gros), gère stock, commandes, boutique, équipe. | `/supplier/…` |
| **Livreur** | Récupère et livre les colis, encaisse les espèces, les remet à la caisse. | `/driver`, `/driver/earnings` |
| **Diaspora** | Commande depuis l'étranger pour un proche au Mali. | `/diaspora` |
| **Admin / équipe Suguba** | Confirme les commandes, assigne les livreurs, modère, paie, règle l'économie. | `/admin/…` |

### Équipe admin et permissions

Chaque membre de l'équipe a un **rôle d'équipe** qui lui donne des **permissions précises**
(`/admin/equipe`) :

| Rôle d'équipe | Droits principaux |
|---|---|
| Super Admin | Tout, y compris gérer l'équipe |
| Responsable fournisseurs | Produits, prix, boutiques, vérifications |
| Responsable revendeurs | Réseau, missions, marketing |
| Support | Lire / modifier les commandes |
| Responsable livraison | Livreurs et courses |
| Finance | Commissions, retraits, caisse livreurs, réglages de commission |
| Marketing / Modérateur | Campagnes, sponsorisation / modération |

Un admin **sans rôle d'équipe n'a aucun droit** d'équipe.

---

## 3. Connexion et inscription

- Connexion par **Google** ou **lien magique par e-mail** (pas de mot de passe, pas de SMS).
- Après la première connexion, `/register/complete` demande les informations du rôle
  (numéro WhatsApp, boutique, véhicule…).
- Ajouter un rôle à son compte : **Compte › Profils** (si le compte n'a pas encore de
  numéro, il est demandé à ce moment-là).
- Les dossiers revendeur, fournisseur et livreur sont **validés par un admin** avant
  d'accéder à leur espace (`/pending-approval` en attendant).
- ⚠️ Les e-mails de connexion partent encore de l'expéditeur par défaut de Supabase et
  peuvent arriver en **spam**. Solution prévue : SMTP **Resend** avec les enregistrements
  DNS du domaine `sugubaml.com` (chez Hostinger) — **pas encore vérifiés**.

---

## 4. Le parcours d'une commande

```
Client commande ─► Suguba appelle pour confirmer ─► Admin assigne un livreur
     │                                                        │
     ▼                                                        ▼
Paie à la livraison                           Livreur récupère le colis (ramassage)
  ou Orange/Moov Money                                        │
                                                              ▼
              Client vérifie le colis, montre son REÇU QR ─► Livreur scanne
                                                              │ puis « Confirmer la remise »
                                                              ▼
                                                        Commande livrée
                                                              │
               ┌──────────────────────────────────────────────┤
               ▼                                              ▼
  Espèces : le livreur les remet            Commission du revendeur bloquée
  à la caisse (reçu de versement)           quelques jours, puis retirable
```

1. **Commande** : créée par le serveur en une seule transaction (commande + commission +
   reçu). Prix, numéro de commande et code sont calculés **côté serveur**, jamais par le
   navigateur. Une coupure réseau ne crée pas de doublon (« Reprendre ma commande »).
2. **Paiement** — le client choisit :
   - **À la livraison** (choix par défaut) : il paie le livreur en espèces après avoir vu l'article ;
   - **Orange Money** ou **Moov Money** via SasPay. (Mobi Cash est retiré.)
3. **Reçu Suguba avec QR de remise** (`/recu/<n°>`) : grand QR, **code de remise écrit
   dessous**, articles, montants, « À payer au livreur » ou « Payé en ligne ».
   - Le client l'**enregistre en image** (présentable sans connexion) ou en **PDF**.
   - Il reste **90 jours sur le téléphone** qui a commandé : « Suivre ma commande ›
     Mes reçus sur ce téléphone ». Pas de SMS.
   - Commande pour un proche ou vente d'un revendeur : « **Transmettre au destinataire** ».
   - Le client ne le montre **qu'après avoir vérifié le colis**.
4. **Remise** : le livreur appuie sur « **Scanner le QR du client** ». Le scan affiche les
   articles et le paiement **sans rien valider** ; il confirme ensuite (« J'ai encaissé
   X F » pour des espèces). S'il ne peut pas scanner, il **saisit le code**. QR et code =
   même preuve : 3 essais faux (au total) = commande bloquée.
   Sur chaque course, le livreur voit : 🟢 « Déjà payé — ne rien encaisser » ou
   🟠 « À encaisser : X F ».
5. **Commission** : bloquée après la livraison le temps d'un éventuel retour
   (14 jours nouveau revendeur, 7 vérifié, 3 VIP), puis retirable.
6. **Après la livraison** : depuis son reçu, le client peut « **Signaler un problème avec
   un article** » (motif, quantité, échange / réparation / remboursement, **jusqu'à 3
   photos**). La demande arrive dans **SAV & retours** ; ce n'est pas une acceptation
   automatique.

Suivi public d'une commande : `/track` (numéro + téléphone, tentatives limitées).

---

## 5. L'argent

### Prix d'un produit

- **Le client paie : prix fournisseur + part revendeur.** Rien de plus par défaut.
- Deux façons de fixer la part :
  1. le **fournisseur propose la part revendeur** → Suguba prend un % prédéfini ;
  2. le fournisseur donne un **prix de gros** → le revendeur vend au prix qu'il choisit,
     Suguba gagne sur cette marge (mode réglable : % de la marge, ajout au prix de gros,
     montant fixe ou rien).
- Les coûts de Suguba (frais Mobile Money, refus, messages) sont **payés sur la part
  Suguba** par défaut. Option : les **ajouter au prix client** (« plancher »).
- Toutes les marges peuvent être mises à **0**.

### Retraits des revendeurs

| Moyen | Frais |
|---|---|
| Orange / Moov Money | SasPay + opérateur + **1,5 % Suguba** |
| Espèces à l'agence | **1,5 % Suguba** seulement |

Le revendeur voit avant de valider **combien il recevra**. Retrait minimum réglable
(5 000 F par défaut). Les retraits sont payés par l'admin (`/admin`).

### Caisse livreurs (espèces)

- Chaque livreur doit remettre les espèces encaissées. Par défaut **il garde sa
  rémunération par course** (1 000 F) et verse le reste — option « il verse tout ».
- **`/admin/caisse-livreurs`** : montant attendu par livreur, alerte orange après 24 h,
  rouge après 48 h, **« Enregistrer un versement »** (on saisit ce qui a été *réellement*
  reçu ; un manque reste inscrit sur son compte), historique.
- Chaque versement produit un **reçu** (n° VS-…) imprimable et envoyable sur WhatsApp.
  Le livreur le retrouve dans **Mon portefeuille**.

### Où se règle tout ça

**Admin › Paramètres** (`/admin#reglages`) — chaque réglage a une bulle **(i)** qui
l'explique : part Suguba, qui paie les coûts, prix de gros, frais SasPay/opérateurs,
frais de retrait, retrait minimum, livraison (par ville, à la distance ou par zones à
Bamako), points relais, rémunération livreur et caisse, codes promo, formules boutiques,
coûts fixes. Des exemples chiffrés montrent l'effet de chaque changement.

---

## 6. Fonctionnalités par espace

**Client** : catalogue et recherche, fiches produit, panier multi-produits, commande sans
compte, suivi, **reçu avec QR de remise** (image, PDF, transmission, signalement SAV
avec photos), boutiques (`/boutique/<nom>`, avec couverture, logo, badges, liens,
bouton Suivre), boutiques suivies, notifications, B2B (devis), diaspora.

**Revendeur** : catalogue et prix, partages suivis (liens `/go/…`, le premier revendeur
garde le client), « + Vente » pour un client, commandes, clients, commissions et
retraits, boutique(s) selon l'abonnement, parrainage, missions et récompenses,
calendrier de publication, créateur de visuels / stories, badge et vérification.

**Fournisseur** : ajout de produits (familles, variantes, photos), inventaire, commandes,
revendeurs qui le vendent, ambassadeurs, campagnes et sponsorisation, analyses, boutique,
équipe.

**Livreur** : courses à récupérer et à livrer, carte, **scan du QR du client** (ou saisie
du code), portefeuille
(à remettre, versements, reçus, rémunération).

**Admin** : tableau de bord (appels à passer, livraisons à assigner, retraits à payer),
commandes, produits et prix, utilisateurs, vérifications, boutiques, SAV & retours
(**« Scanner un reçu »** pour retrouver une commande, photos du client),
caisse livreurs, missions, récompenses, sponsorisations, diffusion, analyses, rapport
du soir, équipe, paramètres, guide des parcours.

---

## 7. UI / UX — le design system

- **Mobile d'abord** : pensé pour un téléphone à 390 px, cibles de 44–48 px pour le pouce,
  champs en 16 px (sinon Safari zoome).
- **Police** : Inter.
- **Verts, chacun a UN rôle** :

| Jeton | Couleur | Usage |
|---|---|---|
| `suguba-profond` | `#0B3B2C` | En-têtes, menu du bas, bouton principal (texte blanc) |
| `suguba-brand` | `#09B500` | Marque, icônes, succès — **jamais de texte blanc dessus** |
| `suguba-brand-dark` | — | Texte vert sur fond blanc (lisible) |
| `suguba-wa` | `#25D366` | Uniquement les boutons qui ouvrent WhatsApp |
| `suguba-citron` | `#C7F464` | Ce qui compte : gains, solde, onglet actif |
| `suguba-menthe` / `sauge` | — | Fonds clairs |

  Rouge = erreurs et annulations seulement. Gris : une seule échelle, `slate`.
- **Formes** : boutons en pilule, champs `rounded-xl`, cartes `rounded-2xl`/`3xl`.
- **Composants communs** (`src/components/ui/`) : `Button`, `Field`/`Input`,
  `ChoicePicker` (tous les menus déroulants), `Sheet` (fenêtre qui monte du bas sur
  téléphone), `Toast` (messages et confirmations), `EmptyState`, `Surface`.
- **Barre du bas** : suit le bas de l'écran réellement visible sur iPhone et se masque
  quand le clavier est ouvert.
- **Textes** : en français simple, du point de vue de l'utilisateur ; une erreur dit ce
  qui s'est passé et comment corriger.
- Référence complète : `docs/design/design-system.md`.

---

## 8. Sécurité — ce qui est en place

**Accès**
- Session **signée (HMAC)** dans un cookie `httpOnly`, revérifiée en base à chaque
  requête (compte actif, rôle réellement détenu).
- **Middleware** : chaque espace (`/admin`, `/supplier`, `/driver`, `/reseller`) et chaque
  API à rôle est refusé avant tout affichage si la session ne correspond pas.
- **Permissions d'équipe** par route (`src/lib/reseau/permissions-routes.ts`) ; un test
  échoue si une nouvelle route admin n'a pas de permission déclarée.
- `/admin/guide` et ses captures : administrateur général uniquement.

**Données**
- **RLS** activée sur les tables ; les tables sensibles (réglages, versements, paiements…)
  ne sont lisibles que par le serveur (`service_role`).
- La clé `service_role` n'est **jamais** exposée au navigateur.

**Argent et commandes**
- Montants, prix, commissions, numéros et codes **calculés côté serveur**.
- Opérations sensibles **atomiques** en base (création de commande, retrait, livraison,
  versement livreur) : tout ou rien, pas de double traitement.
- Paiement SasPay confirmé par **webhook signé** (HMAC) et revérifié auprès de SasPay.
- Code de remise et QR : jamais dans le suivi public, les flux ou les exports ; le reçu ne
  s'ouvre qu'avec la **clé secrète gardée sur le téléphone qui a commandé** (90 jours,
  effacée à la déconnexion). Numéro de commande + téléphone ne suffisent pas.
- Le QR **n'est pas un lien** : scanné par un autre téléphone, il n'ouvre rien et ne
  montre aucune donnée personnelle. Seul le scanner livreur l'exploite, et le serveur
  vérifie que la commande est assignée à ce livreur. QR et code partagent les 3 essais ;
  un double scan ou une coupure réseau ne crée pas de double livraison.
- Le scan admin (SAV) ne lit que le numéro de commande : il ne valide rien.
- Photos SAV : métadonnées et **position GPS retirées**, stockage **privé**, liens admin
  valables 10 minutes.
- Commissions bloquées quelques jours après livraison (retours).
- Suivi public limité en nombre de tentatives par numéro de commande.

**Règles de travail**
- Les **SQL sont exécutés par vous** dans Supabase › SQL Editor (fichiers
  `supabase/A-EXECUTER-…`), jamais automatiquement.
- Les secrets (clés SasPay, Supabase, Resend…) vont **uniquement** dans Vercel / Supabase,
  jamais dans le code ni dans une conversation.
- Le serveur local utilise la **vraie base** : aucun test ne doit y écrire.
- Captures d'écran : noms, téléphones et e-mails **masqués**.
- Ne jamais ouvrir `/admin/boutique-suguba` sans le vouloir : l'ouvrir **crée** la
  boutique officielle.

---

## 9. Architecture technique (pour un développeur)

| Élément | Choix |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Style | Tailwind CSS 3 + jetons `suguba-*` (`tailwind.config.js`) |
| Base | Supabase PostgreSQL, fonctions SQL `SECURITY INVOKER`, RLS |
| Accès serveur | `getSupabaseAdmin()` (`src/lib/supabase-admin.ts`) |
| Moteur de prix | `src/lib/pricing.ts` — fonctions pures partagées devis / commande |
| Réglages | table `platform_settings` (une ligne), `src/lib/platform-settings.ts` |
| Session | `src/lib/session.ts`, `src/lib/active-session.ts`, `src/middleware.ts` |
| Paiement | `src/lib/saspay.ts`, `/api/payments/saspay/*`, `/api/webhooks/saspay` |
| Tests | `npm test` (190 tests, Node + PostgreSQL embarqué PGlite) |
| Reçu et QR | `src/lib/recu-commande.ts`, `src/lib/qr-remise.ts`, `src/lib/recu-image.ts`, scanner `src/components/driver/ScannerQr.tsx` (jsQR) |
| Photos SAV | bucket privé `sav-photos`, `src/lib/sav-photos.ts` |
| Guide | `docs/guide/guide.json` + `/admin/guide` |

**Variables d'environnement** (valeurs dans Vercel, jamais dans le code) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SESSION_SECRET`, `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`,
`SUGUBA_DEMO_MODE` (local seulement). Les variables SMS (Orange, Twilio, Termii) existent
dans le code mais **aucune passerelle SMS n'est branchée**.

---

## 10. Faire évoluer la plateforme

1. Modifier en local, `npm test` et `npm run build` (jamais pendant que le serveur de dev
   tourne).
2. Mettre à jour **`docs/guide/guide.json`** dans le même commit : entrée de journal
   (demande / réalisé / écarts), fiche des pages touchées.
3. Si un SQL est nécessaire : fichier `supabase/A-EXECUTER-<date>-<sujet>.sql`, **exécuté
   par vous avant** la mise en ligne du code qui en dépend.
4. « Met en ligne » → commit + push sur `main` → Vercel déploie (~2–3 min) → vérification
   → journal du guide passé à « en ligne ».

---

## 11. Points ouverts (au 25/09/2026)

- **Tester les scans sur de vrais téléphones** (iPhone et Android) : scan livreur et scan
  admin n'ont pas pu être essayés avec une vraie caméra.
- **Retrouver son reçu sur un autre téléphone** : pas encore. Pistes : rattacher les
  commandes au compte connecté, puis un lien à usage unique envoyé par le WhatsApp Suguba
  quand le client écrit « reçu SG-… » depuis le numéro de la commande.
- **E-mails en spam** : configurer Resend (SMTP dans Supabase + DNS chez Hostinger, sans
  toucher au SPF existant), puis vérifier.
- **Compte principal** (`infos@microofficeml.com`) sans numéro WhatsApp : choisir lequel
  lui attribuer (71 36 05 25 et 89 46 00 00 sont déjà pris).
- **Ancien compte fournisseur** `microoffice16@yahoo.fr` (0 produit) : à supprimer ou non.
- Commande **SG-5BC5XBDT** : le client doit rouvrir son reçu pour voir le nouveau code.
- **Caisse livreurs** : capture du guide à faire ; blocage automatique au-delà d'un plafond
  d'espèces non fait (alerte seulement).
- **Captures du guide** : les connexions de démonstration ne passent plus depuis l'audit de
  sécurité (tâche proposée).
- Aucune passerelle **SMS** : tout ce qui devait partir par SMS passe par l'application ou
  WhatsApp.
