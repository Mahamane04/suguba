# Architecture des Intégrations & Webhooks (Gate G3) — Suguba SaaS

## 1. Vue d'Ensemble des Passerelles Mobile Money (Mali / UEMOA)

Suguba intègre une couche d'abstraction unifiée (`src/lib/momo-gateway.ts`) capable de communiquer avec les API des principaux opérateurs de paiement en zone UEMOA :

| Opérateur | Méthode d'Intégration | Usage Principal |
| :--- | :--- | :--- |
| **Wave Mali** | Wave Business Checkout & Payout API | Encaissements en 1-clic & Virements instantanés vers comptes Wave. |
| **Orange Money Mali** | API Orange Money / Passerelle CinetPay / Hub2 | Encaissements & Virements automatisés de commissions vers les numéros Orange Money. |
| **Moov Money Mali** | Passerelle CinetPay / Hub2 / Paydunya | Encaissements & Virements vers numéros Moov Money. |

---

## 2. Variables d'Environnement de Configuration (.env.local)

```env
# URL de l'Application
NEXT_PUBLIC_APP_URL="https://sugubaml.com"

# Passerelle CinetPay (Orange Money / Moov Money)
CINETPAY_API_KEY="votre_cle_api_cinetpay"
CINETPAY_SITE_ID="votre_site_id"
CINETPAY_SECRET_KEY="votre_cle_secrete_hmac"
CINETPAY_DISBURSEMENT_KEY="votre_cle_disbursement_retraits"

# Passerelle Wave Mali
WAVE_API_KEY="wave_ci_prod_..."
WAVE_PAYOUT_KEY="wave_payout_prod_..."
WAVE_WEBHOOK_SECRET="whsec_..."
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
