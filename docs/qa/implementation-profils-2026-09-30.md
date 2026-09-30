# Implémentation de l’audit profils — 30 septembre 2026

REQ-UX-PROFILS-001 : faciliter les parcours revendeur, fournisseur et livreur, sans changer les règles de transaction Suguba.

## Livré dans ce lot

- TASK-UX-PROFILS-002 : carte revendeur reliée à la boutique réelle ; quartier réel ; aucune certification sans badge validé. Simulation limitée aux ventes livrées, hypothèses explicites ; retrait des primes, comparaisons salariales et témoignages sans preuve.
- TASK-UX-PROFILS-003 : navigation métier visible sur mobile et desktop ; Outils revendeur et Plus fournisseur ; action de partage avant les indicateurs du revendeur ; deux actions principales fournisseur. Aide livreur remplace la recherche générale. Le menu mobile fournisseur nomme les commandes « Colis » pour garder des libellés lisibles à 320 px.
- TASK-UX-PROFILS-004 : formulaire Offre → Photos → Prix/stock → Vérification ; champs prix, stock et commission vides ; brouillon de session conservé ; libellés associés ; retour aux étapes et aperçu avant publication. Service sans remise par un livreur. Gestion des produits : recherche, filtres, quantité directe à confirmer. Liens explicites entre boutique et réglages historiques, sans supprimer les anciens liens publics.
- TASK-UX-PROFILS-005 : ramassage confirmé replié ; montant « À encaisser chez le client » ; itinéraire avec dialogue accessible, boucle de focus et Échap ; incidents enregistrés côté serveur dans le SAV existant, uniquement sur une course active attribuée au livreur. Aucun mouvement financier ni validation de livraison par ce signalement. Historique de caisse et reçus déjà présents conservés. Un incident est présenté comme tel dans le SAV ; dispatch d’échange interdit côté serveur, décision consignée avant clôture.
- TASK-UX-PROFILS-006 : fournisseurs regroupés, ancienne route channels redirigée ; lien de catalogue attribué au revendeur ; studio accepte un produit en paramètre ; recherche et tri des ventes ; checklist sans entreprise pour le revendeur ; quartier modifiable directement avec enregistrement serveur.

Aucune nouvelle table ni migration : réutilisation des APIs et du SAV existants. L’incident logistique conserve une valeur technique `repair` imposée par le schéma historique ; l’admin affiche explicitement « Incident de course — décision équipe ». Aucune réparation, échange ou remboursement n’est déclenché automatiquement.

## Validation

- TEST-UX-PROFILS-VERIFICATION : checklist revendeur complète sans entreprise ; documents pending ne comptent pas.
- TEST-UX-PROFILS-INCIDENT : session, attribution et course active obligatoires ; absence d’écriture financière ; succès uniquement après écriture SAV ; panne réessayable.
- Suite complète : 393 tests réussis. Vérification TypeScript réussie.
- Compilation `npm run build` avec environnement fictif : réussie. Avertissement préexistant de dépendance du hook Toast.
- Parcours navigateur local : Offre/service → Photos → montants vides → récapitulatif ; brouillon conservé après rechargement ; QR boutique réel et carte sans certification inventée.
- Navigation testée à 320 px et 1440 px, sans débordement horizontal ; aucun message console d’erreur sur le parcours final. Incident fictif visible côté admin, décision proposée sans message d’échange.
- Captures dans `audit-local/2026-09-30-profils/implementation-*.jpg`.

## Recommandations qui demandent un lot supplémentaire

La suite ci-dessous unifie l’identité publique dans stores et conserve les données privées du dépôt dans suppliers ; les anciennes colonnes sont gardées pour compatibilité, sans migration destructive. La modification du prix des offres existantes, la duplication d’offre, les favoris et les améliorations avancées des campagnes et du planning restent à cadrer. Le délai de libération d’une commission ne doit pas être déduit dans le navigateur : le lot conserve les données de Gains fournies par le serveur.

Statut : modifications locales, non déployées.

## Suite locale — identité fournisseur, planning et erreurs

- TASK-UX-PROFILS-007 : Ma boutique regroupe identité publique, recrutement et dépôt privé. L’ancienne route ambassadors redirige vers le dépôt. L’identité canonique est lue depuis stores aussi sur /s/<ancienne-adresse> ; aucun slug existant n’est modifié. Une boutique créée à partir d’un ancien compte reprend son nom, logo et présentation. Pour une boutique déjà existante, une reprise manuelle dans le formulaire est proposée sans écrasement automatique. Supprimer un logo ne réaffiche pas l’ancien. Les anciens clients de l’API me écrivent leur identité dans stores ; les coordonnées restent dans suppliers et ne sont jamais copiées dans la vitrine.
- TASK-UX-PROFILS-008 : calendrier de publications manuelles, actions distinctes Préparer le partage / J’ai publié. Aucun statut changé lors de l’ouverture du partage. Succès seulement après confirmation de la base et propriétaire vérifié ; dates impossibles refusées. Erreurs de chargement réessayables. Recrutement et galerie sont enregistrés indépendamment des autres champs de boutique, avec état confirmé par le serveur.
- TASK-UX-PROFILS-009 : Gains ne transforme plus un échec de lecture en solde à zéro ; retrait masqué si le solde est inconnu. Erreur d’historique distincte d’un historique réellement vide.

Tests ajoutés : TEST-UX-PROFILS-IDENTITE, IDENTITE-API et CALENDRIER (5 tests) : identité canonique, logo effacé, confidentialité, ancien client, permissions, refus d’écriture, propriétaire des rappels, dates et confirmation de création. Suite complète : 396 tests réussis avant les deux derniers tests API, puis 9 tests ciblés réussis (5 nouveaux et guide). TypeScript et build final réussis. Deux avertissements de hooks existants (Toast et guide) restent présents, aucun échec de compilation.

Navigateur local avec fixtures uniquement : redirection ambassadors → boutique#depot ; recrutement inchangé après refus d’écriture ; rappel toujours planifié après refus ; calendrier sans débordement à 390 px et rendu desktop 1440 px ; solde indisponible affiché sans formulaire de retrait. Aucun partage externe effectué. Captures : suite-fournisseur-mobile.png, suite-calendrier-mobile.png, suite-calendrier-desktop.png et suite-gains-erreur-desktop.png dans audit-local/2026-09-30-profils.

Pas de migration nécessaire pour ces changements ; aucune donnée de production modifiée et aucun déploiement. Duplication d’offres, modification du prix fournisseur, favoris et campagnes avancées restent hors de cette suite et ne sont pas annoncés comme réalisés.

## Finalisation des corrections locales

- TASK-UX-PROFILS-010 : inventaire avec modification d’offre, photos et duplication. Copie créée exclusivement depuis l’offre du fournisseur connecté, nouvel identifiant/adresse, stock zéro, statut draft et prix publics zéro. Descriptif, modalités de service, devis et unité de vente conservés. Les offres retirées ne peuvent pas contourner l’admin par duplication ou publication. Ajouter des photos à une copie ne la publie pas. Édition limitée au descriptif, stock et part revendeur ; coût fournisseur lu côté serveur, aucun montant public accepté. Une part modifiée déclenche la tarification serveur ; les anciennes commandes et adresses restent intactes. Conflicts de statut renvoyés explicitement ; aucune annonce de publication si aucune ligne n’a été effectivement publiée.
- TASK-UX-PROFILS-011 : Catalogue → Créer un visuel → Planifier conserve le produit. Libellé Créer un visuel harmonisé. Questions vides renvoient au catalogue ; devis vides proposent une offre préconfigurée sur devis. Campagnes expliquent objectifs rémunérés, préfinancement, récompenses versées/en validation et absence de garantie de vente ; distinction avec sponsorisation. Échecs de chargement de l’inventaire et des campagnes réessayables.
- TASK-UX-PROFILS-012 : commissions pending/locked et dates originales du grand-livre visibles dans Gains ; réservations de retraits séparées du disponible. Sous le minimum, retour utile aux produits plutôt qu’un formulaire de retrait dominant. Aucune disponibilité déduite de la date dans le navigateur.
- TASK-UX-PROFILS-013 : boutique secondaire active garde son identité et sa disponibilité même si la principale est fermée. Ancienne vitrine suit la principale sans exposer le dépôt ; aucun WhatsApp fournisseur dans la sérialisation des boutiques.

Validation finale : suite complète 407 tests réussis avant les deux derniers tests de régression (WhatsApp et publication concurrente), puis 14 tests ciblés réussis sur le code final (offres, vitrines, publication, guide). Build final et TypeScript réussis ; deux avertissements de hooks déjà présents (Toast/guide), aucun échec. git diff --check réussi. Les tests de montants et de retraits existants sont conservés.

Essais navigateur en local, données fictives : duplication → copie hors vente et stock zéro → édition nom/stock/part → publication à 26 500 F avec part revendeur 4 000 F, coût serveur 20 000 F ; l’offre source est inchangée. Catalogue → génération d’affiche avec résultat focalisé → calendrier prérempli avec le même produit. Inventaire/édition sans débordement à 390 px ; nouvelles et anciennes vitrines accessibles à 1440 px, avec même identité et sans coordonnées du dépôt. Aucun envoi externe, paiement ou modification de production.

Captures : fin-copie-mobile.png, fin-offre-enregistree-mobile.png, fin-visuel-calendrier-mobile.png, fin-vitrine-fournisseur-desktop.png dans audit-local/2026-09-30-profils.

Le périmètre de correction de l’audit est terminé localement. Les propositions exploratoires (favoris, campagnes nouvelles, automatisations supplémentaires) restent des évolutions produit, pas des bugs corrigés ni des fonctions annoncées comme livrées. Le coût fournisseur reste en lecture seule dans l’éditeur : seule la part revendeur est acceptée comme montant, conformément à AGENTS.md. Les performances réseau Mali et l’accessibilité sur appareil réel restent à mesurer ; aucune promesse d’instantanéité ni certification WCAG. Aucun déploiement effectué. Pas de nouvelle migration : seules les tables et colonnes déjà présentes sont utilisées.
