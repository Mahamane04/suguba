# Commandes fiables — REQ-013 / TASK-017

Implémentation locale du 11 septembre 2026. **Non déployée.**

## Vérification reproductible

`npm test` exécute `tests/order-creation.test.cjs` avec Node et PGlite en mémoire.
Le moteur de prix, les routes Next.js, le contrôleur du formulaire, le store et la
fonction SQL sont ceux du projet. Le transport Supabase est remplacé par un adaptateur
qui exécute réellement les lectures et transactions SQL dans PostgreSQL local.
Les clés `.env.local` ne sont pas chargées et aucun paiement/SMS réel n'est lancé.

Le schéma de base est exécuté jusqu'à la section Realtime ; ni les publications
Supabase ni les produits de démonstration ne sont nécessaires. Les migrations de
tarification, part revendeur, délai de commission et création atomique sont exécutées.

| Tests | Ce qui est vérifié |
| --- | --- |
| TEST-013 | Prix, commission et statut issus du serveur ; données monétaires/OTP/identité forgées ignorées ; commission `pending` enregistrée ; reçu sans coûts internes. |
| TEST-014 | Deux appels avec une même clé donnent une seule commande ; après réponse perdue, le même reçu reste accessible même si le produit a changé ; autre contenu refusé. |
| TEST-015 | Échec volontaire de commission : aucune commande, commission ou clé partiellement enregistrée ; nouvelle tentative possible ; vente directe sans commission ; erreurs de lecture et RPC visibles. |
| TEST-016 | Quantités, coordonnées, clé de reprise et code revendeur contrôlés ; article à prix nul refusé. |
| TEST-017 | RLS et privilèges RPC ; refus d'INSERT public ; service_role autorisé ; migration réexécutable ; changement du produit détecté dans la transaction. |
| TEST-018 | Routes HTTP, JSON invalide, absence de base, cache désactivé ; store inchangé avant succès ; réponse perdue récupérée ; HTTP 200 sans reçu refusé. |
| TEST-019 | Double clic sur le contrôleur = un appel ; clé conservée après rechargement ; reprise explicite si champs changés ; stockage corrompu/bloqué ; refus définitif réinitialisant la tentative. |
| TEST-020 | Rendu React de la page de confirmation : un numéro absent ne montre jamais le reçu d'une autre commande. |
| TEST-021 | Devis et reçu concordants avec ville, promo et code revendeur en minuscules ; erreurs de base sans prix de repli. |

Résultat local : **19 tests réussis**, aucune assertion ignorée. Les lignes de journal
`P0001` et `TEST_FAILURE` sont les pannes volontairement injectées par les tests.
`npm run build` est la validation complémentaire obligatoire avant déploiement.

## Limites et mise en service

- PGlite utilise une seule connexion PostgreSQL. Les appels applicatifs concurrents
  sont testés, mais pas la contention de verrous entre plusieurs processus PostgreSQL.
- Les trois formulaires utilisent le même contrôleur. Les tests du contrôleur et du
  store ne remplacent pas un essai tactile Android/iPhone et une coupure réseau réelle.
- Le montant est recalculé lors de la création ; cette version ne réserve pas un devis
  affiché contre un changement de prix/réglages intervenu avant l'envoi du formulaire.
- Le délai de commission, la validation effective de livraison et les versements ne
  sont pas couverts par ce lot : il sécurise la création et la commission initiale.
- La clé de reprise vit dans l'onglet. Après fermeture/effacement du stockage, utiliser
  le suivi numéro + téléphone ; ne pas prétendre dédupliquer toute nouvelle commande
  passée volontairement dans un autre onglet.
- Appliquer `supabase/migration-order-creation.sql` sur Supabase avant de déployer le
  code. La migration locale n'a pas été appliquée sur la base de production.
- Ne pas republier seulement le serveur en gardant les anciens formulaires : la
  création a été déplacée de `/api/orders/sync` vers `/api/orders/create`. Recharger
  les anciens onglets après déploiement.

Les anciens exemples de `scripts/verify-invariants.js` sont accessibles par
`npm run test:legacy` ; ils ne constituent pas une preuve du fonctionnement réel.
