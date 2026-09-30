# Analyse du parcours livreur, du studio marketing et de la vitesse perçue

Date : 30 septembre 2026  
Périmètre : application locale actuelle, écran mobile 390 × 844, données entièrement fictives.  
Traçabilité livrée : REQ-DRIVER-UX-001 / TASK-DRIVER-UX-001 / TEST-DRIVER-UX-001 ; REQ-CONTENU-001 / TASK-CONTENU-001 / TEST-CONTENU-001 ; REQ-PERF-001 / TASK-PERF-001 / TEST-PERF-001.

## État d'implémentation

Les premiers lots de l'audit sont implémentés le 30 septembre 2026 :

- **TASK-DRIVER-UX-001** : argent de la course renommé sans ambiguïté, message WhatsApp normalisé autour du « code de remise », montants formatés, erreur de connexion distincte, succès appliqué immédiatement dans l'état local après confirmation serveur.
- **TASK-CONTENU-001** : studio unique avec choix explicite « Un produit » ou « Ma boutique », identité de boutique intégrée à l'affiche produit, carte boutique avec couverture, logo, produits et QR direct, anciennes routes redirigées vers `/reseller/createur`.
- **TASK-PERF-001** : fenêtres livreur chargées à la demande, petites images correctement dimensionnées, squelettes de transition globaux et par portail. Le build mesure désormais `/driver` à environ 212 Ko de premier chargement, contre environ 260 Ko pendant l'audit.

Validation : **TEST-DRIVER-UX-001** et **TEST-CONTENU-001** ont été simulés localement avec données fictives, en vue desktop puis mobile 390 × 844 ; la carte boutique a été réellement générée dans le navigateur. **TEST-PERF-001** : `npm run build` réussi et 389 tests automatisés réussis. Aucune donnée réelle, aucun paiement et aucun message externe n'ont été utilisés.

## Verdict

Le parcours livreur est fonctionnel et protège correctement les étapes sensibles : code du fournisseur avant le départ, code du client avant la remise et distinction entre paiement déjà effectué et espèces à encaisser. Il reste cependant trop dense sur un téléphone et présente deux ambiguïtés opérationnelles : le montant affiché dans plusieurs contextes et le message après échec du code client.

Le créateur de contenu existe déjà et sait produire une affiche produit avec photo, prix, promotion, QR code, thème et lien tracké. La principale opportunité n'est donc pas de créer un second outil, mais d'unifier les deux écrans actuels (`/reseller/marketing` et `/reseller/createur`) puis d'ajouter l'identité de la boutique et un modèle de partage de boutique.

Les transitions chaudes Courses → Portefeuille ont été mesurées localement à 119 ms puis 62 ms. La base Next.js est donc capable de donner une sensation instantanée. Les faiblesses concernent surtout le premier chargement et l'absence de réaction visuelle immédiate : aucun `loading.tsx`, un layout global client relativement lourd, et plusieurs requêtes client déclenchées après hydratation.

## Simulation du parcours livreur

### 1. Ramassage chez le fournisseur — état : utilisable, à simplifier

Preuve : `audit-local/2026-09-30-livreur/00-ramassage-fournisseur.jpg`.

- Le lieu, l'appel, l'itinéraire et le code fournisseur sont regroupés dans la première étape.
- La remise client est correctement bloquée tant que le colis n'est pas récupéré.
- La carte contient déjà beaucoup d'informations ; la barre fixe masque temporairement une partie du formulaire pendant le défilement.
- Recommandation : afficher un seul objectif principal, « Récupérer le colis », avec les actions secondaires sous un menu léger. Une fois le code validé, remplacer ce bloc par une confirmation compacte.

### 2. Course active — état : clair, mais trop chargé

Preuve : `audit-local/2026-09-30-livreur/01-tableau-de-bord.jpg`.

- La progression « récupéré → livrer » est compréhensible.
- Le montant à encaisser est visible avant le déplacement.
- Le KPI « Encaissé à la livraison : 0 F » peut être confondu avec les 41 500 F de la course en cours. Le premier représente l'historique, le second la prochaine action.
- Recommandation : remplacer le KPI supérieur par « Espèces dans ma sacoche » et afficher sur la course un bloc explicite « À recevoir maintenant du client ».

### 3. Itinéraire et contact — état : bon

Preuve : `audit-local/2026-09-30-livreur/02-itineraire.jpg`.

- Google Maps, Waze, appel et WhatsApp sont disponibles sans chercher.
- Le quartier, le repère, le client et le montant sont visibles avant de quitter Suguba.
- Le message WhatsApp utilise encore le terme « Code Secret OTP », alors que l'interface parle de « code client » ou « code de remise ».
- Le montant perd parfois son séparateur de milliers (`41500 F`), ce qui réduit la lecture rapide en déplacement.
- Recommandation : employer partout « code de remise », formater `41 500 F`, et faire de Google Maps l'action principale selon les usages locaux tout en gardant Waze en second choix.

### 4. Remise du colis — état : sûr et bien guidé

Preuve : `audit-local/2026-09-30-livreur/03-code-client.jpg`.

- QR ou saisie manuelle : bon choix pour les téléphones et réseaux variables.
- Le montant à encaisser reste visible au moment critique.
- Le bouton est désactivé tant que le code n'est pas complet.
- Recommandation : après succès serveur, afficher immédiatement un écran de confirmation avec « Livraison terminée », montant encaissé et lien vers le reçu, puis synchroniser la liste en arrière-plan.

### 5. Code refusé — état : message à corriger en priorité

Preuve : `audit-local/2026-09-30-livreur/04-code-erreur.jpg`.

- L'erreur est visible et le formulaire reste accessible.
- « Livraison non confirmée. Réessayez avec le même code » est ambigu : si le code est faux, répéter le même code ne résout rien ; si le réseau a échoué, le message doit le dire.
- Recommandation : distinguer trois réponses : « Code incorrect — vérifiez le reçu du client », « Trop de tentatives — contactez Suguba » et « Connexion interrompue — réessayez avec le même code ».

### 6. Portefeuille — état : lisible, mais déconnecté de la course

Preuve : `audit-local/2026-09-30-livreur/05-portefeuille.jpg`.

- Les trois notions sont séparées : livraisons, espèces à remettre, rémunération.
- Le texte explique correctement que le livreur garde sa rémunération lorsque le réglage le permet.
- Un livreur devrait voir le prochain geste attendu, par exemple « Rien à remettre » ou « Versez 30 000 F avant vendredi », et l'historique des reçus devrait être accessible même quand aucun solde n'est dû.

## Proposition pour le parcours livreur

### Priorité 1 — fiabilité opérationnelle

1. Uniformiser les termes et formats : `code fournisseur`, `code de remise`, montants avec espace de milliers.
2. Séparer les erreurs de code, de verrouillage et de réseau.
3. Confirmer immédiatement une livraison réussie sans attendre le rechargement complet du flux.
4. Conserver le calcul et la validation côté serveur ; aucune somme ne doit venir du navigateur.

### Priorité 2 — mode « une course, une action »

- En tête : prochaine action, lieu, délai éventuel et montant.
- Carte active : une seule action primaire selon l'état (`Aller au fournisseur`, `Valider le ramassage`, `Aller chez le client`, `Valider la remise`).
- Les actions appel, message, reçu et autre GPS passent dans une rangée secondaire.
- Une liste repliée montre les courses suivantes sans mélanger leurs actions.

### Priorité 3 — conditions réelles à Bamako

- Garder les données de la dernière course visibles pendant une coupure, mais marquées « dernière mise à jour à… ».
- Ne jamais permettre une remise hors ligne : le code doit rester validé par le serveur.
- Précharger les cartes d'interface et les icônes, sans mettre en cache les coordonnées clients ni les API privées.

## Studio de création marketing

### Ce qui existe déjà

- `/reseller/marketing` : sélection rapide d'un produit, affiche simple et conseils.
- `/reseller/createur` : produit, format story/carré, trois thèmes, bandeau promotionnel, QR code, lien tracké, téléchargement et partage.
- `src/lib/affiche.ts` : génération locale 1080 × 1920 ou 1080 × 1080 ; aucune photo n'est envoyée à un service tiers.
- Les boutiques possèdent déjà les éléments nécessaires : logo, couverture, nom, accroche, produits et lien de partage.

Le problème actuel est la duplication : la navigation principale ouvre le petit outil `/reseller/marketing`, tandis que le créateur plus complet vit sur une autre route. Les utilisateurs risquent de ne jamais découvrir le meilleur outil.

### Studio unique proposé

Un seul écran « Créer du contenu », organisé par objectif :

1. **Mettre un produit en avant** — photo produit, prix, bénéfice court, logo de la boutique, signature Suguba, QR/lien tracké.
2. **Partager ma boutique** — couverture en miniature, logo ou photo de profil, nom, accroche, 3 produits vedettes et QR vers la boutique.
3. **Créer un pack de campagne** — génère en une action une story, une publication carrée et le texte WhatsApp correspondant.
4. **Préparer une vidéo courte** — script de 15 à 30 secondes fondé sur les vraies informations du produit ; les fonctions vidéo avancées viendront après mesure de l'usage.

### Modèles prioritaires

#### Modèle produit avec marque boutique

- Grande photo du produit.
- Prix et bénéfice principal lisibles en moins d'une seconde.
- Logo de la boutique dans un cartouche blanc, limité en taille pour conserver la confiance Suguba.
- Mention « Commandez sur Suguba » et QR/lien tracké.
- Aucun téléphone ou adresse fournisseur.

#### Carte de boutique

- Couverture au format miniature panoramique.
- Logo ou photo de profil au premier plan.
- Nom, accroche et trois produits vedettes.
- QR vers `/r/<code>` ou la boutique réseau correspondante.
- Formats : statut 1080 × 1920, carré 1080 × 1080 et aperçu de lien 1200 × 630.

#### Pack automatique

- L'utilisateur choisit un produit et un style une seule fois.
- Le navigateur produit les trois fichiers et un texte prêt à copier.
- Tous les liens utilisent le suivi existant `/go/<code>` pour relier vues, commandes et ventes.

### Architecture proposée

- Étendre `src/lib/affiche.ts` en moteur commun avec `renderProduit`, `renderBoutique` et `renderPack`.
- Ajouter un objet `IdentiteBoutique` : nom, logo, couverture, accroche, couleurs autorisées et lien tracké.
- Réutiliser les données de boutique existantes ; aucune migration n'est nécessaire pour le premier lot si ces champs sont déjà renseignés.
- Charger le moteur Canvas et la bibliothèque QR uniquement quand le studio est ouvert.
- Rediriger `/reseller/marketing` vers `/reseller/createur` une fois le studio unifié, puis renommer la navigation « Créer » ou « Contenu ».
- Conserver une signature Suguba et limiter les textes libres pour éviter les promesses inventées ou les coordonnées permettant de contourner la transaction.

## Vitesse perçue et temps de chargement

### Constat mesuré

- Navigation locale chaude Courses → Portefeuille : 119 ms.
- Navigation locale chaude Portefeuille → Courses : 62 ms.
- Poids estimé par le manifeste de build : environ 260 Ko compressés pour `/driver` et 201 Ko pour `/driver/earnings`, dépendances partagées incluses.
- Le layout commun représente environ 208 Ko compressés et monte plusieurs composants clients sur toutes les pages.
- Aucun fichier `loading.tsx` n'est présent : quand une route ou ses données prennent du temps, le clic peut sembler sans réaction.
- Le tableau livreur est entièrement client et attend séparément identité, catalogue, commandes et dossier livreur. Le catalogue complet n'est pas nécessaire pour réaliser une livraison.

Ces chiffres sont des mesures locales chaudes, pas des Core Web Vitals de production sur réseau malien. Ils prouvent que la transition peut être instantanée une fois les ressources présentes, mais pas que le premier chargement est rapide sur 3G.

### Implémentation recommandée

#### Lot P0 — réaction immédiate

- Ajouter `loading.tsx` au niveau global puis dans `/driver`, `/reseller`, `/supplier` et `/admin`, avec des squelettes qui reprennent la géométrie réelle.
- Donner à chaque bouton une réaction en moins de 100 ms : état pressé, libellé « Ouverture… » ou indicateur discret, protection contre le double clic.
- Précharger au repos les deux destinations de la barre inférieure du rôle actif.
- Garder les transitions visuelles entre pages courtes et progressives ; elles ne doivent jamais retarder l'action.

#### Lot P1 — réduire le premier chargement

- Sortir la synchronisation du catalogue du layout global et la monter seulement dans les zones qui l'utilisent.
- Charger l'identité une fois dans un layout de rôle, puis fournir les données au contenu.
- Créer une lecture dédiée au tableau livreur qui renvoie en une réponse : dossier, courses actives, résumé du portefeuille et historique court.
- Ne pas charger le catalogue complet sur `/driver` ; inclure dans la commande les informations de ramassage déjà autorisées au livreur.
- Charger dynamiquement les fenêtres Itinéraire, Reçu, Scanner et Code client, avec préchargement au toucher ou quand la carte devient visible.
- Ajouter `sizes="48px"` aux petites images produit du livreur pour éviter le téléchargement d'une image trop large.

#### Lot P2 — données rapides et sûres

- Conserver `no-store` pour les API privées et l'exclusion des pages privées du service worker.
- Ajouter des ETag ou `stale-while-revalidate` uniquement aux données publiques et non sensibles, comme le catalogue public filtré.
- Après une validation serveur, mettre à jour l'écran immédiatement avec la réponse reçue, puis rafraîchir silencieusement les autres données.
- Afficher « Mis à jour à 10:42 » dès que des données de course conservées localement sont montrées après une coupure.

#### Lot P3 — mesure en production

- Collecter LCP, INP, CLS et le délai `clic → écran utile`, avec échantillonnage et sans coordonnées client.
- Budgets : INP < 200 ms, LCP < 2,5 s au 75e percentile, réaction visuelle < 100 ms, JavaScript initial < 300 Ko compressés, image visible au-dessus de la ligne de flottaison < 200 Ko.
- Tester sur Android d'entrée de gamme en réseau 3G/4G réel à Bamako avant d'annoncer que l'application est rapide.

## Ordre recommandé

1. Corriger les libellés, erreurs et confirmation de remise du parcours livreur.
2. Ajouter les états de chargement et découpler le tableau livreur du catalogue complet.
3. Unifier les deux écrans marketing.
4. Livrer le modèle produit avec logo boutique et la carte boutique.
5. Ajouter le pack multi-format et mesurer les partages qui produisent réellement des visites et des ventes.

## Limites de l'audit

- Simulation locale avec données fictives ; aucune livraison, aucun appel et aucun message réel.
- Le code fournisseur correct et le code client correct n'ont pas été soumis, car la fixture locale bloque volontairement les écritures métier.
- Les captures permettent d'évaluer la hiérarchie, les libellés, les cibles et le reflow mobile ; elles ne suffisent pas à certifier la conformité WCAG, la navigation lecteur d'écran ou les performances sur réseau mobile réel.
