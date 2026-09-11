# Registre des Anomalies & Bugs — Suguba

> Mis à jour le 2026-09-11. Les causes détaillées et les leçons sont dans `REPRISE.md`
> (section « Pièges déjà rencontrés »).

| ID | Description | Sévérité | Statut | Résolution / Correctif |
| :--- | :--- | :--- | :--- | :--- |
| `BUG-001` | Lucide icon title prop type error dans `CloudSyncBadge.tsx` | Faible | **RÉSOLU** | Icône entourée d'un `<span>` avec attribut title. |
| `BUG-002` | Type `WithdrawalRequest` vs `Withdrawal` dans `cloud-sync.ts` | Moyen | **RÉSOLU** | Import aligné sur le type unifié `Withdrawal`. |
| `BUG-003` | Bouton simulateur répété dans le header revendeur | Mineur | **RÉSOLU** | Remplacé par les raccourcis du tableau de bord. |
| `BUG-004` | Connexion Google : compte « revendeur » créé en silence, sans choix du profil ni numéro | Élevé | **RÉSOLU** (2026-09-10) | Pas de création sans rôle ; `/register/complete` imposé par le middleware. |
| `BUG-005` | Partage WhatsApp : lien nu, sans image | Moyen | **RÉSOLU** (2026-09-11) | Partage natif avec photo + aperçu Open Graph de `/p/[slug]`. |
| `BUG-006` | « Garantie 6 mois — Service certifié » affichée sur tous les produits, sans donnée réelle | Élevé | **RÉSOLU** (2026-09-11) | Retirée ; engagements réels à la place. |
| `BUG-007` | Affiches revendeur : code et téléphone d'un revendeur fictif | Élevé | **RÉSOLU** (2026-09-11) | Studio refait sur le vrai code, sans téléphone. |
| `BUG-008` | Service worker : réponses d'API (données privées) gardées en cache | Élevé | **RÉSOLU** (2026-09-11) | Service worker v3, anciens caches supprimés. |
| `BUG-009` | Produit sans photo : plantage du tableau de bord admin et de l'inventaire | Moyen | **RÉSOLU** (2026-09-11) | Vignette sécurisée (`ProductImage`). |
| `BUG-010` | Produit pas en vente partagé à « 0 F », lien « Produit introuvable » ; formulaire admin annonçant « publié » à tort | Élevé | **RÉSOLU** (2026-09-11) | Publication réelle via la route de tarification ; « Pas encore en vente » sur la page. |
| `BUG-011` | iPhone : barre du bas flottant au milieu de l'écran après fermeture du clavier | Moyen | **RÉSOLU** (2026-09-11) | Barre masquée pendant la saisie (`useClavierOuvert`). |
| `BUG-012` | `/api/auth/me` renvoyait 401 à tout visiteur (erreur console sur chaque page) | Faible | **RÉSOLU** (2026-09-11) | Retirée des routes « session requise » du middleware. |
| `BUG-013` | Formulaire fournisseur : garantie, délai et adresse du stock jamais enregistrés | Moyen | **OUVERT** | Décision de l'utilisateur : colonnes à créer ou champs à retirer. |
| `BUG-014` | Confirmation avant enregistrement, doubles envois et erreurs de commission ignorées | Critique | **CORRIGÉ LOCALEMENT** | REQ-013 : création atomique, attente serveur et reprise par clé ; migration/déploiement en attente. |
| `BUG-015` | Code revendeur perdu lorsque son profil n'est pas présent dans le store client | Élevé | **CORRIGÉ LOCALEMENT** | Transmission explicite du code, résolution en base, erreur si code inconnu. |
| `BUG-016` | Confirmation d'une commande absente remplacée par la première commande locale | Élevé | **CORRIGÉ LOCALEMENT** | Aucun repli ; proposition de suivi avec numéro et téléphone. |
| `BUG-017` | Ancien devis encore utilisable après changement de quantité/ville ; totaux livraison en dur dans d'autres formulaires | Élevé | **CORRIGÉ LOCALEMENT** | Devis serveur partagé, invalidation immédiate, affichage du total avec livraison. |
