# Plan de Test Pilote Bêta Terrain à Bamako (Gate G10) — Suguba SaaS

## 1. Objectifs du Pilote Bêta
Valider en conditions réelles à Bamako les hypothèses de conversion, d'adhésion des revendeurs, de confirmation téléphonique et de sécurisation par code OTP.

---

## 2. Composition de la Cohorte Pilote (Durée : 14 jours)

| Profil | Nombre | Profil Cible & Localisation | Rôle dans le Test |
| :--- | :---: | :--- | :--- |
| **Revendeurs Pilotes** | 5 | Social sellers actifs sur WhatsApp & TikTok (ACI 2000, Kalaban-Coro, Baco-Djicoroni). | Partage de kits médias, génération d'au moins 3 commandes chacun, suivi de leur cagnotte. |
| **Fournisseurs Pilotes** | 2 | Grossistes/Importateurs d'articles électroniques & maison (Dabanani, Marché Rose). | Dépôt de 5 produits chacun, préparation des colis sous 2h après appel Suguba. |
| **Livreurs Moto** | 2 | Coursiers indépendants équipés de smartphones 4G. | Récupération colis fournisseur, navigation avec repères de quartier, validation stricte par Code OTP client. |
| **Desk Confirmation** | 1 | Opérateur Suguba Ops. | Appel des clients sous 15 minutes après commande en ligne, validation de l'adresse et du créneau. |

---

## 3. Scénarios de Test Bout-en-Bout Obligatoires

### Scénario 1 : Vente Réussie & Déblocage Commission
1. Le revendeur partage un produit sur son statut WhatsApp avec son lien `?ref=REV01`.
2. Le client passe commande en 1 clic sans mot de passe sur son téléphone.
3. Le desk Suguba appelle le client, valide le repère et assigne le livreur.
4. Le livreur arrive, le client inspecte le produit et donne son code OTP (4 chiffres).
5. Le livreur saisit le code : la commande est marquée **LIVRÉ**, les espèces sont encaissées, la commission revendeur passe en **Période de Sécurité (J+14)**.

### Scénario 2 : Simulation Tentative de Fraude OTP
1. Le livreur tente d'entrer 3 faux codes OTP.
2. Le système bloque la commande et notifie le desk Suguba Ops.
3. Le desk appelle le livreur et débloque la situation après vérification.

### Scénario 3 : Demande de Retrait Mobile Money
1. Le revendeur ayant atteint 5 000 FCFA de solde disponible demande un virement Wave.
2. Suguba Ops valide le virement via la passerelle Mobile Money.
3. Le revendeur reçoit la confirmation de virement.

---

## 4. Critères de Succès pour le Lancement Général (V1.0)
- Taux de livraison réussie après appel de confirmation $> 85\%$.
- Taux de satisfaction revendeur sur la simplicité du partage WhatsApp $> 90\%$.
- Zéro anomalie dans le registre comptable des commissions.
