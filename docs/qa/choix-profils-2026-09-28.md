# Choix des profils — 28 septembre 2026

REQ-PROFIL-001 / TASK-PROFIL-001 : sur `/rejoindre`, rendre les quatre profils compréhensibles avant toute inscription. Le sélecteur horizontal et la présélection revendeur sont remplacés par quatre cartes d’activité, sans choix par défaut. Deux colonnes sur téléphone, quatre sur grand écran ; couleurs et typographie de Suguba conservées. Le titre inclut aussi le parcours d’achat diaspora, qui ne relève pas d’un gain d’argent.

Les explications annoncent le compte multi-profils. Après sélection : profil nommé, étapes existantes, action spécifique et bouton « Changer de profil ». Consulter un profil ne l’active pas. Les arguments de réassurance propres au revendeur ne sont plus affichés indistinctement aux fournisseurs, livreurs et acheteurs diaspora.

TEST-PROFIL-001 — contrôles manuels sur la version compilée locale, données fictives :
- Aucun choix initial (`aria-pressed=true` : 0), aucune inscription affichée avant sélection.
- Fournisseur → `/register?role=supplier`, livreur → `/register?role=driver`, revendeur → `/register?role=reseller`, diaspora → `/diaspora`.
- Compte connecté sans profil fournisseur → `/compte/profils?ajouter=supplier`.
- Retour au choix : sélection annulée et focus rendu au titre. Sélection et retour utilisables avec Entrée.
- 390 px : quatre cartes visibles, largeur du document 386 px, aucun défilement horizontal. 1440 px : largeur du document 1440 px.
- `npm run build` réussi ; avertissement préexistant de dépendance React dans Toast.tsx:112.
- `git diff --check` réussi. Aucune création de compte, aucun OAuth ni activation de profil exécutés.

Captures locales : `audit-local/2026-09-28-profils/choix-mobile.png` et `choix-desktop.png`. Cette modification n’est pas encore déployée. Aucun changement d’API, de permissions, de schéma ou de calcul financier.
