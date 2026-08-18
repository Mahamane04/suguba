# Matrice de Traçabilité — Suguba SaaS Factory

| Exigence (REQ) | Tâche de Dev (TASK) | Composant / Fichier Clé | Test Associé (TEST) | Statut |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-001** (Auth Multi-Rôles) | `TASK-001` | `src/lib/auth.ts`, `src/app/login/page.tsx` | `TEST-001` (Connexion par rôle) | 🔄 En cours |
| **REQ-002** (Catalogue Fournisseur) | `TASK-002` | `src/app/supplier/products/page.tsx`, `src/lib/db.ts` | `TEST-002` (Soumission produit) | 🔄 En cours |
| **REQ-003** (Modération Suguba) | `TASK-003` | `src/app/admin/products/page.tsx`, `src/lib/pricing.ts` | `TEST-003` (Approbation & Marges) | 🔄 En cours |
| **REQ-004** (Dashboard Revendeur) | `TASK-004` | `src/app/reseller/dashboard/page.tsx` | `TEST-004` (Affichage soldes) | 🔄 En cours |
| **REQ-005** (Partage WhatsApp / Affiliation) | `TASK-005` | `src/components/reseller/ShareModal.tsx` | `TEST-005` (Génération liens & kits) | 🔄 En cours |
| **REQ-006** (Commande Express Revendeur) | `TASK-006` | `src/app/reseller/orders/new/page.tsx` | `TEST-006` (Création commande manuelle) | 🔄 En cours |
| **REQ-007** (Tunnel Client 1-Clic) | `TASK-007` | `src/app/p/[slug]/page.tsx`, `src/app/checkout/page.tsx` | `TEST-007` (Commande sans compte) | 🔄 En cours |
| **REQ-008** (Confirmation Téléphonique) | `TASK-008` | `src/app/admin/orders/page.tsx` | `TEST-008` (Appel & Validation statut) | 🔄 En cours |
| **REQ-009** (Dispatch Livreur) | `TASK-009` | `src/app/driver/runs/page.tsx`, `src/lib/dispatch.ts` | `TEST-009` (Assignation course) | 🔄 En cours |
| **REQ-010** (Validation OTP Livraison) | `TASK-010` | `src/app/driver/delivery/[id]/page.tsx` | `TEST-010` (Vérification code OTP) | 🔄 En cours |
| **REQ-011** (Machine d'États Commissions) | `TASK-011` | `src/lib/commissions.ts` | `TEST-011` (Pending -> Locked -> Available) | 🔄 En cours |
| **REQ-012** (Retraits Mobile Money) | `TASK-012` | `src/app/reseller/payouts/page.tsx` | `TEST-012` (Demande & validation virement) | 🔄 En cours |
