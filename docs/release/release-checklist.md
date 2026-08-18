# Guide & Checklist de Déploiement en Production (Gate G11) — Suguba SaaS

## 1. Déploiement Cloud Recommandé (Vercel ou VPS Node.js)

### Option A : Déploiement 1-Clic sur Vercel (Recommandé)
1. Créer un dépôt Git (GitHub ou GitLab) et pusher le projet :
   ```bash
   git init
   git add .
   git commit -m "feat: release candidate Suguba SaaS V1"
   git branch -M main
   git remote add origin git@github.com:votre-compte/suguba-saas.git
   git push -u origin main
   ```
2. Connecter le dépôt sur [Vercel.com](https://vercel.com).
3. Définir les variables d'environnement dans l'interface Vercel (voir section 2).
4. Cliquer sur **Deploy**.

---

## 2. Configuration du Nom de Domaine `sugubaml.com`

Pour connecter votre domaine personnalisé chez votre registraire (Namecheap, OVH, etc.) :
- **Type A** : `@` $\rightarrow$ `76.76.21.21` (IP Vercel)
- **Type CNAME** : `www` $\rightarrow$ `cname.vercel-dns.com`

---

## 3. Variables d'Environnement de Production (.env.production)

```env
# URL Officielle de l'Application
NEXT_PUBLIC_APP_URL="https://sugubaml.com"

# Passerelles Mobile Money (CinetPay / Wave)
CINETPAY_API_KEY="votre_cle_prod"
CINETPAY_SITE_ID="votre_site_id_prod"
CINETPAY_SECRET_KEY="votre_secret_hmac"
CINETPAY_DISBURSEMENT_KEY="votre_cle_payouts"
WAVE_API_KEY="votre_cle_wave_prod"
WAVE_WEBHOOK_SECRET="votre_secret_webhook"

# Base de Données (Supabase / Neon PostgreSQL si transition depuis mock)
DATABASE_URL="postgresql://user:password@host:5432/suguba_prod"
```

---

## 4. Checklist Pré-Lancement (Go / No-Go)
- [x] Toutes les 20 routes Next.js compilent sans erreur (`npm run build`).
- [x] Service Worker PWA (`public/sw.js`) actif et fonctionnel.
- [x] Sécurité antifraude OTP et barème de réputation vérifiés.
- [x] Mentions légales, CGU et Contrat Revendeur accessibles.
- [x] Numéros de téléphone d'assistance Suguba Ops configurés (+223 70 00 00 01).
