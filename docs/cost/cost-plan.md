# Plan Économique & Structure des Coûts SaaS — Suguba (V3.0)

## 1. Modèle Économique Unitaire par Transaction (Exemple Vente 25 000 FCFA)

```
┌────────────────────────────────────────────────────────────────────────┐
│ PRIX PUBLIC CLIENT TOTAL : 25 000 FCFA (Encaissement 100% Suguba)       │
├────────────────────────────────────────────────────────────────────────┤
│ • Prix d'achat Fournisseur reversé au grossiste : 20 000 FCFA (80%)    │
│ • Commission Revendeur (Wave/Orange Money)       :  3 500 FCFA (14%)    │
│ • Frais de Livraison Moto alloués au coursier    :  1 500 FCFA          │
│ • MARGE BRUTE NETTE CONSERVÉE PAR SUGUBA         :  1 500 FCFA (6%)     │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Coûts d'Infrastructure Logicielle par Phase

| Poste de Dépense | Phase 1 (Pilote 50 revendeurs) | Phase 2 (Traction 500 revendeurs) | Phase 3 (Scale 5 000 revendeurs) |
| :--- | :--- | :--- | :--- |
| **Hébergement Vercel Pro** | 0 $ (Plan Gratuit Hobby) | 20 $ / mois | 40 $ / mois |
| **Base Supabase PostgreSQL** | 0 $ (Plan Gratuit 500 Mo) | 25 $ / mois (Pro Tier) | 50 $ / mois |
| **Passerelle SMS OTP** | ~10 $ / mois (500 SMS) | ~50 $ / mois (2 500 SMS) | ~300 $ / mois |
| **Frais Mobile Money (Wave)** | 1% par virement sortant | 1% par virement sortant | 0.8% (Négocié Corporate) |
| **TOTAL MENSUEL INFRA** | **< 15 $ (~10 000 FCFA)** | **~120 $ (~75 000 FCFA)** | **~500 $ (~320 000 FCFA)** |

---

## 3. Seuil de Rentabilité (Break-even)
- À raison d'une marge moyenne de **1 500 FCFA nette par commande**, la plateforme couvre ses frais de serveur dès **7 commandes livrées par mois** en Phase 1, et dès **50 commandes livrées par mois** en Phase 2 !
