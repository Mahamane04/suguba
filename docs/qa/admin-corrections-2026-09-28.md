# Corrections de l’administration — validation locale du 28 septembre 2026

Périmètre : défauts confirmés par l’audit local des 37 pages, avec priorité à l’ordinateur puis au téléphone. Référence initiale : commit `c98ab3d`, rapport `audit-local/2026-09-27-admin/rapport.md`. Les corrections sont dans le répertoire de travail, sans déploiement ni nouvelle migration.

## Changements réalisés

| Exigence / tâche | Correction | Validation |
|---|---|---|
| REQ-AUD-001 / TASK-AUD-001 | Une panne des vérifications remonte une erreur avec reprise. Les compteurs incomplets deviennent inconnus. | TEST-AUD-101 ; panne HTTP fictive et contrôle navigateur. |
| REQ-AUD-002 / TASK-AUD-002 | Examen en dossier, appel accessible, pièce privée obligatoire pour les types documentaires, constat obligatoire, refus motivé, historique avec auteur/date. Décision conditionnée à l’état encore en attente. | TEST-AUD-102 ; refus fictif enregistré et retrouvé dans l’historique. |
| REQ-AUD-003 / TASK-AUD-003 | Agrégats financiers côté serveur, coût historique, livraison gratuite conservée à zéro, pertes visibles et coûts manquants signalés. Marge commerciale distinguée du bénéfice net et des encaissements. | TEST-AUD-103 ; aucune lecture du prix fournisseur actuel pour l’historique. |
| REQ-AUD-004 / TASK-AUD-004 | Dates de création et de livraison séparées. Le rapport journalier utilise la période UTC de Bamako ; l’arriéré reste explicitement toutes dates. | TEST-AUD-104 ; le 28/09, commande du 24 exclue du jour mais présente dans l’arriéré. |
| REQ-AUD-005 / TASK-AUD-005 | Commissions disponibles/verrouillées issues du grand-livre serveur ; reprise après action, historique des retraits payés/refusés. | TEST-AUD-105 ; contrôles de lecture, sans transfert d’argent. |
| REQ-AUD-006 / TASK-AUD-006 | Choix d’un fournisseur existant ou du stock Suguba. Identifiant transmis et vérifié ; nom canonique résolu côté serveur. | TEST-AUD-106 : sélection locale et contrôle HTTP de la liste des fournisseurs. |
| REQ-AUD-007 / TASK-AUD-007 | Défilement horizontal contenu dans les tableaux ; menu mobile avec Échap, focus capturé et restitué ; labels de saisie. | TEST-AUD-107 : contrôles navigateur à 1280 et 390 px ; reprise ciblée à 768 px. |
| REQ-AUD-008 / TASK-AUD-008 | Six rubriques, sections secondaires repliées, filtres de métier regroupés, libellés métier. Permissions conservées. | TEST-AUD-108 : tests de navigation et de permissions existants. |
| REQ-AUD-009 / TASK-AUD-009 | Une entrée principale Catalogue, accès explicites aux vues tableau et cartes. | Partiel : les moteurs de filtre/sélection des deux vues ne sont pas fusionnés. Cela reste une évolution UX, pas une correction prétendument terminée. |
| REQ-AUD-010 / TASK-AUD-010 | Cinq sections de paramètres, un brouillon commun, simulation intégrée, validation numérique, fusion des seuls champs modifiés, conflits refusés. | TEST-AUD-110 : test de fusion et parcours HTTP avec deux brouillons concurrents. |

Autres corrections : actualisation des livreurs actifs après examen au guichet ; intitulé du paiement en espèces ; détails lisibles des approbations financières ; filtre métier du journal ; recherche Commandes sans résultat avec remise à zéro ; outils locaux avancés repliés ; indication explicite des seuils de sécurité désactivés.

## Paramètres et commissions : comportements vérifiés

- Modification du taux dans Commission, passage dans Paiement, retour : brouillon conservé.
- Saisie non numérique : champ invalide, changement de section et enregistrement bloqués jusqu’à correction.
- Base indisponible : erreur visible, brouillon conservé, aucun succès annoncé.
- Enregistrement fictif réussi : valeurs relues et commission du produit actualisée.
- Échec simulé du recalcul : la sauvegarde est distinguée du recalcul ; bouton de reprise ; aucune commission « avant » inventée pour les produits non actualisés.
- Reprise : le catalogue fictif est actualisé et la confirmation revient.
- Sauvegardes concurrentes sur des champs distincts : fusion ; sur le même champ : conflit 409. Les anciens formulaires sans référence doivent recharger.
- Le recalcul parcourt le catalogue par lots au lieu de subir silencieusement la limite de lecture par défaut. Un échec ou un volume dépassant la garde de 100 000 produits reste explicitement signalé.
- L’aperçu d’impact est limité et annoncé à 300 produits ; il ne prétend pas couvrir tout le catalogue.

La sauvegarde des réglages et les actualisations des produits restent plusieurs opérations de base. La reprise gère une interruption ; ce n’est pas une nouvelle transaction SQL atomique. Les commandes existantes conservent leurs montants historiques et les nouvelles commandes restent calculées côté serveur.

## Résultats de validation

- `npm test` : **389 réussis, 0 échec, 0 ignoré** (dont 7 nouvelles régressions de cet audit).
- `npm run build` : **réussi** sur la version finale. Avertissement préexistant de dépendance React dans `Toast.tsx:112`, sans échec de compilation.
- `test-api.cjs` : **7 scénarios HTTP réussis** contre l’application compilée et le serveur fictif, dont refus sans session, date impossible et conflits de brouillons.
- `git diff --check` : réussi.
- Navigateur : paramètres et sauvegardes, vérifications et historique, erreurs de lecture, rapport du jour, choix du fournisseur, historique des retraits, commandes à 1280/768/390 px, menu mobile au clavier. Ces parcours sont ciblés ; il ne s’agit pas d’une seconde certification exhaustive des 37 pages.
- Aucun débordement de page Commandes aux trois largeurs contrôlées. À 390 px, la section Commission comporte 23 inputs et environ 3873 px de contenu dans le jeu fictif, contre 122 inputs et environ 15115 px pour l’ancienne page complète.

## Preuves et reproductibilité

Dossier local : `audit-local/2026-09-28-corrections/` : captures, fixture et scénario `test-api.cjs`. Données inventées, serveur Next compilé sur 127.0.0.1:4310, adaptateur fictif sur 127.0.0.1:45999. Le lanceur neutralise les variables `.env` puis définit uniquement les paramètres locaux. Aucune identité réelle, aucun paiement ni envoi externe testé.

Les suites de tests couvrent aussi les invariants existants de prix, permissions, commandes, caisse et retraits. Les tests ne constituent pas une garantie d’absence de tout bug. Les captures ne constituent pas un test des vrais prestataires, du stockage privé ou de la volumétrie de production.

## Évolutions de l’audit qui restent distinctes de ces corrections

Le dossier personne unifié, la fusion complète des vues du catalogue, la mesure d’usage des modules et une suppression fonctionnelle éventuelle demandent un lot produit séparé. Aucune fonctionnalité métier ou donnée existante n’a été supprimée à partir du seul fait qu’elle paraissait vide dans le jeu fictif.
