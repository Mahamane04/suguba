# Budget de Performance & PWA (Gate G8) — Suguba SaaS

## 1. Métriques & Budgets Mobile-First (Réseau 3G/4G Bamako)

| Métrique | Budget Cible | Réalisé V1 | Statut |
| :--- | :--- | :--- | :---: |
| **First Load JS (Bundle initial)** | $< 150 \text{ kB}$ | **103 kB** (partagé) | ✅ Respecté |
| **Poids des Pages Clés (HTML + JS)** | $< 140 \text{ kB}$ | **118 - 132 kB** | ✅ Respecté |
| **Temps de compilation production** | $< 5 \text{ s}$ | **2.1 s** | ✅ Respecté |
| **Support PWA & Mise en Cache** | Service Worker actif | `public/sw.js` (Cache-first pour médias, Network-first pour données) | ✅ Respecté |
| **Résilience Hors-Ligne** | Détection réseau | `OfflineStatus.tsx` + Sauvegarde locale | ✅ Respecté |
| **Installation Smartphone** | 1-Tap Add to Home | `PwaInstallPrompt.tsx` (Android & iOS) | ✅ Respecté |

---

## 2. Stratégie de Mise en Cache du Service Worker (`sw.js`)
1. **Shell Applicatif & Fichiers Statiques** : Mis en cache dès l'installation du Service Worker.
2. **Images Produits Unsplash / Médias** : Stratégie *Cache-First* pour économiser les données mobiles des utilisateurs.
3. **Pages & Données Dynamiques** : Stratégie *Network-First* avec repli instantané sur le cache local en cas de perte de signal 3G/4G.
