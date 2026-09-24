# SUGUBA — instructions du projet

## Guide des parcours : à mettre à jour à CHAQUE modification

Page cachée **/admin/guide**, réservée à l'administrateur général (admin sans rôle
d'équipe restreint, ou « Super Admin »). Tout autre visiteur : page introuvable.
Aucun lien n'y mène dans l'application — ne pas en ajouter.

Le fondateur s'en sert pour vérifier que ce qui est livré correspond à ce qu'il a
demandé. Toute modification visible de l'application (page, bouton, parcours,
comportement) met donc à jour, **dans le même commit** :

1. **`docs/guide/guide.json` › `journal`** — une entrée EN TÊTE de liste :
   - `demande` : la demande du fondateur, **dans ses mots** (reformulée seulement
     pour la lisibilité, sans en changer le sens) ;
   - `realise` : ce qui a été fait, en langage utilisateur ;
   - `ecarts` : ce qui diffère de la demande, n'est pas fait, ou reste à décider
     (SQL à lancer, choix à trancher…). Ne jamais le laisser vide par commodité ;
   - `pages` : identifiants des fiches concernées ; `commit` ; `statut`
     (`en local`, puis `en ligne` après déploiement vérifié) ;
   - mettre `majLe` à la date du jour.
2. **`docs/guide/guide.json` › `pages`** — la fiche de chaque page touchée :
   `but`, `elements` (chaque bouton et ce qu'il fait), `suite` (pages où elle
   mène), `note`. Nouvelle page de l'application = nouvelle fiche (sinon
   `npm test` échoue : voir `tests/guide.test.cjs`).
3. **Captures** — serveur local lancé (`SUGUBA_DEMO_MODE=true`), puis :
   `npm run guide:captures -- id1,id2` (seulement les pages touchées).
   Le script masque noms, téléphones et e-mails et **refuse** de capturer s'il en
   reste. Ne jamais capturer `/admin/boutique-suguba` (l'ouvrir crée la boutique
   officielle en base).

Les captures ne vont **jamais** dans `/public` : elles sont servies par
`/api/admin/guide/capture/[id]`, réservée à l'administrateur général.

## Rappels

- Ne jamais lancer `npm run build` pendant que le serveur de développement tourne.
- Le serveur local utilise la VRAIE base : aucune soumission de formulaire ni
  action qui écrit des données pendant les tests visuels.
- Les requêtes SQL sont lancées par le fondateur dans Supabase › SQL Editor.
