# Audit UI/UX de Suguba — 2 octobre 2026

Audit seulement : aucune correction, aucune migration, aucun déploiement. Version : `6d32f14` (code applicatif identique à `2720fc8`).

Page visuelle : https://claude.ai/artifact/X5fHtUNF4XrcD212k1Bvuj (privée). Elle contient la synthèse, 7 écrans avant / après et le plan.

## Méthode

- **Skill utilisé.** `audit-ui-ux-peak`, créé le 2026-10-02 dans `~/.claude/skills/`.
  - Il reprend la démarche publique d'uxpeak.com : avant / après raisonné.
  - Six lentilles : finition, composants, parcours, fidélisation, conversion, cohérence.
  - Il tient compte du contexte mobile d'un marché émergent.
  - Aucun contenu payant d'uxpeak n'est repris.
- **Captures.** 230 captures, soit 115 pages en 390 et 1 440 px.
  - Prises le 2026-10-01 sur la copie locale isolée, avec des comptes fictifs [QA].
  - Certaines couvrent la page entière, d'autres seulement le haut de l'écran.
  - Dossier : `audit-local/2026-10-02-ui-ux/captures-retenues/`.
- **Code.** Lecture des pages et des composants, mesures sur les 230 fichiers `.tsx`.
- **Relectures.** Quatre relectures en parallèle : public et client, revendeur, fournisseur et livreur, équipe.
  - Les constats les plus lourds ont été revérifiés dans le code : LIV-01, REV-01, PUB-01, PUB-04, PUB-05, ADM-02, ADM-03, ADM-04.
- **Limites.**
  - Aucun utilisateur réel, aucun vrai téléphone, aucun réseau malien.
  - Jugés sur le code seulement : états de succès et d'erreur, fenêtres, course livreur active.
  - Les « photo indisponible » viennent de la copie locale : `next/image` ne charge pas les images de la base locale.
  - Aucune nouvelle capture pleine page n'a été prise.
- **Non recompté.** Ce que les audits du 28/09, du 30/09 et du 01/10 ont déjà traité : contrastes, décalages, LCP, parcours profils.

## Notes par profil

Estimations d'auditeur sur 5, pas des mesures.

| Profil | Finition | Composants | Parcours | Fidélisation | Conversion / confiance | Cohérence |
|---|---|---|---|---|---|---|
| Visiteur / client sans compte | 3 | 3 | 3,5 | 2,5 | 3 | 2,5 |
| Client connecté | 3 | 3 | 2,5 | 2 | 3 | 2,5 |
| Revendeur | 2,5 | 2,5 | 3 | 2,5 | 3 | 2 |
| Fournisseur | 3 | 3 | 2,5 | 2,5 | 3,5 | 3 |
| Livreur | 2,5 | 2 | 3 | 2 | 2 | 1,5 |
| Équipe / admin | 3 | 3 | 3,5 | 3 | 3 | 2,5 |

## Causes communes (mesurées dans le code)

**Petit et gras partout**
- Mesure :
  - `text-xs` (13 px) 1 205 fois, contre 92 pour `text-base` ;
  - `font-bold` 1 074 fois, contre 297 pour `font-semibold` ;
  - `BottomNav.tsx:215` en `text-[11px]`.
- Correction : 16 px pour l'essentiel, semi-gras pour les titres, gras pour les montants. Barre du bas à 13 px.

**L'argent sans dictionnaire**
- Mesure :
  - 40 petites fonctions locales de formatage (`fcfa`, `enF`, `fmt`, `k`…) ;
  - quatre écritures : « F », « FCFA », « 342k F », « 36.59 € » ;
  - 9 formats de date.
- Correction : `lib/montant.ts` (U+00A0 et vrai signe −), des libellés et statuts communs, un `MontantInput`.

**`Button` contourné**
- Mesure :
  - 158 `<button>` faits main dans 74 fichiers ;
  - aucun `Button` côté livreur ;
  - variante `whatsapp` jamais utilisée côté revendeur ;
  - boutons de 32 à 36 px ;
  - pas d'état `loading`.
- Correction : `Button` partout, `loading` qui garde la largeur, `BoutonPartageWhatsApp`, 44 px minimum.

**Pas de ligne de liste commune**
- Mesure :
  - montants cassés sur plusieurs lignes (livreur) ;
  - titres écrasés par le statut (fournisseur) ;
  - raccourcis tronqués (revendeur) ;
  - colonne d'action coupée (admin).
- Correction : `ListRow` (texte `min-w-0 flex-1`, valeur `shrink-0 whitespace-nowrap`). Colonne d'action collante dans `TableauAdmin`.

**Deux générations de pages**
- Mesure :
  - les briques de `ui/Surface.tsx` sont importées par 71 fichiers, mais les boucles principales sont faites main ;
  - 3 fonds de page, 5 libellés de retour ;
  - 249 `emerald-*` et 95 `gray-*` ;
  - deux composants EmptyState.
- Correction : passer sur `PageReseau` + Surface. Un seul `EmptyState`, avec une variante erreur + « Réessayer ».

**Coque d'application incomplète**
- Mesure :
  - ni `not-found.tsx` ni `error.tsx` ;
  - `shadow-xs` (27 usages dans 18 fichiers) n'existe pas en Tailwind 3 ;
  - `body` en `h-full` (`layout.tsx:56`) ;
  - suivi introuvable sur ordinateur.
- Correction : pages 404 et erreur en français, une ombre définie, `min-h-full`, liens Suivi et Aide.

**Pastille « succès » criarde**
- Mesure : `Surface.tsx:113` donne `succes` = `bg-suguba-brand`.
- Correction : fond menthe avec un point vert, et un ton « à agir » ambre avec icône.

## Constats

Chaque constat donne la preuve, la proposition, puis l'effort et l'impact. Impact : 1 = finition, 2 = gêne réelle, 3 = bloque ou trompe.

### Visiteur et client

**PUB-01 — Ni frais ni total livré sur la fiche produit**
- Preuve : `p/[slug]/page.tsx:341` et `:479`. `useOrderQuote` (`:110`) renvoie `fraisLivraison`, qui n'est pas affiché.
- Proposition : ligne de livraison, et bouton « Commander · total ».
- Effort S, impact 3.

**PUB-02 — « Commande reçue » surchargé et contradictoire**
- Preuve : `order-success/[orderNumber]/page.tsx` montre 3 boutons pleins de 3 couleurs.
  - Il propose un paiement Mobile Money alors que `commander/page.tsx:661` promet « aucun paiement en ligne ».
  - La prochaine étape est écrite en 13 px (`:80`).
- Proposition :
  - la prochaine étape en grand ;
  - le numéro et le code dans deux cartes ;
  - Mobile Money replié et facultatif ;
  - un seul bouton plein, « Suivre ».
- Effort M, impact 3.

**PUB-03 — Suivi sans étape courante**
- Preuve :
  - l'étape courante est calculée (`track/[orderNumber]/page.tsx:178-209`) mais jamais affichée (`:301`) ;
  - jargon (`:206`) ;
  - un bouton à icône de téléphone ouvre WhatsApp (`:345`) ;
  - double indicateur de chargement (`:240-242`).
- Effort S–M, impact 3.

**PUB-04 — Diaspora : « Offrez » alors que le proche paie à la réception**
- Preuve :
  - `diaspora/page.tsx:191`, `:197` et `:456` ;
  - e-mail obligatoire (`:393-396`) ;
  - `toFixed(2)` avec un point, arrondi ligne par ligne (`:78`) ;
  - aucun `Button`, 20 `emerald-*`.
- Effort M, impact 3.

**PUB-05 — Liens morts et impasses**
- Preuve :
  - pas de 404 ni de page d'erreur ;
  - `notFound()` dans `s/[slug]:61`, `r/[code]:52` et `boutique/[slug]:138` affiche la page par défaut, en anglais ;
  - `/recherche` vide (`:76`) et `/compte/boutiques` sans issue.
- Effort S, impact 3.

**PUB-06 — Les vitrines perdent l'unité, le minimum et le devis**
- Preuve : `BoutiqueProduits.tsx:109`, `lib/shop.ts:19-30`. Le même produit affiche « Ajouter » d'un côté, « Acheter » de l'autre.
- Effort S–M, impact 3.

**PUB-07 — Garantie promise mais absente**
- Preuve : `legal/warranty/page.tsx:59`, et aucune colonne en base (`lib/cloud-sync.ts:136`).
- Effort S, impact 2.

**PUB-08 — « Recommander » à côté de « Commander »**
- Preuve : `p/[slug]/page.tsx:313`.
- Proposition : « Partager », en contour.
- Effort S, impact 2.

**PUB-09 — Trois formats de montant dans un même achat**
- Effort M, impact 2.

**PUB-10 — Deux tunnels de commande qui divergent, plus la diaspora**
- Preuve : `commander/page.tsx` et `panier/page.tsx`. Mobile Money n'est pas proposé après `/panier/confirmation`.
- Effort L, impact 2.

**PUB-11 — Suivi introuvable sur ordinateur**
- Preuve : `BottomNav.tsx:161`.
- Effort S, impact 2.

**PUB-12 — Vitrine : « Suivre » en bouton principal, produits à 735 px**
- Preuve : `BoutiqueProduits.tsx:93`.
- Effort M, impact 2.

**PUB-13 — Accueil : réassurance placée trop bas, deux largeurs de colonne**
- Preuve : `page.tsx:117`, `:231` et `:318`.
- Effort S, impact 2.

**PUB-14 — Espace client sans commande en cours ; « Se déconnecter » seul bouton plein**
- Preuve : `OngletsCompte.tsx`.
- Effort S, impact 2.

**PUB-15 — Fond de page coupé à la hauteur de l'écran ; 3 couleurs de fond**
- Preuve : `layout.tsx:56`.
- Effort S, impact 1–2.

### Revendeur

**REV-01 — Ventes : « Livré & Encaissé » alors que la commission est bloquée**
- Preuve :
  - `reseller/orders/page.tsx:58` et `:107` ;
  - la bande commission lit `state.commissions` (`:82`), un tableau local vide (`lib/mock-data.ts:183`) que le serveur ne remplit jamais ;
  - 4 statuts sur 8 n'ont pas de badge (`:104-127`).
- Proposition : lire `commissionsEnAttente` de `/api/reseller/me` (`route.ts:83-84`), avec un statut unique et une frise.
- Effort M, impact 3.

**REV-02 — Même chiffre, deux noms ; trois formats ; tu et vous mélangés ; deux sens de « vérifié »**
- Preuve : `reseller/page.tsx:48`, `:179` et `:196` ; `payouts:111` ; `orders:142`, `:145` et `:181` ; `clients:53`.
- Effort S–M, impact 3.

**REV-03 — Bouton Partager WhatsApp en 4 versions**
- Preuve : `page.tsx:273-283`, `ProductCard.tsx:153-170`, `CarteLien.tsx:80-88`, `badge:86`.
- Effort S, impact 3.

**REV-04 — Accueil en mur de liens**
- Preuve : environ 35 cibles. Le raccourci « Boutiques » (`page.tsx:226`) mène à Fournisseurs ; doublons en `:333` et `:351` ; lien fait main en `:124`.
- Effort M, impact 3.

**REV-05 — Gains : sommes en attente sans la vente, jargon, bouton sans montant**
- Preuve : `payouts:120`, `FormulaireRetrait.tsx:249`, `HistoriqueRetraits.tsx:43`.
- Effort S–M, impact 3.

**REV-06 — Raccourcis tronqués, tuile orpheline**
- Preuve : `page.tsx:175`, `:215` et `:399-400`.
- Effort S, impact 2.

**REV-07 — Carte catalogue : boutons de 32 à 36 px, libellés ambigus, commission en double**
- Preuve : `catalog:246` et `:255` ; `ProductCard:165`, `:204`, `:228` et `:244` ; `!h-9`.
- Effort S, impact 2.

**REV-08 — `compact` non utilisé sur les petites vignettes**
- Preuve : `ProductImage.tsx:17`, `page.tsx:258` et `:310`, `orders:137`.
- Effort S, impact 2.

**REV-09 — Ventes vide sans action, recherche avant le titre**
- Preuve : `orders:43` et `:79`.
- Effort S, impact 2.

**REV-10 — Numéro du client masqué dans un écran, visible dans l'autre**
- Preuve : `clients:86` et `orders:154`. À arbitrer.
- Effort S, impact 2.

**REV-11 — Catalogue : premier produit vers 605 px**
- Effort S–M, impact 2.

**REV-12 — Outils incomplets, pages aux noms multiples**
- Preuve : `outils/page.tsx:4`.
- Effort S, impact 2.

**REV-13 — Démarrage en 8 étapes, sans première vente**
- Preuve : `demarrer/page.tsx:28`.
- Effort M, impact 3.

**REV-14 — Deux générations de pages**
- Effort M–L, impact 2.

**REV-15 — Petit et gras**
- Preuve : sur l'accueil, 24 `text-xs` pour 2 `text-base` ; `BottomNav.tsx:172` et `:215`.
- Effort M, impact 2.

**Finitions (lot S)**
- `register/page.tsx:115` et `:195-196` pour un revendeur déjà connecté.
- `boutique:157-158`.
- Tuiles à 0 sur Parrainages et Partages.
- `missions:165`.
- `calendrier:162` et `:204`.
- `badge:77` et `calculator:33`.

### Fournisseur

**FOU-01 — L'accueil ne dit pas quoi faire**
- Preuve : `supplier/page.tsx:51-65`, `:112-121` et `:126-134`.
- Effort M, impact 3.

**FOU-02 — Le colis urgent arrive en 12ᵉ position ; le compteur « À préparer » inclut les commandes à confirmer**
- Preuve : `api/supplier/commandes/route.ts:44`, `commandes/page.tsx:72-84` et `:140`.
- Effort S–M, impact 3.

**FOU-03 — La pastille écrase le titre et le montant**
- Preuve : `commandes/page.tsx:181-192` et `:255`.
- Effort S, impact 2.

**FOU-04 — Étape 1 de l'offre surchargée**
- Preuve : `products/new/page.tsx` aux lignes `:39`, `:121-123`, `:221`, `:262-419`, `:455`, `:474`, `:542` et `:587`.
- Effort M, impact 3.

**FOU-05 — Remise à zéro partielle, succès sans action principale, 0 F en prix de gros**
- Preuve : `:99`, `:124`, `:247-254`, `:252` et `:586`.
- Effort S, impact 2–3.

**FOU-06 — Inventaire : 7 commandes par ligne, un appel réseau par appui, aucun prix**
- Preuve : `inventory/page.tsx:68-91`, `:146-147` et `:164-189`.
- Effort M, impact 2.

**FOU-07 — Une erreur réseau s'affiche comme un compte vide**
- Preuve : `supplier/page.tsx:51-65`, `:103` et `:150-157` ; `commandes/page.tsx:170-171`.
- Effort S, impact 2–3.

**FOU-08 — Navigation secondaire triplée, 5 libellés de retour, « Mes commandes » qui mène aux achats**
- Preuve : `Header.tsx:223-227`.
- Effort M, impact 2.

**FOU-09 — Formulaire de retrait affiché à 0 F**
- Preuve : `paiements/page.tsx:158-168`, `FormulaireRetrait.tsx:248-253`.
- Effort S, impact 2.

**FOU-10 — Ma boutique : 4 boutons principaux, partage hors charte**
- Preuve : `CarteLien.tsx:80-88`, `boutique/page.tsx:150-164` et `:198-199`.
- Effort S–M, impact 2.

### Livreur

**LIV-01 — « Espèces dans ma sacoche » faux**
- Preuve :
  - `driver/page.tsx:57-59` additionne toutes les livraisons non Mobile Money, versements compris : 196 750 F, contre 46 850 F « à remettre » dans le portefeuille ;
  - le statut lit `paymentCollected` (`:272`), qui vaut vrai pour toutes les livraisons (voir le commentaire `:53-56`) ;
  - résultat : chaque ligne affiche « Payé en ligne ».
- Effort S, impact 3.

**LIV-02 — Livreur bloqué sans le savoir**
- Preuve : `lib/caisse-livreur.ts:102-111`, `earnings/page.tsx:105-107`, `driver/page.tsx:117-121`.
- Effort S, impact 3.

**LIV-03 — Remettre les espèces : ni lieu, ni horaires, ni procédure**
- Preuve : `earnings/page.tsx:102-146`.
- Effort M, impact 3.

**LIV-04 — Liste cassée à 390 px**
- Preuve : `driver/page.tsx:250-275`. La version correcte existe dans `earnings/page.tsx:155-163`.
- Effort S, impact 2.

**LIV-05 — Carte de course : 4 boutons de 4 styles ; aide sans course ni libellé**
- Preuve : `driver/page.tsx:170`, `:195-230` et `:223` ; `aide/page.tsx:14-19` ; `Header.tsx:191-193`.
- Effort M, impact 2–3.

### Équipe et admin

**ADM-01 — Colonne Action coupée ; montants et numéros sur deux lignes**
- Preuve : `TableauAdmin.tsx:149` ; `commandes/page.tsx:135`, `:142`, `:144` et `:151` ; `DossierCommande.tsx:40`.
- Effort S–M, impact 3.

**ADM-02 — « Confirmer » en un clic depuis le tableau, sans le parcours d'appel**
- Preuve : `commandes/page.tsx:152`. Le panneau, lui, impose ce parcours (`DossierCommande.tsx:145-156`).
- Effort S, impact 3.

**ADM-03 — 29 boutons pleins « Ouvrir » ; urgence signalée par la seule couleur ; « Choisir… » pour la Direction**
- Preuve : `a-traiter/page.tsx:24` et `:139-148`.
- Bogue : `metierDuRole` renvoie `direction` par défaut (`lib/admin/poste.ts:31`), mais la liste proposée retire cette valeur (`a-traiter/page.tsx:106`).
- Effort M, impact 3.

**ADM-04 — Pastille « succès » en vert vif**
- Preuve : `Surface.tsx:113`.
- Effort S, impact 2–3.

**ADM-05 — Approbation et retrait d'autorisation sans confirmation ni retour**
- Preuve : `validations/page.tsx:81` ; `DriverVerificationPanel.tsx:185` et `:215-220`. Le bon modèle existe déjà : `retraits/page.tsx:73-91`.
- Effort S, impact 3.

**ADM-06 — 12 formateurs de montants côté admin, 9 formats de date, saisies brutes**
- Effort S–M, impact 3.

**ADM-07 — Journal illisible**
- Preuve : `journal/page.tsx:72-78`, `validations/page.tsx:66`.
- Effort M, impact 2.

**ADM-08 — Boutons et en-têtes hors charte**
- Preuve :
  - `products/new/page.tsx:324` ;
  - `DriverVerificationPanel.tsx:209` ;
  - `ProductPricingModal.tsx:118` et `:216` ;
  - `CreateSavTicketModal.tsx:67` ;
  - `products/page.tsx:201` ;
  - `caisse:96` ;
  - `ui/EmptyState.tsx:36`.
- Effort S, impact 2.

**ADM-09 — Six états vides différents, quatre façons de charger**
- Preuve : `validations:97`, `verifications:33` et `:40`, `retraits:208` et `:228-229`, `products:222`, `Surface.tsx:130`.
- Effort S–M, impact 2.

**ADM-10 — Vue d'ensemble : chiffres sans période ni lien**
- Preuve : `page.tsx:32` et `:90`.
- Effort M, impact 2.

**ADM-11 — Menu : entrée active masquée, « Plus » à 17 entrées, libellés différents des titres**
- Preuve : `PosteAdmin.tsx:255`, `poste.ts:112` et `:127`.
- Effort S–M, impact 2.

**ADM-12 — Champ « Code du retrait » écrasé ; boutons qui débordent ; catalogue en tableau sur mobile**
- Preuve : `retraits/page.tsx:194-197`, `products/page.tsx:258`, `catalogue/page.tsx:227`, `TableauAdmin.tsx:126` et `:216-224`.
- Effort S, impact 2.

**ADM-13 — Réglages : cinq façons d'enregistrer**
- Preuve : le bon modèle est `EconomicSettingsPanel.tsx:811-826`.
- Effort M, impact 2.

**ADM-14 — Quatre styles de tuiles, deux tailles de titres**
- Effort S, impact 1–2.

**ADM-15 — Finitions de texte**
- Preuve : `modules/page.tsx:69` et `lib/admin/pilotage.ts:28-36`, `DriverVerificationPanel.tsx:153`, `products:280`, `accueil:61`, `securite:81`, `PaiementsRecus.tsx:73-89`, `PosteAdmin.tsx:228`.
- Effort S, impact 1.

## Plan proposé

Non réalisé : il attend l'accord du fondateur.

| Lot | Contenu | Effort |
|---|---|---|
| 1 · Urgences | LIV-01, LIV-04, ADM-02, ADM-05, REV-04 (lien Boutiques), REV-06, PUB-05, PUB-07, ADM-03 (Direction), ADM-12, `shadow-xs`, barre du bas à 13 px | S |
| 2 · L'argent | formateur de montants et de dates, libellés et statuts communs, `MontantInput` (REV-01/02/05, PUB-09, ADM-06) | S–M |
| 3 · Composants | `Button` avec `loading`, `BoutonPartageWhatsApp`, `ListRow`, `EmptyState` unique, pastilles retintées, colonne d'action collante (REV-03/07, FOU-03/07/10, ADM-01/04/08/09) | S–M |
| 4 · Accueils | « À faire maintenant » pour revendeur, fournisseur et livreur ; démarrage vers la première vente ; écran « Aujourd'hui » pour l'équipe (REV-04/13, FOU-01/02, LIV-02/03, ADM-10) | M |
| 5 · La commande | fiche, commande reçue, suivi, diaspora, vitrines, suivi sur ordinateur (PUB-01..04, 06, 08, 11..14) | M |
| 6 · Le fond | offre, inventaire, typographie, migration des pages anciennes, journal et menu (FOU-04/05/06, REV-14/15, ADM-07/11/13/14) | M–L |

Pour chaque lot :
- passer les tests ;
- faire des captures avant / après en 390 et 1 440 px ;
- mettre à jour `docs/guide/guide.json` (règle de `CLAUDE.md`).

Mesures à suivre, sans gain promis :
- l'entonnoir fiche → commande → paiement ;
- les partages par revendeur ;
- le délai entre « livreur en route » et le ramassage ;
- les messages WhatsApp « où est ma commande » et « où verser » ;
- les visites de la page 404.

## À garder

- **Commande sans compte.** Aides locales, bons claviers, reprise après une coupure.
- **Remise au livreur.** Code secret, QR avec saisie de secours, mention « Déjà payé, ne rien encaisser ».
- **Retraits.** Frais et montant net affichés avant de confirmer.
- **Fournisseur.**
  - Code de ramassage en grands chiffres.
  - Partage du prix : « le client paie / vous touchez / le revendeur reçoit ».
- **Équipe.**
  - Panneau latéral.
  - Bouton « Client joint : confirmer la commande ».
  - Ctrl K et compteurs du menu.
- **Composant `Button`.** Ses règles sont bien documentées.
