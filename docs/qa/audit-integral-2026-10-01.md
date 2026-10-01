# Audit intégral de Suguba — QA, sécurité, argent, UI/UX (2026-10-01)

Référence : REQ-AUDIT-INT-001 / TASK-AUDIT-INT-001..024 / TEST-AUDIT-INT-001..064 (détail au § 13).

Les preuves détaillées et expurgées sont dans `audit-local/2026-10-01-integral/` (non versionné).

## Verdict

> **Mise à jour du 2026-10-01 :** le fondateur a exécuté les trois SQL du § 8 en production. Une vérification en lecture seule le confirme (`preuves/verif-sql-production.txt`) :
> - la sonde anonyme sur `verser_recompense` est refusée (401, code 42501) ;
> - la sonde sur `compter_sponsorisation` est refusée elle aussi (401) ;
> - la nouvelle signature de `apply_verified_payment` (avec `p_montant`) est en place ;
> - les colonnes `fonds_couverts`, `anomalie` et `variant_*` sont présentes.
>
> La faille critique est fermée.
>
> Le code de cet audit est **publié** : commit `2720fc8`, déploiement Vercel confirmé. Les styles publics contiennent le nouveau gris, et les pages clés répondent HTTP 200.

Verdict initial, avant l'exécution des SQL : **non prêt pour le déploiement tant que la faille critique n'est pas fermée en production.**

Des fonctions de la base sont exécutables avec la clé publique du site. L'une d'elles crée des commissions retirables (SEC-RPC-01) ; une sonde sans effet l'a prouvé. Le correctif est un SQL prêt et validé, **à exécuter par le fondateur en premier**.

Une fois les trois SQL du § 8 exécutés et le code de cet audit déployé, aucune faille critique ou élevée connue ne reste ouverte. Des risques moyens restent documentés au § 10.

Côté interface, sur les 116 pages scannées :
- les défauts d'accessibilité automatiquement détectables passent de 623 nœuds à 0 ;
- les décalages de mise en page des espaces revendeur et livreur sont fortement réduits.

Rien n'a été déployé. Aucune écriture, aucun paiement, aucun message n'a été fait en production.

## 1. Version, environnements, méthode, limites

- **Version auditée.** `main` = `origin/main` = `39048f5` (déployée le 30/09). La modification non commitée de `REPRISE.md` (publication de `39048f5`) a été conservée.
- **Environnement de test.**
  - Copie **locale isolée** de Supabase : Docker, CLI 2.119.0, Postgres 17.
  - 58 des 59 fichiers SQL rejoués dans l'ordre de la production (`purge-comptes.sql` exclu).
  - Schéma comparé à la production : 63 tables identiques.
- **Application.**
  - Compilation de **production** locale, branchée sur la base isolée.
  - Garde au lancement : 10 variables remplacées, aucune valeur de production.
  - Code navigateur sans le projet de production (0 occurrence).
  - Intercepteur réseau : SasPay redirigé vers un **faux SasPay local**, tout autre hôte externe refusé (0 appel bloqué).
- **Comptes fictifs.** 15 comptes `[QA]`, créés par le vrai parcours :
  - 2 clients ;
  - 2 revendeurs ;
  - 2 fournisseurs ;
  - 1 collaborateur ;
  - 2 livreurs ;
  - 1 diaspora ;
  - 5 admins (super admin, finance, support, livraison, sans équipe).
- **Production.** Lecture seule : en-têtes, schéma exposé, comptes de lignes, 3 pages publiques mesurées. S'y ajoute **une sonde sans effet** : montant 0, la fonction s'arrête avant toute écriture.
- **Outils.** Supabase CLI, Docker, PGlite, puppeteer-core 25.11 + Chrome, axe-core 4.x, et les scripts de `audit-local/…/outils/` :
  - `scan-ui` ;
  - `contraste` ;
  - `perf` ;
  - `cls` ;
  - `matrice-acces` ;
  - `boucle` ;
  - `preuves-correctifs`.

  Deux agents en lecture seule (sécurité, intégrité financière) ont été utilisés ; leurs constats ont été reproduits avant toute correction.
- **Skills.** Le skill `frontend-design` avait été chargé plus tôt dans cette session ; il n'a pas servi de méthode d'audit. Aucun skill d'audit de sécurité, d'accessibilité ou de QA n'a été chargé. Ni Codex Security ni scanner commercial n'était disponible. `npm audit` n'a pas été exécuté.
- **Limites.**
  - Pas de vrai téléphone ni de réseau malien ; faux SasPay.
  - Pas de test de charge ni de déni de service.
  - Parcours UI couverts par scan automatisé et contrôles ciblés, sans vrais utilisateurs ni lecteur d'écran.
  - axe-core ne détecte qu'une partie des défauts WCAG.
  - 6 pages non scannées (paramètre secret).

## 2. Inventaire et couverture

- **Pages.** 122 au total : admin 37, public 35, revendeur 23, fournisseur 17, compte 7, livreur 3. 116 scannées à 390 et 1440 px. Les pages modifiées ont aussi été scannées à 320 px.
- **Routes API.** 153 routes, soit 212 couples route/méthode, dont 53 écrivent. Revue de code : 153 / 153.
- **Matrice d'autorisations.** 212 couples × 11 identités = **2 332 appels réels**, relancés sur la compilation finale.
  - Avant : 0 accès hors rôle, 9 erreurs 500.
  - Après : **0 accès hors rôle, 0 erreur serveur**.

## 3. Boucle complète (parcours numérotés E1 à E10)

- **E1** — Dépôt et publication automatique (24 000 F).
- **E2** — Commande attribuée :
  - même clé = même commande ;
  - stock réservé ;
  - prix imposé par le navigateur ignoré.
- **E3** — Droits d'équipe ; livreur à valider.
- **E4** — Ramassage :
  - client masqué au fournisseur ;
  - autre fournisseur aveugle ;
  - livreur non attribué : 403 ;
  - mauvais code refusé.
- **E5** — Remise et livraison :
  - code de remise avec la clé du reçu ;
  - livraison ;
  - rejeu sans effet ;
  - gains bloqués.
- **E6** — Caisse ; double versement refusé.
- **E7** — Libération après délai et réception des fonds.
- **E8** — Retraits simultanés :
  - un seul accepté ;
  - frais de 90 F ;
  - droits vérifiés ;
  - double paiement refusé.
- **E9** — Retrait fournisseur Orange :
  - 57 800 F exactement demandés ;
  - webhook ;
  - rejeu sans effet.
- **E10** — Paiement client :
  - webhook falsifié : 403 ;
  - « en cours » ignoré ;
  - double paiement : 409.

Résultat avant corrections : 39/42 (3 artefacts de l'outil, pas de l'application). Détail : `preuves/boucle-*.txt`.

## 4. Registre des anomalies

Le registre complet (constat, gravité, statut, fichiers) est repris depuis `audit-local/…/registre.md`.

| ID | Gravité | Constat | Statut |
|---|---|---|---|
| SEC-RPC-01 | CRITIQUE | `verser_recompense` et 12 fonctions SECURITY DEFINER exécutables avec la clé publique. Local : 50 000 F crédités. Prod : sonde montant 0 → 200 false. Aucun abus en prod. | CORRIGÉ par le SQL `A-EXECUTER-2026-10-01-securite-fonctions.sql` (local : 42501) et `tests/securite-fonctions-sql.test.cjs`. **À EXÉCUTER EN PROD.** |
| PROD-SQL-01 | ÉLEVÉ latent | `equipe-v3-variantes` jamais exécuté en prod : variantes cassées, compteurs inertes, missions vente ouvertes à tout produit. 0 mission en prod. | À EXÉCUTER EN PROD, puis rejouer `securite-fonctions` |
| FIN-02 | ÉLEVÉ | Livraison forcée sans `delivered_at` comptée comme fonds reçus ; livreur modifiable après livraison | CORRIGÉ : SQL `integrite-argent` + 409 côté admin + `tests/integrite-argent.test.cjs` |
| FIN-03 | MOYEN | Un versement incomplet libère tout | CORRIGÉ (couverture par ancienneté + régularisation) |
| FIN-04/A7 | MOYEN | Paiement MoMo accepté sur une commande annulée, déjà payée en espèces, ou pour un montant insuffisant | CORRIGÉ (SQL + `p_montant` côté webhook et statut) |
| FIN-19 | FAIBLE | Double « Argent remis » | CORRIGÉ (SQL + 409) |
| FIN-05 | MOYEN | Refus SasPay → retrait bloqué en `processing` | CORRIGÉ (refus définitif → `rejected`, solde rendu) |
| FIN-06 | MOYEN | Double validation ouverte si le réglage est illisible ; `unlock-commission` | CORRIGÉ + test |
| FIN-07 | MOYEN | Sponsorisation possible sans formule | CORRIGÉ |
| FIN-08 | MOYEN | Récompense en échec annoncée comme versée | CORRIGÉ + test |
| FIN-09 | MOYEN | Réglages par défaut appliqués en silence | PARTIEL (`saspay/create` strict) |
| A2/FIN-11 | ÉLEVÉ | Commandes anonymes illimitées | PARTIEL (plafond de 5 par téléphone) ; reste la limite par IP et l'expiration |
| A3 | MOYEN-ÉLEVÉ | `review-profile` applicable à tout compte | CORRIGÉ |
| A4 | MOYEN | Redirections ouvertes | CORRIGÉ (`chemin-interne.ts`) + test |
| A6 | MOYEN | Frais de livraison pilotés par le GPS | CORRIGÉ (on garde le maximum) ; test mis à jour (décision révisable) |
| A11 | MOYEN | Push MoMo vers n'importe quel numéro | CORRIGÉ |
| A13 | FAIBLE | Retrait possible en aperçu | CORRIGÉ |
| A14 | FAIBLE | Commission visible dans le reçu acheteur ; OTP SAV généré par `Math.random` | CORRIGÉ ; messages `error.message` bruts NON TRAITÉS |
| B2 | ÉLEVÉ cond. | `exchange` sans e-mail confirmé, ou rattachement à un autre compte | CORRIGÉ et prouvé (B2.1, B2.2) |
| B3 | MOYEN | IP falsifiable | CORRIGÉ (`ip-client.ts`) |
| B8 | FAIBLE | `refresh-session` sans vérifier la révocation | CORRIGÉ |
| UPLOAD | FAIBLE | Erreur 500 si la requête n'est pas multipart | CORRIGÉ (400) |
| UI-A11Y-01 | MOYEN | Contraste insuffisant : 609 nœuds sur 30 pages | CORRIGÉ (§ 9) + `tests/contraste-jetons.test.cjs` |
| UI-A11Y-02 | MOYEN | 10 champs sans nom accessible (lien à copier, 5 pages) | CORRIGÉ |
| UI-A11Y-03 | MOYEN | 4 listes déroulantes sans nom (catalogue revendeur) | CORRIGÉ |
| UI-A11Y-04 | FAIBLE | 224 cibles de moins de 24 px (mesure brute) | 0 échec au critère WCAG 2.5.8 (§ 9) |
| UI-CLS-01 | MOYEN | Décalages de mise en page : revendeur 0,272, livreur 0,192, catalogue 0,165 | CORRIGÉ en partie (0,109 / 0,028 / 0,019) |
| UI-CONSOLE-01 | INFO | 401/403 attendus dans la console (destinataires, favoris, compte/boutiques) | NON CORRIGÉ (sans effet visible) |
| PROC-01 | PROCESSUS | Le scanner a capturé `/admin/boutique-suguba`, contrairement à la consigne | Captures supprimées ; le scanner mesure désormais cette page sans la capturer |
| A5 | MOYEN politique | Coordonnées des clients exposées au revendeur (feed), alors qu'elles sont masquées dans /clients | DÉCISION |
| A8, A9, A10, A12, CSP, FIN-10/12/13..18/20/21 | — | Voir les rapports des agents | NON TRAITÉS (recommandations, § 10) |

Preuves en conditions réelles, rejouées sur la **compilation finale** : **14 / 14 réussies** (`preuves/preuves-correctifs.json`). La preuve FIN-02.2 a été durcie : elle exige désormais le 409 « Le livreur d'une commande livrée ne peut plus être changé. ». Un premier passage acceptait une erreur 500.

## 5. Autorisations et confidentialité

- 0 exception sur 2 332 appels.
- Le support ne paie pas, la livraison ne confirme pas, l'admin sans équipe n'a aucun droit.
- Aucun secret dans les 553 fichiers envoyés au navigateur.
- Coordonnées du client masquées au fournisseur.
- Commission retirée du reçu acheteur.
- Point de politique **SEC-A5** à trancher : coordonnées des clients visibles par le revendeur via `/api/orders/feed`.

## 6. Rapprochement financier

Tous les montants ci-dessous sont identiques aux attentes.

- **Commande 3 × 24 000 F** :
  - total : 72 950 F ;
  - commission : 6 000 F ;
  - dû au fournisseur : 60 000 F.
- **Retrait guichet de 6 000 F** : 90 F de frais, 5 910 F versés.
- **Retrait fournisseur de 60 000 F (Orange)** : 900 + 1 300 F de frais, 57 800 F demandés à SasPay.
- **Paiement client de 24 950 F** :
  - 25 200 F demandés (+1 %) ;
  - 26 208 F affichés (SasPay +4 %).

## 7. Tests et compilation

| | Départ | Fin d'audit |
|---|---|---|
| `npm test` | 409 réussis | **422 réussis, 0 échec** |
| TypeScript (`tsc --noEmit`) | — | sans erreur |
| `npm run build` | réussi | **réussi** (serveur local arrêté avant) |
| Compilation locale isolée | — | réussie |
| Preuves des correctifs | — | 14 / 14 |
| Matrice d'autorisations | 9 erreurs 500 | 0 erreur, 0 accès hors rôle |

Les 13 tests ajoutés sont répartis dans :
- `securite-fonctions-sql` ;
- `integrite-argent` ;
- `audit-integral-2026-10-01` ;
- `contraste-jetons`.

Le test GPS a été mis à jour pour la nouvelle règle.

Le test de contraste a été vérifié dans les deux sens : il échoue avec l'ancien gris (4,36:1) et passe avec le nouveau. Aucun test ni contrôle n'a été désactivé.

## 8. Migrations à exécuter (Supabase › SQL Editor), dans cet ordre

**Exécutés en production le 2026-10-01 et vérifiés en lecture seule (voir le verdict).**

1. **`A-EXECUTER-2026-10-01-securite-fonctions.sql` — URGENT.** Ne touche qu'aux droits. Une requête de vérification est incluse : elle doit renvoyer 0 ligne.
2. `A-EXECUTER-equipe-v3-variantes.sql` : jamais exécuté en production, rejouable. **Puis rejouer** le fichier 1.
3. `A-EXECUTER-2026-10-01-integrite-argent.sql`, **avant** de déployer le code de cet audit, car le webhook appelle sa nouvelle signature. Le retour arrière est décrit en fin de fichier.

Les corrections d'interface (§ 9) ne demandent aucune migration.

## 9. Interface, accessibilité et performance

### 9.1 Protocole

- **Scan.** `outils/scan-ui.mjs` parcourt les 116 pages à 390 et 1440 px, sur la compilation locale isolée, avec une identité fictive par profil. Il vérifie pour chaque page :
  - le débordement horizontal ;
  - les règles axe-core WCAG 2.2 AA ;
  - les cibles tactiles ;
  - les erreurs console et réseau.
- **Critère 2.5.8.** La mesure WCAG a été ajoutée en fin d'audit : un cercle de 24 px est centré sur chaque petite cible et ne doit toucher aucune autre cible. Elle a été validée sur une page témoin : deux boutons collés échouent, un bouton isolé passe.
- **Performance.** `outils/perf.mjs` mesure en laboratoire : Chrome, 390 px, réseau mobile simulé (1,6 Mb/s, 150 ms de latence), processeur ralenti ×4, cache froid puis chaud. Ce ne sont **pas** des mesures terrain.
- **Décalages de mise en page.** `outils/cls.mjs` identifie les éléments déplacés.

### 9.2 Avant / après (mêmes pages, même méthode)

| Mesure | Avant | Après |
|---|---|---|
| Pages en erreur ou qui débordent | 0 / 0 | 0 / 0 |
| Nœuds axe-core en échec | **623** (contraste 609, champ sans nom 10, bouton sans nom 4) sur 34 pages | **0** |
| Cibles < 24 px, mesure brute | 224 | 156 sur les pages concernées |
| Cibles en échec WCAG 2.5.8 (avec l'exception d'espacement) | non mesuré | **0** |
| CLS `/reseller` | 0,272 | 0,109 |
| CLS `/driver` | 0,192 | 0,028 |
| CLS `/reseller/catalog` | 0,165 | 0,019 |
| JavaScript au premier chargement (277 routes) | moyenne 147,1 ko | 147,1 ko (aucune route modifiée) |

Corrections apportées :

- **Gris secondaire.** Le jeton `slate-500` passe de `#64748b` à `#5f6f86` (4,67 à 5,12:1 sur les fonds clairs). Le changement est quasi invisible et corrige 270 nœuds d'un coup.
- **Vert de marque.** Le texte vert sur fond clair passe de `brand` (2,75:1) à `brand-dark`, comme le prévoyait déjà la règle de `tailwind.config.js`. Cela concerne :
  - le prix produit ;
  - les statistiques ;
  - le code promo ;
  - la date du jour du calendrier ;
  - le lien WhatsApp de `/track`.
- **Badges et textes pâles.** Le badge « À rencontrer » passe à ambre 100/800, au lieu de blanc sur ambre (2,14:1). Les textes slate-400 et gray-400 passent un ton au-dessus. L'étape 3 de `/b2b/partner` passe en sky-400 sur fond sombre.
- **Noms accessibles.** Ajout de « Lien à partager » et de « Trier les produits » / « Filtrer par fournisseur ».
- **Petites cibles.** Zone de 24 px pour les bulles « Explication de ce réglage », les titres de « À traiter » et le lien WhatsApp de `/track`.
- **Décalages de mise en page.**
  - Le bandeau « Chargement des commandes… » devient une pastille flottante : il ne pousse plus la page. Les erreurs de chargement restent, elles, dans le flux.
  - La carte « Ma boutique » du catalogue garde sa place pendant le chargement.

### 9.3 Mesures de chargement (laboratoire, mobile simulé)

**Production (lecture seule)** :

| Page | 1er chargement FCP / LCP | Transfert (dont JS) | Visite suivante LCP / transfert |
|---|---|---|---|
| `/` | 1 712 / 1 712 ms | 476 ko (281) | 472 ms / 58 ko |
| `/rejoindre` | LCP 2 176 ms | 486 ko (293) | 172 ms / 37 ko |
| `/login` | 2 748 ms | 451 ko (265) | 208 ms / 19 ko |

**Compilation finale locale.** Serveur local : ces mesures isolent le coût côté navigateur, sans la latence de Vercel ni de Supabase.

| Profil | Page | FCP / LCP froid | Transfert (JS) | LCP chaud |
|---|---|---|---|---|
| Visiteur | `/` | 804 / 804 ms | 445 ko (248) | 88 ms |
| Visiteur | `/p/…` | 784 / 2 548 ms | 417 ko (226) | 136 ms |
| Client | `/compte` | 824 / 2 536 ms | 417 ko (213) | 452 ms |
| Revendeur | `/reseller` | 904 / 904 ms | 467 ko (254) | 272 ms |
| Fournisseur | `/supplier` | 1 136 / 2 684 ms | 427 ko (221) | 648 ms |
| Livreur | `/driver` | 844 / 2 460 ms | 417 ko (222) | 428 ms |
| Admin | `/admin/commandes` | 788 / 3 268 ms | 520 ko (242) | 924 ms |
| Diaspora | `/diaspora` | 876 / 876 ms | 414 ko (222) | 72 ms |

Lecture : le premier affichage reste sous la seconde partout, sauf `/login` (2,3 s). En revanche, le LCP froid dépasse 2,5 s sur plusieurs espaces connectés, et sur le réseau réel il faut y ajouter la latence. C'est un chantier à part (§ 10). Rien de cet audit ne l'a aggravé : le poids JavaScript est inchangé.

## 10. Risques résiduels et recommandations (non livrés)

**Sécurité et argent**
- Limite par IP et expiration des commandes en attente (Vercel Firewall).
- SEC-A5.
- SEC-A6 : décision révisable.
- Textes publics non analysés (A8).
- Hiérarchie de l'équipe (A9).
- Suivis par téléphone (A10).
- Déconnexion sans révocation, numéro de retrait libre (A12).
- CSP sans `script-src`.
- Missions comptées dès la commande (FIN-12).
- Ni remboursement ni reprise après retrait (FIN-10).
- Réglages par défaut appliqués en silence hors paiement (FIN-09).
- Soldes plafonnés à 5 000 lignes (FIN-18).
- Frais de remise sans plafond (FIN-13).
- Erreurs techniques renvoyées brutes (A14).

**Interface**
- CLS de 0,106 restant sur `/reseller`, dû au bandeau « Terminez votre démarrage » (nouveaux revendeurs seulement).
- LCP froid de plus de 2,5 s sur `/supplier`, `/driver`, `/admin`, `/compte` et `/p/…`.
- `/login` lent à afficher (2,3 s en local).
- Vert de marque à 2,75:1 sur les icônes : acceptable pour un décor, pas pour une icône qui porte seule une information.
- Sondes 401 visibles dans la console.

## 11. Notes par profil (sur 5)

Ces notes sont des **estimations d'auditeur**, pas des mesures auprès d'utilisateurs. Elles s'appuient sur :
- la boucle complète (§ 3) ;
- la matrice d'autorisations ;
- le scan des 116 pages ;
- la relecture du code ;
- les audits de profils du 30/09.

Aucun vrai client, revendeur ou livreur n'a été observé, et aucun téléphone d'entrée de gamme ni réseau malien réel n'a été utilisé. Les notes valent **après** les corrections de cet audit et l'exécution des SQL.

| Profil | Compréhension | Efficacité | Fiabilité | Accessibilité | Récupération | Ce qui fonde la note |
|---|---|---|---|---|---|---|
| Visiteur / client sans compte | 4 | 4 | 4 | 3,5 | 4 | Commande en un formulaire, reçu serveur avant tout succès. Même clé = même commande. Plafond de 5 commandes en attente annoncé clairement. |
| Client connecté | 3,5 | 4 | 4 | 3,5 | 3,5 | Destinataires pré-remplis. `/compte/boutiques` affiche « réservé » au lieu d'être masqué. Carte et historique peu exercés. |
| Revendeur | 3 | 3,5 | 4 | 3,5 | 4 | Argent bien tenu (FIN-02/03), retrait idempotent, récompense non versée remise « à valider ». Beaucoup d'outils, hiérarchie encore à apprendre. |
| Fournisseur | 3,5 | 3,5 | 4 | 3,5 | 4 | Offre en étapes ; client masqué ; retrait exact au franc. Deux espaces boutique ; pas de reprise après retrait. |
| Livreur | 4 | 4 | 4 | 3,5 | 3,5 | Action proposée selon l'étape, code de remise, caisse couverte par ancienneté, livreur figé. Pas de mode hors ligne ; versement partiel expliqué seulement à l'admin. |
| Admin / équipe | 3 | 3,5 | 4 | 3 | 3,5 | 0 exception de droits, double validation fermée en cas d'erreur, 409 en cas de conflit. 37 pages denses, LCP froid de 3,3 s sur les commandes. |
| Diaspora | 3,5 | 3,5 | 3,5 | 3,5 | 3,5 | Paiement relié à la clé du reçu. Testé uniquement contre un faux SasPay, sans vraie carte. |

L'accessibilité plafonne à 3,5 pour trois raisons :
- aucun test au lecteur d'écran ;
- axe-core ne couvre qu'une partie des critères ;
- les icônes vertes restent à 2,75:1.

## 12. Non testé ou bloqué

- **Production.** Aucune écriture, aucun paiement, aucun SMS, e-mail ou WhatsApp. Les SQL du § 8 ne sont **pas** exécutés : ils relèvent du fondateur.
- **Paiements.**
  - Vrai SasPay (Orange, Moov, Wave, carte) : seulement simulé par un faux SasPay qui reproduit les réponses observées.
  - Délais de libération réels et tâches planifiées de Vercel : non exercés.
- **Accessibilité et appareils.**
  - Lecteurs d'écran (VoiceOver, TalkBack), zoom à 200 % et navigation entièrement au clavier : non testés, sauf pour les composants déjà vérifiés le 28/09.
  - Vrais téléphones, réseau malien, mode hors ligne : non testés.
- **Couverture et outils.**
  - 6 pages à paramètre secret, non scannées.
  - Charge et déni de service : exclus par consigne.
  - `npm audit` et scanners commerciaux : non exécutés ou indisponibles.

## 13. Traçabilité

| Exigence | Tâches | Tests et preuves |
|---|---|---|
| REQ-SEC-RPC-001 (fonctions de base fermées) | TASK-AUDIT-INT-001 | `tests/securite-fonctions-sql.test.cjs`, `preuves/rpc-anon.txt`, sonde production |
| REQ-FIN-INT-001..008 (argent reçu, versements, paiements tardifs, refus SasPay, double validation, récompenses) | TASK-AUDIT-INT-002..009 | `tests/integrite-argent.test.cjs`, `tests/audit-integral-2026-10-01.test.cjs`, preuves FIN-02.1/02.2/05.1/19.1 |
| REQ-SEC-REDIR-001, REQ-SEC-FLOOD-001, A3, A11, A13, B2, B3, B8, UPLOAD | TASK-AUDIT-INT-010..019 | `tests/audit-integral-2026-10-01.test.cjs`, preuves A2.1, A3.1-3, A11.1-2, A13.1, B2.1-2, UPLOAD.1, matrice 2 332 appels |
| REQ-A11Y-CONTRASTE-001, REQ-A11Y-NOMS-001, REQ-A11Y-CIBLES-001 | TASK-AUDIT-INT-020..022 | `tests/contraste-jetons.test.cjs`, `ui-avant/` vs `ui-apres/`, `ui-final/`, `ui-final2/` |
| REQ-PERF-CLS-001 | TASK-AUDIT-INT-023 | `preuves/perf-local-mobile*.json`, `preuves/cls-apres.txt` |
| REQ-AUDIT-INT-001 (rapport, REPRISE, guide) | TASK-AUDIT-INT-024 | ce rapport, `REPRISE.md`, `docs/guide/guide.json` |
