# Audit UX des profils Suguba — 30 septembre 2026

REQ-UX-PROFILS-001 / TASK-UX-PROFILS-001 / TEST-UX-PROFILS-001.

Audit constructif des espaces revendeur, fournisseur et livreur (« libre » interprété comme livreur). Navigation réelle dans le navigateur intégré, à partir du code actuel de la branche main, commit 5a56dc2. Mobile 390 × 844, petit écran 320 × 740, ordinateur 1440 × 1000. Captures et parcours réalisés dans cette session, avec sessions et données fictives locales. Aucun compte, message, commande, paiement ou modification de production.

## Verdict

La base visuelle est cohérente : cartes lisibles, commissions visibles, navigation mobile, rappels sur le rôle de Suguba, saisie de codes et erreurs explicites. La faiblesse principale est la hiérarchie : beaucoup d’outils sont disponibles mais l’utilisateur doit découvrir seul le chemin utile. Les libellés et les promesses diffèrent aussi entre plusieurs pages.

Le revendeur doit pouvoir choisir → partager → suivre → retirer. Le fournisseur doit pouvoir publier → préparer → remettre → encaisser. Le livreur doit pouvoir récupérer → se rendre chez le client → remettre avec code → verser les espèces. Chaque accueil devrait répondre « Que dois-je faire maintenant ? ».

## Constats prioritaires

| Priorité | Constat observé | Conséquence | Proposition | Preuves |
|---|---|---|---|---|
| P0 | Carte revendeur « Agréé », « Certifié », secteur ACI 2000, indépendamment de la vérification du compte | Confiance artificielle et localisation incorrecte | Afficher le statut réel, le quartier réel ou aucun quartier ; distinguer membre et identité vérifiée | 19–20 ; source badge confirmant les textes constants |
| P0 | QR « Scanner pour Commander » dirige vers /reseller/join?ref=… puis inscription | Le client aboutit au mauvais parcours | QR principal vers boutique ; QR de recrutement distinct, explicitement nommé | 20 et 22 |
| P0 | Simulateur : primes et gains de parrainage calculés avec constantes, montant qualifié de revenu net, témoignage « commissions le jour même » | Attentes financières incompatibles avec les délais présentés dans l’espace gains | Estimation des seules ventes livrées, hypothèses visibles ; primes conditionnées aux règles actives ; retirer témoignages non documentés et comparaison salariale non sourcée | 01, 06, 21 ; source EarningsCalculator |
| P1 | Accueil revendeur : code, retrait à zéro, indicateurs et palier avant les actions de vente | Le débutant doit beaucoup descendre avant de voir quoi partager | Action principale « Choisir un produit à partager », sélection utile immédiatement ; gains regroupés plus bas | 01 et 48 |
| P1 | Accueil fournisseur : huit raccourcis successifs avant le catalogue | Écran d’entrée long, aucune tâche priorisée | Bloc « À faire » : commandes à préparer, stock faible, offres à compléter ; deux actions principales | 23 et 47 |
| P1 | Deux pages fournisseur personnalisent la boutique et partagent des URL différentes | Difficile de savoir quelle modification sera visible où | Une page Boutique avec onglets Vitrine, Recrutement, Réglages internes ; conserver les anciennes URL publiques comme alias | 32–33 |
| P1 | Offre : nombreuses décisions, prix 30 000, stock 20 et part revendeur 3 000 déjà saisis | Publication de valeurs oubliées, charge mentale | Étapes Offre → Photos → Prix/stock → Vérification ; champs vides et exemples ; résumé avant publication | 24–25 |
| P1 | Sélection « service » conserve « Un livreur Suguba » comme choix actif | Combinaison déroutante | Montrer les modalités compatibles et demander confirmation explicite de la modalité de service | 25 |
| P1 | Navigation fournisseur mobile : mots Commandes et Paiements se touchent à 320 px ; desktop sans navigation métier persistante | Difficulté à reconnaître les destinations et changer de tâche | Libellés courts ; navigation latérale sur ordinateur | 46–49 |
| P1 | Livreur : bouton d’action utile après une carte longue ; « À recevoir maintenant » avant ramassage | Action cachée, timing d’encaissement ambigu | Course active compacte ; action selon étape ; « À encaisser chez le client » tant que le colis n’est pas remis | 40 et 45–46 |
| P1 | Plusieurs champs de l’ajout d’offre n’ont aucun label associé ; fenêtre itinéraire sans rôle dialogue visible dans le DOM | Navigation assistée moins compréhensible | Associer les labels, nommer les champs monétaires, vérifier focus et fermeture des fenêtres | 24 et 41 ; inspection DOM |
| P2 | Studio affiches, Studio marketing, Créer un visuel ; Boutique(s), Fournisseurs ; Mes commandes et Mes ventes | Terminologie et destinations difficiles à mémoriser | Vocabulaire unique et distinction achat personnel / vente revendeur | 01, 03, 07–09, 14 ; menu observé |
| P2 | Questions et devis vides expliquent mais n’offrent pas d’action directe vers une offre | Impasse douce | CTA contextualisé vers catalogue ou création d’une offre sur devis | 15, 30–31 |
| P2 | Profil vérifié du revendeur demande une entreprise « pour les fournisseurs » et renvoie au démarrage pour le quartier | Exigences du mauvais profil, répétition de la prise en main | Checklist propre au rôle, quartier éditable directement ; distinguer palier commercial et identité vérifiée | 19 |

## Réorganisation proposée

### Revendeur

Navigation mobile : Accueil, Produits, Ventes, Gains, Outils. Dans Outils : Créer un visuel, Ma boutique, Planifier, Résultats des partages. Compte et vérification dans le menu de profil. Les missions actives apparaissent en contexte ; aucune mission ne doit occuper une entrée prioritaire quand il n’y en a pas.

Catalogue : « Partager sur WhatsApp », « Enregistrer une vente », « Ajouter à ma boutique ». Une seule mention claire de la commission ; conserver prix et gain visibles. Sélection, création, partage et planification doivent former un parcours continu, conservant le produit sélectionné.

Ventes : recherche, filtres nommés simplement, historique des étapes et date prévue de déblocage. Le gain potentiel ne doit pas être présenté comme déjà disponible.

Gains : tableau des commissions en attente avec date et raison, retraits en cours, historique. Tant que le seuil n’est pas atteint, remplacer le formulaire dominant par une explication actionable et un retour aux ventes/produits.

Fusionner Boutiques fournisseurs et Fournisseurs en une découverte unique. Réunir calendrier et résultats dans le Studio, tout en conservant leurs liens existants. Intégrer la gestion des prix dans les produits concernés. La carte revendeur devient un format du Studio après correction de sa confiance et de sa destination.

### Fournisseur

Navigation : Accueil, Produits, Commandes, Paiements, Plus. « Ajouter une offre » reste une action dans Produits/Accueil. Sur ordinateur : navigation latérale avec Boutique, Réseau, Promotion et Équipe.

Produits réunit catalogue, stocks, photos, variantes et modification de prix. Ajouter recherche et filtres de stock/statut, quantité saisissable directement, confirmation explicite de l’enregistrement et état d’attente.

Commandes : prioriser les colis à préparer ; détail avec quantité, préparation, heure de ramassage prévue et code fournisseur protégé. Devis et questions restent utiles, avec compteurs des réponses attendues.

Boutique : réunir les deux configurations existantes, aperçu visiteur, indication précise des informations publiques et internes. Le texte proposant que des clients « vous trouvent » via le quartier doit être clarifié pour préserver les transactions pilotées par Suguba ; l’exposition publique de coordonnées n’a pas été validée dans cette simulation.

Promotion : distinguer visibilité sponsorisée et mission rémunérée. Avant engagement : budget total, objectif, règles de preuve, durée, validation, remboursement/report et résultat attendu sans garantie de vente. Les campagnes doivent montrer clairement que le budget est préfinancé, puis consommé selon les objectifs validés.

### Livreur

Conserver deux destinations simples : Courses et Portefeuille. Retirer la recherche catalogue de cet espace au profit d’aide métier. Course active avec client/quartier/repère, étape, montant, et une action principale. Le ramassage devient replié après confirmation.

Ajouter « Signaler un problème » : fournisseur indisponible, client absent, refus, produit endommagé, code indisponible. L’admin reste responsable de l’affectation, de la résolution et des changements de statut sensibles.

Portefeuille : distinguer espèces collectées, rémunération, net à remettre, versements confirmés et reçus. Ajouter historique de caisse et prochaine remise. Ne pas se contenter d’un lien WhatsApp pour prouver le versement.

## Fonctions à conserver, réduire et ajouter

Conserver les commissions par produit, l’encaissement Suguba, la double preuve fournisseur/client, la confidentialité documentaire, les retraits et les accès d’équipe. Aucune suppression définitive proposée sans données d’usage.

Réduire : liens en double, code affilié dominant l’accueil, simulateur promotionnel dans l’espace de travail, multiples pages boutique, options avancées montrées à tous, reçus imprimables en action principale livreur.

Ajouts utiles : favoris et reprise du dernier produit, textes de partage modifiables prêts à l’emploi, rappel depuis un visuel, liste des ventes nécessitant une action, duplication d’une offre fournisseur, stock éditable par quantité, brouillon récupérable, signalement de problème livreur, historique des remises de caisse. Vérifier par entretiens et données d’usage avant investissement important.

## Accessibilité et chargements

Points positifs : formulaire Nouvelle vente nommé comme dialogue ; radio-groupes expliqués ; code fournisseur et code client distincts ; erreur de livraison annoncée comme alerte, sans faux succès ; états de chargement de montants signalés ; cartes avec icône et texte pour les états.

Confirmé : champs Nom, Description et plusieurs montants de création fournisseur sans label associé dans le DOM. Navigation fournisseur comprimée à 320 px. Fenêtre itinéraire observée sans rôle dialogue. Titres parfois sautés vers h4 pour un produit dans une page h1/h2.

À tester séparément : VoiceOver/TalkBack complet, pièges de focus, contrastes mesurés, zoom 200 %, caméra QR et clavier numérique sur appareil réel. Aucune certification WCAG.

Chargement : observer le feedback immédiat, conserver les données précédentes, annoncer le rafraîchissement et signaler l’échec sans mettre les gains à zéro. Éviter une collection de logos qui pulsent dans chaque case ; un indicateur par opération suffit. Les durées du serveur de développement ne constituent pas une mesure de vitesse de production. Aucun test réseau mobile Mali ni benchmark Core Web Vitals n’a été fait dans cet audit. La console a signalé trois erreurs de réconciliation serveur/client sur l’accueil revendeur lors du passage du squelette produit aux données locales. Cela peut provoquer une reconstruction et du mouvement visuel ; reproduire avec une compilation de production avant de conclure sur le site en ligne.

## Limites de la simulation

Les produits, comptes et commandes sont fictifs ; le logo servant d’image de test n’est pas un défaut des photos réelles. L’outil de développement visible en bas n’appartient pas à la production. Démarrage : première étape et erreur de sauvegarde fictive testées, étapes suivantes non validées. OTP : échec de connexion simulée observé, ni livraison réussie ni vrai code incorrect vérifiés. Sponsorisation : packs absents dans la fixture, seul l’état indisponible est inspecté ; aucune conclusion sur sa disponibilité en production. Devis, missions, clients, équipe et résultats marketing sont principalement testés à vide. Pas d’envoi WhatsApp, pas de paiement, pas d’invitation réelle, pas de caméra, de géolocalisation ou de guidage externe. La vitrine fournisseur a rendu 404 dans la fixture et reste à contrôler avec des données complètes ; ce n’est pas une panne de production démontrée.

## Ordre d’implémentation et acceptation

1. TASK-UX-PROFILS-002 : carte, QR, textes financiers et statut réel. TEST : compte non vérifié n’affiche pas certification ; QR boutique ouvre la bonne vitrine ; estimation annonce ses hypothèses et aucun bonus non configuré.
2. TASK-UX-PROFILS-003 : navigation et accueil par rôle. TEST : tâche principale visible à 390 px ; aucune collision de libellés à 320 px ; navigation métier accessible sur ordinateur ; aucun doublon de destination sous des noms différents.
3. TASK-UX-PROFILS-004 : création fournisseur en étapes, boutique unique et produits/stocks. TEST : aucune valeur métier fictive présaisie ; chaque champ a un label ; modification conservée entre étapes ; aperçu avant publication ; anciennes URL encore utilisables.
4. TASK-UX-PROFILS-005 : course active, incidents et caisse. TEST : montant correctement nommé avant ramassage ; étape suivante unique ; incident remonte à l’admin ; remise financière reconnue uniquement après confirmation serveur.
5. TASK-UX-PROFILS-006 : studio intégré et résultats. TEST : produit conservé de catalogue vers création/partage/planification ; résultat visible et annoncé ; rappel distingué de publication automatique ; commissions distinguées du CA.

Le journal numéroté et toutes les captures du parcours sont dans le dossier audit-local/2026-09-30-profils et son rapport visuel. L’audit ne change pas le produit en production.
