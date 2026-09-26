# SUGUBA — Fiche de référence

> Mise à jour le **26 septembre 2026** (offres et services, devis, prestations à étapes,
> « Priorité au réseau », campagnes encadrées, paiement des sponsorisations,
> rémunération au résultat, **Protection Suguba : trésorerie, coordonnées par
> dossier, messagerie, comptes liés, part Suguba sous droit dédié, suspension
> motivée**). Résumé de
> tout ce qu'il faut savoir sur la plateforme : à quoi elle sert, qui fait quoi, comment
> l'argent circule, comment elle est protégée et comment on la fait évoluer. Pour le
> détail page par page, voir le **guide des parcours** (`/admin/guide`, réservé à
> l'administrateur général).

---

## 1. En une phrase

Suguba est une plateforme de **social commerce malienne** : des **fournisseurs** publient
leurs offres (produits, services, installations), des **revendeurs** les partagent
(WhatsApp, Facebook, leur boutique) sans avoir de stock et touchent une commission, des
**livreurs** — ou le fournisseur lui-même — remettent la commande au client, qui paie
**à la remise** ou par **Orange / Moov Money**. Suguba prend une part sur chaque vente et
orchestre le tout. Les **boutiques revendeurs sont les vitrines de vente** ; les
fournisseurs alimentent le réseau.

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
| **Client / visiteur** | Achète ou demande un devis, suit sa commande, valide les étapes d'une prestation, suit des boutiques. Pas besoin de compte. | `/`, `/p/…`, `/panier`, `/track`, `/recu/…`, `/devis/…` |
| **Revendeur** | Choisit des offres, les partage, vend, encaisse des commissions, ouvre sa boutique, participe aux missions et campagnes. | `/reseller/…` |
| **Fournisseur** | Publie ses offres, répond aux devis, remet lui-même ou prépare pour le livreur, déclare les étapes, lance des campagnes. | `/supplier/…` |
| **Livreur** | Récupère et livre les colis, encaisse les espèces, les remet à la caisse. | `/driver`, `/driver/earnings` |
| **Diaspora** | Commande depuis l'étranger pour un proche au Mali. | `/diaspora` |
| **Admin / équipe Suguba** | Confirme, assigne, modère, paie, suit devis et prestations, règle l'économie et la priorité au réseau. | `/admin/…` |

### Équipe admin et permissions

Chaque membre de l'équipe a un **rôle d'équipe** qui lui donne des **permissions précises**
(`/admin/equipe`) :

| Rôle d'équipe | Droits principaux |
|---|---|
| Super Admin | Tout, y compris gérer l'équipe |
| Responsable fournisseurs | Produits, prix, boutiques, vérifications |
| Responsable revendeurs | Réseau, missions, marketing |
| Support | Lire / modifier les commandes (dont devis et prestations) |
| Responsable livraison | Livreurs et courses |
| Finance | Commissions, retraits, caisse livreurs, **paiements reçus** (campagnes, sponsorisations) |
| Marketing / Modérateur | Campagnes, sponsorisation / modération |

Un admin **sans rôle d'équipe n'a aucun droit** d'équipe.

---

## 3. Connexion et inscription

- Connexion par **Google** ou **lien magique par e-mail** (pas de mot de passe, pas de SMS).
- Après la première connexion, `/register/complete` demande les informations du rôle
  (numéro WhatsApp, boutique, véhicule…).
- Ajouter un rôle à son compte : **Compte › Profils**.
- Les dossiers revendeur, fournisseur et livreur sont **validés par un admin** avant
  d'accéder à leur espace (`/pending-approval` en attendant).
- ⚠️ Les e-mails de connexion partent encore de l'expéditeur par défaut de Supabase et
  peuvent arriver en **spam**. Solution prévue : SMTP **Resend** + DNS du domaine
  `sugubaml.com` (chez Hostinger) — **pas encore vérifiés**.

---

## 4. Le parcours d'une commande

```
Client commande ─► Suguba appelle pour confirmer ─► Qui remet ?
     │                                                │
     ▼                                  ┌─────────────┴──────────────┐
Paie à la remise                        ▼                            ▼
  ou Orange/Moov Money        Livreur Suguba : ramassage   Fournisseur : « Organiser la remise »
                              chez le fournisseur          (+ étapes éventuelles, validées
                                        │                    par le client sur son reçu)
                                        └─────────────┬──────────────┘
                                                      ▼
              Client vérifie, montre son REÇU QR ─► scan puis « Confirmer la remise »
                                                      │
                                                      ▼
                                               Commande livrée
               ┌──────────────────────────────────────┤
               ▼                                      ▼
  Espèces remises à la caisse Suguba      Commission du revendeur bloquée
  (reçu de versement)                     quelques jours, puis retirable
```

1. **Commande** : créée par le serveur en une seule transaction (commande + commission +
   reçu). Prix, numéro et code sont calculés **côté serveur**. Une coupure réseau ne crée
   pas de doublon (« Reprendre ma commande »).
2. **Paiement** : **à la remise** (espèces, par défaut) ou **Orange / Moov Money** via
   SasPay. L'encaissement passe **toujours par Suguba**, y compris quand le fournisseur
   remet lui-même (il remet les espèces à la caisse).
3. **Reçu Suguba avec QR de remise** (`/recu/<n°>`) : QR, **code écrit dessous**, articles,
   montants, étapes de la prestation le cas échéant. Enregistrable en image ou en PDF,
   gardé **90 jours sur le téléphone** qui a commandé (« Suivre ma commande › Mes reçus »),
   « Transmettre au destinataire ». À montrer **seulement après vérification**.
4. **Remise** : scan du QR (ou saisie du code) par le livreur **ou par le fournisseur**
   qui remet lui-même. Le scan affiche sans valider ; « Confirmer la remise » valide.
   3 essais faux (au total) = commande bloquée.
5. **Commission** : bloquée après la livraison (14 jours nouveau revendeur, 7 vérifié,
   3 VIP), puis retirable.
6. **Après la livraison** : « **Signaler un problème avec un article** » depuis le reçu
   (motif, souhait, **jusqu'à 3 photos**) → **SAV & retours**.

Suivi public d'une commande : `/track` (numéro + téléphone, tentatives limitées).

---

## 5. Offres, devis et prestations

### Types d'offre (« Ajouter une offre »)

- **Nature** : produit, service, ou produit avec service (ex. kit solaire posé).
- **Qui remet** : un **livreur Suguba** (défaut), **le fournisseur lui-même** (avec frais
  de déplacement éventuels) ou **retrait chez lui**. Pas de livreur envoyé dans les deux
  derniers cas ; le fournisseur voit le téléphone du client **seulement une fois la
  remise prise en charge, et jusqu'à la remise** (voir « Coordonnées par dossier »).
- **Ce qui est inclus** : écrit par le fournisseur, affiché sur la fiche ; aucun
  supplément ne peut être ajouté après coup.
- **Comment le client commande** : achat direct, ou **sur devis**.

### Devis (`/p/<offre>/devis` → `/devis/<n°>`)

1. Le client décrit son besoin (sans compte, clé secrète sur son téléphone).
2. Le fournisseur est **prévenu** (cloche) et répond dans **Demandes de devis** : son prix,
   la part revendeur, ce qui est compris, la validité — ou un refus motivé.
3. Suguba calcule et **fige** le prix client ; le client **accepte ou refuse**.
4. Accepté → **commande normale** au prix du devis, reçu QR ouvert directement.
   Une demande ouverte par offre et par numéro, 5 au total ; un devis expiré ne s'accepte plus.
- **Admin › Devis** : demandes, retards (> 24 h sans réponse), prix fournisseur /
  revendeur / marge / client.

### Prestations à étapes

- Le fournisseur coche les étapes de son offre : **visite technique, rendez-vous,
  matériel remis, installation, prise en main**. La fiche montre « Comment ça se passe ».
- Il **déclare** chaque étape dans l'ordre avec sa **preuve** (date du rendez-vous,
  photos, description) ; le **client la valide ou la conteste** depuis son reçu. Le
  fournisseur ne valide jamais lui-même.
- **Réception finale** = scan du reçu, **refusée tant qu'une étape n'est pas validée**
  (application + base). Les gains ne se débloquent qu'à ce moment-là.
- **Admin › Prestations** : contestations et clients sans réponse (48 h), « Valider
  (après appel) » ou « Faire refaire », toujours avec une raison écrite.

---

## 6. L'argent

### Prix d'un produit

- **Le client paie : prix fournisseur + part revendeur** (+ frais de livraison ou de
  remise).
- Deux façons de fixer la part :
  1. le **fournisseur propose la part revendeur** → même prix partout ;
  2. **prix de gros** → chaque revendeur fixe son prix de vente.
- Les coûts de Suguba sont payés sur la part Suguba par défaut (option : les ajouter au
  prix client). Toutes les marges peuvent être mises à **0**.

### Priorité au réseau de revendeurs (Admin › Priorité au réseau)

| Réglage | Par défaut |
|---|---|
| Boutiques fournisseurs dans « Près de chez moi » et la recherche | Masquées |
| Achat direct dans la boutique d'un fournisseur | Fermé (ouvrable pour tous ou fournisseur par fournisseur) |
| Protection des articles au prix de gros | Activée |

- **Boutique fournisseur** = page de présentation : ni prix ni achat (prix retirés par le
  serveur), « Découvrir les offres des revendeurs partenaires ».
- **Article au prix de gros sans revendeur** : la fiche liste les offres des revendeurs à
  leur prix ; le serveur refuse l'achat au prix conseillé dès qu'un revendeur le propose.
  Les **cartes du catalogue** montrent le prix du revendeur d'origine, sinon « dès » le
  moins cher.
- **Revendeur d'origine** : retenu 30 jours dès l'arrivée par sa boutique ou son lien
  (premier contact). À la commande, le serveur décide : lien choisi, sinon revendeur déjà
  rattaché au téléphone, sinon provenance. « Votre partenaire : … » reste affiché.

### Missions, campagnes et sponsorisations

- **Compteurs fiables** : un visiteur ne compte qu'**une fois par mission** ; les clics du
  revendeur lui-même et les **robots d'aperçu** (WhatsApp, Facebook…) ne comptent pas ;
  un **partage ne compte que sur preuve de publication validée** (une capture ne sert
  qu'une fois).
- **Campagnes fournisseur** : canal choisi avant de payer, partages ou ventes,
  **activation refusée tant que le budget n'est pas reçu en entier**. Suivi réglé /
  dépensé / restant ; page de marque `/campagne/<id>` partagée par les revendeurs avec
  leur code. Jamais de paiement aux clics bruts.
- **Sponsorisations** : l'admin enregistre les paiements reçus ;
  **activation refusée sans le pack réglé** ; la durée démarre à l'activation ; reçu
  imprimable côté fournisseur.
- Paiements des campagnes et sponsorisations : **hors application** (Mobile Money,
  espèces), enregistrés par l'admin dans un **historique** (« Paiements reçus ») :
  chaque paiement s'ajoute avec sa référence, **une même référence ne sert qu'une fois**
  (« OM 123-456 » = « om123456 »), une erreur s'**annule avec un motif** sans rien
  effacer, et le total reçu est **recalculé par la base** (il ne s'écrit plus à la
  main). Droit Finance.

### Rémunération au résultat (lot 3)

Deux types de campagne fournisseur payés **à l'unité**, ouverts seulement quand l'admin
allume l'interrupteur **« Payer les résultats »** (Admin › Qualité des mesures) —
**désactivé** à la mise en ligne : d'ici là les visites sont seulement **mesurées**.

| | Visite qualifiée | Demande qualifiée |
|---|---|---|
| Ce qui compte | Arrivée par le lien d'un revendeur, **20 s** sur le produit **et** un geste (toucher, défiler) | Devis auquel le fournisseur **répond**, ou commande **confirmée par l'appel** Suguba |
| Une seule fois | par visiteur et par campagne | par client (téléphone) et par campagne |
| Exclus | robots d'aperçu, le revendeur lui-même | — |
| Prix minimum (fixé par le fournisseur) | 25 F | 500 F |
| Plafond | 50 visites payées / revendeur / campagne / jour | — |

- Budget = prix × nombre de résultats, **payé d'avance** ; chaque résultat le consomme ;
  **pause automatique** quand il ne couvre plus un résultat (garde-fou en base).
- Partage : **80 % au revendeur**, 20 % Suguba. Gain **en attente 7 jours**, puis
  retirable.
- **Suspect** (5 visites ou plus d'un même réseau en 24 h pour un revendeur) ou
  **contesté** par le fournisseur (sous **48 h**) : gain gelé jusqu'à la décision de
  l'admin (Valider / Annuler). Un résultat **annulé** rend son prix au budget.
- Aucune IP gardée : empreintes salées du visiteur et de son réseau. Le fournisseur ne
  voit que « Awa D. ».
- Limite connue : un tricheur patient peut simuler des visites (20 s par appareil) ;
  plafond, contrôle du réseau et contestation en limitent l'effet — surveiller la page
  qualité.

### Retraits des revendeurs

| Moyen | Frais |
|---|---|
| Orange / Moov Money | SasPay + opérateur + **1,5 % Suguba** |
| Espèces à l'agence | **1,5 % Suguba** seulement |

Le revendeur voit avant de valider **combien il recevra**. Retrait minimum réglable
(5 000 F par défaut).

### Caisse livreurs (espèces) et trésorerie

- Chaque livreur — ou fournisseur qui remet lui-même — remet les espèces encaissées. Par
  défaut le livreur **garde sa rémunération par course** (1 000 F) ; le fournisseur, lui,
  ne garde rien (il touche son prix normalement).
- **`/admin/caisse-livreurs`** : montant attendu, alerte orange après 24 h, rouge après
  48 h, « Enregistrer un versement » (admin avec droit Finance seulement : un collecteur
  ne valide jamais sa propre remise), reçu (n° VS-…).
- **Trois temps distincts** pour une vente en espèces : remise faite → client payé →
  **argent reçu par Suguba** (commande rattachée à un versement de caisse).
- **Le gain du revendeur attend l'argent** (décision du 26/09) : délai de sécurité passé
  **et** espèces reversées. Mobile Money inchangé ; ventes livrées avant la mise à jour
  (26/09, 15 h 23) non concernées. Le revendeur voit « Dont X F en attente du versement
  des espèces ». Versement partiel : les commandes couvertes sont libérées, le manque
  reste une dette du collecteur.
- **Avance** : « Débloquer avant terme » sur une vente dont l'argent n'est pas reçu =
  avance de Suguba, **motif obligatoire**, tracé (qui, quand, pourquoi).
- **Plafond d'espèces non versées** par collecteur (150 000 F par défaut, réglable ; 0 =
  sans plafond) ou retard grave (2 × le délai d'alerte) : **plus de nouvelle commande en
  espèces** (dispatch refusé, « Organiser la remise » refusé au fournisseur) jusqu'au
  versement. Courses en cours, SAV et versement restent possibles.

### Où se règle tout ça

- **Admin › Paramètres** (`/admin#reglages`) : part Suguba, coûts, prix de gros, frais,
  retraits, livraison, points relais, caisse (délai d'alerte, **plafond d'espèces**),
  codes promo, formules boutiques.
- **Admin › Priorité au réseau** : annuaire, achat direct, prix de gros.
- **Admin › Récompenses** : primes de parrainage, missions à payer.
- **Admin › Qualité des mesures** : interrupteur « Payer les résultats », mesures des 30
  derniers jours, résultats à vérifier.
- **Admin › Accès aux coordonnées** : qui a reçu les coordonnées de quels dossiers.

---

## 7. Fonctionnalités par espace

**Client** : catalogue et recherche, fiches (étiquettes Service / Installation incluse,
« Ce qui est inclus », « Comment ça se passe », offres des revendeurs), panier, commande
ou **demande de devis** sans compte, suivi, **reçu QR** (image, PDF, transmission,
**validation des étapes**, SAV avec photos), boutiques, pages de campagne, boutiques
suivies, notifications, B2B, diaspora.

**Revendeur** : catalogue et prix, partages suivis, « + Vente », commandes, clients,
commissions et retraits, boutique(s), parrainage, **missions avec preuves de
publication**, **campagnes au résultat** (gain par visite ou demande), partage des pages
de campagne, calendrier, créateur de visuels, badge.

**Fournisseur** : ajout d'offres (nature, qui remet, étapes, devis, variantes, photos),
inventaire, **commandes** (préparer, organiser la remise, déclarer les étapes, remettre en
scannant le reçu), **demandes de devis**, revendeurs, ambassadeurs, **campagnes**
(canal, budget réglé / dépensé / restant, **visites et demandes qualifiées** avec
contestation sous 48 h), **sponsorisation** (statut de paiement, reçu),
analyses, boutique (page de présentation), équipe.

**Livreur** : courses, carte, scan du QR du client (ou code), portefeuille.

**Admin** : tableau de bord, commandes, produits et prix, utilisateurs, vérifications,
boutiques, **Priorité au réseau**, SAV & retours (« Scanner un reçu »), **Devis**,
**Prestations**, caisse livreurs, **missions** (preuves à vérifier, budget, paiement des
campagnes), **Qualité des mesures** (paiement au résultat), récompenses,
**sponsorisations** (paiement reçu), diffusion, analyses, rapport
du soir, équipe, paramètres, guide.

---

## 8. UI / UX — le design system

- **Mobile d'abord** : 390 px, cibles de 44–48 px, champs en 16 px.
- **Police** : Inter.
- **Verts, chacun a UN rôle** :

| Jeton | Couleur | Usage |
|---|---|---|
| `suguba-profond` | `#0B3B2C` | En-têtes, menu du bas, bouton principal (texte blanc) |
| `suguba-brand` | `#09B500` | Marque, icônes, succès — **jamais de texte blanc dessus** |
| `suguba-brand-dark` | — | Texte vert sur fond blanc |
| `suguba-wa` | `#25D366` | Uniquement les boutons qui ouvrent WhatsApp |
| `suguba-citron` | `#C7F464` | Ce qui compte : gains, solde, onglet actif |
| `suguba-menthe` / `sauge` | — | Fonds clairs |

  Rouge = erreurs et annulations seulement. Gris : une seule échelle, `slate`.
- **Formes** : boutons en pilule, champs `rounded-xl`, cartes `rounded-2xl`/`3xl`.
- **Composants communs** (`src/components/ui/`) : `Button`, `Field`/`Input`,
  `ChoicePicker`, `Sheet`, `Toast`, `EmptyState`, `Surface`. Confirmations importantes
  en **deux temps dans la page** (pas de fenêtre derrière une autre).
- **Textes** : français simple, du point de vue de l'utilisateur ; une erreur dit quoi
  faire.
- Référence complète : `docs/design/design-system.md`.

---

## 9. Sécurité — ce qui est en place

**Accès**
- Session **signée (HMAC)** dans un cookie `httpOnly`, revérifiée en base à chaque requête.
- **Middleware** : espaces et API à rôle refusés avant tout affichage.
- **Permissions d'équipe** par route (`src/lib/reseau/permissions-routes.ts`) ; un test
  échoue si une route admin n'en a pas.
- `/admin/guide` : administrateur général uniquement.

**Données**
- **RLS** activée ; tables sensibles lisibles par le serveur seulement.
- **Prix fournisseur privés** : le catalogue passe par `/api/catalogue`, qui ne renvoie que
  les colonnes du rôle (visiteur = prix de vente ; revendeur = + ses gains ; fournisseur =
  + ses propres prix ; admin = tout), et la base **refuse ces colonnes à la clé publique**.
  Une nouvelle colonne de produit est privée par défaut.
- Adresses d'image de boutique gardées entières (plus de coupure à 160 caractères).

**Coordonnées par dossier** (Protection Suguba, lot 2) — un intervenant voit une
coordonnée *pour ce dossier, pendant cette étape, parce qu'il en a besoin* ; la donnée
ne quitte pas le serveur autrement (jamais envoyée puis cachée) :

| Qui | Voit | Quand |
|---|---|---|
| Livreur | Téléphone, repère, consignes du client ; adresse et téléphone du point de retrait | Course **en cours** seulement ; historique masqué (« Awa D. ») |
| Fournisseur qui remet lui-même | Nom, téléphone, repère du client | Après « Organiser la remise », jusqu'à la remise |
| Fournisseur, devis | Téléphone et repère du client | Tant que la demande attend **sa réponse** ; ensuite nom masqué, contact via Suguba |
| Revendeur | Ses propres clients | Toujours (ce sont ses ventes) |
| Revendeur ↔ fournisseur | Nom, logo, boutique — **aucune coordonnée** | — |

- Ni le livreur ni le revendeur ne reçoivent la **marge Suguba** ou le détail des prix ;
  le livreur ne voit pas la commission du revendeur.
- **Journal** de chaque coordonnée remise (une ligne par personne, dossier et jour) ;
  page admin « Accès aux coordonnées » : les devis consultés sans réponse sont signalés.
- Un numéro déjà communiqué peut avoir été copié : le masquage limite l'exposition, il
  ne remplace pas l'**engagement de non-contournement** (à rédiger juridiquement).

**Échanges, comptes liés, part Suguba, suspension** (Protection Suguba, lot 3)
- **Messagerie interne rattachée au dossier** : questions revendeur → fournisseur sur
  une offre (« Poser une question au fournisseur », « Mes questions », « Questions des
  revendeurs ») ; échanges client ↔ fournisseur dans le devis. Texte seul, 30 messages
  par jour. Un message avec un **numéro, un lien, une adresse e-mail ou une invitation à
  traiter hors Suguba** (« WhatsApp », « payez directement »…) attend la vérification
  de l'équipe (**Admin › Messages à vérifier** : remettre, ou refuser avec un motif) ;
  une référence de pièce ou un numéro de série passe. Prix et conditions passent par
  les actions prévues (devis, commande), pas par la conversation.
- **Comptes liés** (même compte, membre de l'équipe du fournisseur, même numéro) :
  participation refusée aux campagnes de ce fournisseur, garde-fou en base.
- **Part Suguba** : toute baisse (marge nette, taux, part revendeur relevée, code
  promo, gain sur le prix de gros, prix d'un produit qui ne laisse rien à Suguba) exige
  le droit **« Baisser la part Suguba »** (Super Admin par défaut) et un **motif** ;
  chaque baisse est gardée dans un journal que personne ne peut modifier ni effacer.
- **Suspension d'un partenaire** : motif obligatoire, notification, page
  **« Suspension »** pour la contester ; l'admin voit la contestation et, en
  suspendant, les commandes en cours et les gains encore dus (rien n'est effacé).

**Argent et commandes**
- Montants, prix, commissions, numéros et codes **calculés côté serveur**.
- Opérations sensibles **atomiques** en base (commande, retrait, livraison, versement,
  progression de mission).
- **Garde-fous en base** (même si l'application était contournée) : pas de livraison avec
  une étape non validée ; pas d'activation d'une campagne ou d'une sponsorisation non
  réglée ; un résultat payé une seule fois, jamais au-delà du budget reçu, rien payé
  tant que l'interrupteur est coupé ; gain d'une vente en espèces libéré seulement après
  le versement de l'argent ; paiement reçu jamais effacé, référence unique, total non
  modifiable à la main ; demande qualifiée faite avec le numéro du revendeur jamais
  payée.
- Paiement SasPay confirmé par **webhook signé** et revérifié.
- Reçus (commande, devis) ouverts seulement avec la **clé secrète du téléphone** qui a
  commandé ; le QR n'est pas un lien ; scan limité aux commandes assignées.
- Photos (SAV, étapes, preuves de publication) : métadonnées et **position GPS retirées**,
  stockage **privé**, liens temporaires (10 min).

**Règles de travail**
- Les **SQL sont exécutés par vous** dans Supabase › SQL Editor (fichiers
  `supabase/A-EXECUTER-…`), jamais automatiquement.
- Les secrets vont **uniquement** dans Vercel / Supabase.
- Le serveur local utilise la **vraie base** : aucun test ne doit y écrire.
- Captures d'écran : données personnelles **masquées**.
- Ne jamais ouvrir `/admin/boutique-suguba` sans le vouloir (l'ouvrir **crée** la boutique).

---

## 10. Architecture technique (pour un développeur)

| Élément | Choix |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Style | Tailwind CSS 3 + jetons `suguba-*` |
| Base | Supabase PostgreSQL, RLS, fonctions et déclencheurs de garde |
| Accès serveur | `getSupabaseAdmin()` (`src/lib/supabase-admin.ts`) |
| Moteur de prix | `src/lib/pricing.ts` |
| Catalogue | `/api/catalogue`, `src/lib/catalogue.ts` (colonnes par rôle) |
| Offres | `src/lib/offre.ts` (nature, remise, étapes), `src/lib/devis.ts`, `src/lib/etapes.ts` |
| Réseau | `src/lib/ancrage-revendeur.ts`, `src/lib/offres-revendeurs.ts`, `src/lib/presentation-fournisseur.ts`, réglages `reseau_reglages` |
| Missions | `src/lib/reseau/missions-db.ts` (`compter_evenement_mission`), `src/lib/reseau/preuves-missions.ts` |
| Paiement au résultat | `src/lib/reseau/resultats*.ts`, `/api/reseau/visite`, SQL `enregistrer_resultat_campagne` / `decider_resultat_campagne`, tables `visites_mesurees` et `campagne_resultats` |
| Trésorerie | `src/lib/caisse-livreur.ts` (plafond), `src/lib/paiements-recus.ts`, SQL `fonds_recus` / `liberer_commissions_echues`, tables `paiements_recus` et `tresorerie_reglages` |
| Coordonnées | `src/lib/acces-contacts.ts` (règles par dossier), table `acces_coordonnees` |
| Protection lot 3 | `src/lib/protection.ts` (baisses de la part Suguba, analyse des messages), `src/lib/messagerie.ts`, `src/lib/suspensions.ts`, SQL `comptes_lies`, tables `conversations`, `messages`, `journal_part_suguba`, `suspensions` |
| Réglages | `platform_settings` (prix) et `reseau_reglages` (réseau) |
| Session | `src/lib/session.ts`, `src/lib/active-session.ts`, `src/middleware.ts` |
| Paiement | `src/lib/saspay.ts`, `/api/payments/saspay/*`, `/api/webhooks/saspay` |
| Reçu et QR | `src/lib/recu-commande.ts`, `src/lib/qr-remise.ts`, `src/lib/remise-qr.ts` |
| Stockage privé | buckets `sav-photos`, `etapes-photos`, `preuves-missions` |
| Tests | `npm test` (243 tests, Node + PostgreSQL embarqué PGlite) |
| Guide | `docs/guide/guide.json` + `/admin/guide` |

**Variables d'environnement** (valeurs dans Vercel) : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
`SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `SUGUBA_DEMO_MODE`
(local seulement). **Aucune passerelle SMS n'est branchée.**

---

## 11. Faire évoluer la plateforme

1. Modifier en local, `npm test` et `npm run build` (jamais pendant que le serveur de dev
   tourne).
2. Mettre à jour **`docs/guide/guide.json`** dans le même commit (journal + pages).
3. Si un SQL est nécessaire : fichier `supabase/A-EXECUTER-<date>-<sujet>.sql`, **exécuté
   par vous**. Ordre : avant le code qui en dépend, sauf mention contraire (le SQL des prix
   privés devait passer **après** la mise en ligne).
4. « Met en ligne » → commit + push sur `main` → Vercel déploie (~2–3 min) → vérification
   → journal du guide passé à « en ligne ».

---

## 12. Points ouverts (au 26/09/2026)

**À essayer en vrai avec vos comptes** (rien de tout cela n'a encore tourné sur de vraies
données) :
- Scans du QR sur de vrais téléphones (livreur, fournisseur, admin).
- Offre « Moi-même » avec étapes : déclaration, validation sur le reçu, contestation,
  réception finale.
- Devis de bout en bout.
- Mission « Partager » : preuve envoyée, validée, capture en double refusée.
- Campagne et sponsorisation : activation refusée avant l'enregistrement du paiement.
- Vues revendeur / fournisseur / admin après le passage des prix privés (gains et
  « Mon prix » bien affichés).
- **Visite qualifiée** : produit ouvert par le lien d'un revendeur depuis un autre
  téléphone, 20 s + défilement → visible dans « Qualité des mesures ».
- Après quelques semaines de mesures stables : allumer « Payer les résultats », puis
  campagne test (budget, gain en attente, contestation, annulation qui rend le budget).
- **Trésorerie** : vente en espèces → gain « en attente du versement » → versement en
  caisse → gain retirable ; avance avec motif ; plafond (le baisser un instant pour voir
  le dispatch refusé) ; paiement reçu en double refusé, annulation avec motif.
- **Coordonnées** : un livreur ne voit plus le téléphone d'une course livrée ; un
  fournisseur ne voit le client qu'après « Organiser la remise ».
- **Messagerie** : question d'un revendeur sur une offre, réponse du fournisseur ;
  message avec un numéro retenu puis remis ou refusé dans « Messages à vérifier ».
- **Part Suguba** : baisser un taux dans les réglages → motif demandé ; suspension d'un
  compte de test avec motif, puis contestation depuis « Suspension ».

**Prochaines évolutions**
- Messagerie : pièces jointes (photos) dans les échanges.
- Comptes liés : une même personne avec deux numéros n'est pas détectée automatiquement.
- **Engagement de non-contournement** fournisseur / revendeur : à faire rédiger et
  valider juridiquement au Mali (hors application).
- **Lot 3 en ligne, interrupteur coupé** : décider quand allumer « Payer les résultats »
  au vu de la page « Qualité des mesures ».
- Paiement en ligne des campagnes et sponsorisations, remboursement du solde non utilisé.
- Prévenir le client sans compte d'une étape à valider (aujourd'hui, le fournisseur lui
  demande d'ouvrir son reçu).
- Retrouver son reçu sur un autre téléphone.

**Configuration et comptes**
- **Équipe fournisseur** : sa table n'existe pas en production (SQL de l'équipe jamais
  exécuté) — inviter des membres ne fonctionne pas tant qu'il ne l'est pas.
- **E-mails en spam** : configurer Resend (SMTP + DNS chez Hostinger, sans toucher au SPF).
- **Compte principal** (`infos@microofficeml.com`) sans numéro WhatsApp.
- **Ancien compte fournisseur** `microoffice16@yahoo.fr` (0 produit) : à supprimer ou non.
- **Captures du guide** : les connexions de démonstration ne passent plus depuis l'audit
  de sécurité ; beaucoup de nouvelles pages n'ont pas de capture.
- Aucune passerelle **SMS** : tout passe par l'application ou WhatsApp.
