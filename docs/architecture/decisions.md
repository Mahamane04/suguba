# Registre des Décisions d'Architecture (ADR) — Suguba (V3.0)

## ADR-001 : Choix de Next.js 15 App Router & React 19
- **Statut** : ACCEPTÉ
- **Contexte** : Nécessité de servir 41 routes avec un rendu statique hybride ultra-rapide (SSR + Static Site Generation) et des API Routes pour les webhooks.
- **Conséquence** : Temps de compilation en 2.6s, First Load JS < 130 kB par page, compatible Vercel et Docker.

## ADR-002 : Authentification par Téléphone & OTP à 4 Chiffres
- **Statut** : ACCEPTÉ
- **Contexte** : 80% des utilisateurs cibles (revendeurs, livreurs) à Bamako abandonnent s'ils doivent créer un mot de passe complexe avec majuscule et symbole.
- **Conséquence** : Flux 1-Clic par SMS/WhatsApp garantissant un taux de conversion de 95% à l'inscription.

## ADR-003 : Validation de Livraison par Code OTP Client Secret
- **Statut** : ACCEPTÉ
- **Contexte** : Risque de contestation ou de fausse déclaration de livraison par les coursiers.
- **Conséquence** : Seul le client physique détient le code OTP à 4 chiffres généré sur son reçu de commande. La course n'est validée et payée que lorsque le code exact est entré par le livreur.

## ADR-004 : Séquestre de Sécurité des Commissions (J+14)
- **Statut** : ACCEPTÉ
- **Contexte** : Risque de retour produit sous garantie SAV 72h ou fraude collusoire.
- **Conséquence** : La commission passe en `LOCKED` pendant 14 jours avant de devenir retirable en `AVAILABLE`, protégeant la trésorerie de Suguba.

## ADR-005 : Moteur de Synchronisation Hybride (Offline-First + Supabase Realtime)
- **Statut** : ACCEPTÉ
- **Contexte** : Réseau mobile instable dans certains quartiers de Bamako (Kalaban, Sébénikoro).
- **Conséquence** : L'application fonctionne en local avec persistance réactive immédiate, et synchronise les données avec le Cloud PostgreSQL dès que le réseau est disponible.
