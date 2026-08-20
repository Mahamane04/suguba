# Liste de Contrôle Sécurité & Antifraude (Security Gate G7) — Suguba SaaS

## 1. Mécanismes Antifraude Implémentés (Milestone M7)

| Risque Identifié | Impact | Solution Implémentée | Statut |
| :--- | :--- | :--- | :---: |
| **Devinette / Brute-force du Code OTP par le Livreur** | Élevé | Limitation stricte à **3 tentatives** erronées par commande. Blocage immédiat et obligation de contacter le support Suguba Ops pour réinitialisation. Compteur de tentatives affiché en direct. | ✅ Actif |
| **Double-Clic / Double-Retrait Mobile Money** | Critique | Verrouillage atomique du solde disponible lors de la soumission de retrait avec contrôle d'unicité. | ✅ Actif |
| **Fraude et Rétractation Revendeur (Ventes fictives)** | Élevé | Barème de réputation progressif avec délai de rétention de sécurité :<br>- **Nouveau revendeur** : 14 jours de garantie (D+14)<br>- **Revendeur Vérifié (+10 ventes)** : 7 jours (D+7)<br>- **Revendeur VIP (+30 ventes)** : 3 jours (D+3) | ✅ Actif |
| **Faux Commandes & Refus de Livraison** | Élevé | Confirmation téléphonique obligatoire par le desk d'appel Suguba avant tout dispatch de coursier. | ✅ Actif |
| **Désintermédiation Fournisseur - Client** | Critique | Les coordonnées complètes du client ne sont jamais communiquées au fournisseur. Suguba maîtrise le bon de livraison et le livreur. | ✅ Actif |
| **Journal d'Audit & Traçabilité Complète** | Modéré | Tous les événements sensibles (tentatives OTP, validation de remise, approbation des marges, virements) sont historisés dans le registre d'audit. | ✅ Actif |

> ⚠️ **Précision (2026-08-19)** : le tableau ci-dessus décrit la logique métier applicative (paliers de rétention, journal, non-communication des coordonnées au fournisseur), effectivement présente dans le code. Il ne documentait cependant pas le contrôle d'accès ni l'authentification eux-mêmes, qui étaient absents — voir section 2. La ligne « Confirmation téléphonique obligatoire » reste un **processus humain** (l'opérateur doit appeler avant de dispatcher) : rien ne l'impose techniquement, un dispatch peut toujours se faire sans cet appel si l'opérateur saute l'étape.

## 2. Authentification & contrôle d'accès — état réel au 2026-08-19

Un audit de précommercialisation complet (QA/sécurité/UX) a été conduit ce jour et a mis en évidence que les points ci-dessous, bien qu'absents de la liste de contrôle d'origine, étaient les failles les plus critiques du produit. Statut après correction :

| Risque | Statut avant | Statut après correctif |
| :--- | :--- | :--- |
| Accès à `/admin`, `/supplier`, `/driver` sans authentification | 🔴 Aucun contrôle — accès direct par URL | ✅ Bloqué par `middleware.ts` (session signée obligatoire, redirection `/login`) |
| Code OTP de connexion renvoyé au client / vérification factice | 🔴 Le code partait dans la réponse HTTP, tout code était accepté en repli | ✅ Code haché côté serveur (`src/lib/otp-store.ts`), jamais transmis au client |
| Auto-attribution du rôle (y compris Admin) | 🔴 « Connexion rapide » sans vérification | ✅ Désactivée par défaut, réservée à `SUGUBA_DEMO_MODE=true` (variable serveur uniquement) |
| Signature du webhook Mobile Money | 🔴 `return true` quasi systématique | ✅ HMAC-SHA256 réel, rejet par défaut sans clé configurée (`src/lib/momo-gateway.ts`) |
| Déclenchement de virement (`/api/payouts/initiate`) | 🔴 Aucune vérification d'appelant | ✅ Session admin exigée (middleware + revérification dans la route) |
| Politiques RLS Supabase (`profiles`, `payouts`, `orders`) | 🔴 `USING (true)` en lecture/écriture pour tout le monde | ✅ Réécrites — voir `supabase/schema.sql` ; accès public restreint à la lecture du catalogue et à la création de commande |

**Reste à faire avant commercialisation réelle** : appliquer `supabase/schema.sql` corrigé sur le projet Supabase de production et lui fournir une clé `service_role` valide (aucun des deux n'était disponible au moment de l'audit) ; construire un flux de création de retrait authentifié côté revendeur (aujourd'hui désactivé côté client, faute de lien session↔revendeur réel) ; migrer les visuels produit hors d'Unsplash vers un stockage propre à Suguba.

## 3. Validation d'inscription — état réel au 2026-08-19

Corrige un gap similaire découvert après coup : `/register` créait un profil `active` instantanément à partir d'un simple numéro tapé dans un formulaire, sans jamais prouver que ce numéro appartenait au demandeur.

| Élément | Avant | Après |
| :--- | :--- | :--- |
| Numéro d'inscription | Jamais vérifié | OTP réel obligatoire avant toute création (`/api/auth/request-otp` + `/api/auth/verify-otp`) |
| Statut du profil créé | `active` immédiat | `pending_approval` (sauf rôle `customer`) — voir colonne `profiles.status` |
| Accès au tableau de bord tant que non approuvé | Aucun contrôle | Bloqué par `middleware.ts`, redirigé vers `/pending-approval` |
| Validation du dossier | Inexistante malgré le texte affiché ("en cours de validation") | Panneau admin réel (`/api/admin/pending-profiles`, `/api/admin/review-profile`) sur `/admin` |
| Création du premier compte admin | Aucun moyen légitime (self-serve bloqué à raison, mode démo désactivé par défaut) | `scripts/create-admin.js` (CLI, clé `service_role`, jamais via le web) + `/api/admin/promote` pour les suivants |

Choix assumé : vérification par **téléphone** (l'app est 100% OTP/WhatsApp, aucune infrastructure email n'existe) plutôt que par email — à revoir si un canal email devient nécessaire.

