# Plan de Monitoring & Indicateurs Clés de Performance (Phase 13) — Suguba SaaS

## 1. Tableau de Bord des Indicateurs Opérationnels (KPIs)

Suguba supervise quotidiennement ces métriques au niveau du Desk Ops :

| Indicateur (KPI) | Objectif V1 | Alerte Déclenchée si |
| :--- | :---: | :--- |
| **Taux de Confirmation Téléphonique** | $> 80\%$ | $< 65\%$ (Vérifier la qualité des leads revendeurs) |
| **Délai Moyen d'Appel après Commande** | $< 15\text{ min}$ | $> 45\text{ min}$ (Manque d'opérateurs au desk d'appel) |
| **Taux de Succès Livraison OTP** | $> 85\%$ | $< 75\%$ (Problème d'adresses ou indisponibilité clients) |
| **Taux d'Échec / Blocage Code OTP** | $< 2\%$ | $> 5\%$ (Suspicion de tentative de fraude coursier) |
| **Délai de Paiement des Retraits Revendeurs** | $< 24\text{ h}$ | $> 48\text{ h}$ (Solde de trésorerie Mobile Money insuffisant) |

---

## 2. Procédure d'Alerte & Gestion des Incidents
1. **Échec Webhook de Paiement** : Retrait placé en attente de réconciliation manuelle par l'administrateur.
2. **Coupure Réseau Opérateur (Orange/Moov/Telecel)** : Les coursiers utilisent le mode hors-ligne PWA et synchronisent dès le retour de couverture.
3. **Plainte Client / Colis Non Conforme** : Gel immédiat de la commission revendeur correspondante dans le registre comptable et ouverture du ticket SAV.
