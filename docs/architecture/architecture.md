# Architecture Technique Globale — Suguba (V3.0)

## 1. Vue d'Ensemble des Composants

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENTS SMARTPHONES & WEB                       │
│  (Next.js 15 App Router • React 19 • Tailwind CSS • Service Worker PWA)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     COUCHE APIS & SERVEUR (EDGE)                       │
│  - Routes API Next.js : /api/sms/send-otp, /api/payouts, /api/webhooks │
│  - Webhook SasPay signé (HMAC-SHA256, Orange/Moov/Mobi Cash + carte)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│     POSTGRESQL CLOUD (SUPABASE)      │  │    PASSERELLES FINTECH MALI   │
│  - Tables relationnelles avec RLS    │  │  - SasPay Payouts API        │
│  - Websockets Realtime Subscriptions │  │  - SasPay Softpay (payin)    │
│  - Audit Logs & Sécurité Ledger      │  │  - SMS Orange Mali (commandes)│
└──────────────────────────────────────┘  └───────────────────────────────┘
```

## 2. Invariants d'Intégrité de Données
> Mis à jour le 2026-09-11 — détails dans `REPRISE.md` et `docs/architecture/decisions.md`.

- **Montants calculés par le serveur** : prix, commission et total d'une commande viennent du moteur `src/lib/pricing.ts` et sont figés dans `orders.pricing_snapshot`. Aucune route n'accepte un montant du navigateur, sauf la part revendeur choisie par le fournisseur.
- **Commission d'une commande** : créée `pending`, elle passe `locked` QUE lorsque le livreur saisit le code secret du client (vérifié côté serveur), puis `available` après 14, 7 ou 3 jours selon le palier du revendeur.
- **« En vente »** = `products.status = 'approved'` **et** `public_price > 0`, partout (affichage, partage, affiche).
- **Isolation** : RLS sur toutes les tables ; la clé anon ne lit que les produits approuvés, tout le reste passe par des routes serveur qui vérifient la session signée et le rôle (middleware + contrôle dans chaque route).
