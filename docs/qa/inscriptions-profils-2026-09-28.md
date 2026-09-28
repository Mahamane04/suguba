# Parcours d’inscription guidés — 28 septembre 2026

REQ-PROFIL-002 / TASK-PROFIL-002 : étendre le choix explicite des profils aux inscriptions publiques et à l’ajout de profil, sans modifier les droits serveur.

## Pages vérifiées et corrigées

- `/register` : aucun revendeur choisi par défaut ; cinq profils expliqués par activité ; paramètre de profil valide conservé, valeur inconnue ignorée. Après choix, focus sur le formulaire, rappel du profil et lien pour modifier. Les boutons Google/e-mail nomment le profil. Le choix est bloqué pendant une demande ou la confirmation e-mail pour éviter un décalage avec le lien déjà envoyé. Erreurs réseau visibles. Un compte déjà connecté est guidé vers ses profils.
- `/register/complete` : même vocabulaire et même sélecteur ; « connexion confirmée » au lieu d’« identité vérifiée » ; profil demandé conservé pour un compte incomplet ; compte déjà complet orienté vers Mes profils. Rappel des conditions fournisseur/livreur, nom du profil au bouton final, focus sur les informations après changement. Labels associés aux champs et saisies de taille 16 px sur téléphone.
- `/compte/profils` : activités à ajouter visibles avant le formulaire ouvert ; distinction entre consulter, remplir et confirmer l’ajout. Explication du contrôle des livreurs et de la modération des produits. Le profil Client détenu est maintenant affiché. Numéro absent détecté ; message réseau ne prétendant plus qu’aucune écriture n’a eu lieu.
- `/reseller/join` : ancienne inscription Google isolée remplacée par une redirection vers le formulaire commun, profil revendeur explicite et code de parrainage conservé. Les anciennes promesses uniformes de garantie et le parcours sans alternative e-mail ne sont plus exposés sur cette page.
- `/login` : lien « Choisir mon profil et créer un compte ».
- Progression commune : « Profil et connexion → Vos informations → Votre espace », étape active accessible.

## TEST-PROFIL-002 — résultats

Application compilée locale, adaptateur fictif sur loopback. Aucun appel OAuth réel, envoi d’e-mail, compte créé ou profil activé.

1. `/register` sans paramètre : zéro profil sélectionné, aucun formulaire de création affiché avant le choix.
2. Fournisseur puis livreur : formulaire et intitulés actualisés ; focus `connexion-inscription` ; retour au sélecteur possible.
3. `/register?role=admin` : aucun profil sélectionné, aucun formulaire affiché.
4. `/reseller/join?ref=TEST-LOCAL` redirige vers `/register?role=reseller&ref=TEST-LOCAL`.
5. Compte connecté, demande fournisseur : lien `/compte/profils?ajouter=supplier` ; les trois activités restent visibles au-dessus du formulaire.
6. Compte fictif incomplet : `intendedRole=supplier` affiche le fournisseur ; passage aux profils livreur, diaspora et client affiche les champs et boutons correspondants.
7. Largeur 390 px : document 386 px, aucun débordement horizontal ; les cinq profils se lisent verticalement. Contrôle visuel desktop à 1440 px.
8. `npm test` : 389 tests réussis, zéro échec. `npm run build` final réussi. Avertissement React préexistant dans Toast.tsx:112. `git diff --check` réussi.

Preuves locales : `audit-local/2026-09-28-inscriptions/`. Les parcours OAuth/e-mail de bout en bout et les écritures d’inscription ne sont pas certifiés par cette vérification UI. Aucun changement de base ni déploiement effectué pour ce lot.
