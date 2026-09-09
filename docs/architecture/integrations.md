# Architecture des Intégrations & Webhooks (Gate G3) — Suguba SaaS

## 1. Vue d'Ensemble des Passerelles Mobile Money (Mali / UEMOA)

Suguba intègre une couche d'abstraction unifiée (`src/lib/momo-gateway.ts`) capable de communiquer avec les API des principaux opérateurs de paiement en zone UEMOA :

| Opérateur | Méthode d'Intégration | Usage Principal |
| :--- | :--- | :--- |
| **SasPay** | API unique payin (softpay) + payout, https://docs.saspay.me | Encaissements et virements de commissions. Réseaux Mali : `orange_ml`, `moov_ml`, `mobi_cash_ml`. ⚠️ Wave **non couvert** au Mali. |
| **SasPay — carte** | Réseau global `card` (Stripe), facturé en USD | Portail Diaspora : l'acheteur est à l'étranger et n'a pas de numéro mobile money malien. Page hébergée uniquement, `return_url` obligatoire. |

---

## 2. Variables d'Environnement de Configuration (.env.local)

```env
# URL de l'Application
NEXT_PUBLIC_APP_URL="https://sugubaml.com"

# SasPay — encaissement et versement, une seule clé
SASPAY_API_KEY="sk_live_..."      # scope BOTH (PAYIN + PAYOUT)
SASPAY_WEBHOOK_SECRET="whsec_..." # affiché une seule fois à la création du webhook
```

*Note : En l'absence de clés de production, la passerelle bascule automatiquement en mode **Sandbox Sécurisé** pour le développement local et les démonstrations.*

---

## 3. Spécification du Webhook de Notification (`/api/webhooks/momo`)

- **Méthode HTTP** : `POST`
- **En-têtes de Sécurité** : `x-token` ou `x-signature` (Vérification HMAC SHA256)
- **Charge Utile (Payload JSON)** :
```json
{
  "cpm_trans_id": "WTH-8821",
  "cpm_trans_status": "ACCEPTED",
  "cpm_amount": 20000,
  "cpm_currency": "XOF",
  "cpm_phone_prefixe": "223",
  "cpm_custom": "Revendeur Moussa Coulibaly"
}
```
- **Traitement Automatisé** : À la réception d'un statut `ACCEPTED`, Suguba met automatiquement à jour le statut du retrait à `completed`, enregistre la référence de transaction et consigne l'événement dans le registre d'audit.
