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
