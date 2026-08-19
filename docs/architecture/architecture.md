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
│  - Passerelle Webhooks Mobile Money (Wave, Orange, Moov)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│     POSTGRESQL CLOUD (SUPABASE)      │  │    PASSERELLES FINTECH MALI   │
│  - Tables relationnelles avec RLS    │  │  - Wave Business Payouts API │
│  - Websockets Realtime Subscriptions │  │  - CinetPay (Orange/Moov)     │
│  - Audit Logs & Sécurité Ledger      │  │  - Passerelle SMS OTP Malitel │
└──────────────────────────────────────┘  └───────────────────────────────┘
```

## 2. Invariants d'Intégrité de Données
- **Atomicité des commandes** : Chaque commande `order` génère une ligne `commission` en statut `potential`.
- **Règle de Clôture sous OTP** : La commission ne bascule en `locked` (puis `available` après le séquestre J+14) QUE lorsque le livreur saisit le code OTP secret remis par le client final.
- **Isolation RLS** : Un revendeur ne peut requêter que ses propres commissions et ses propres retraits.
