# Registre des Portes de Qualité (Gates) — Suguba SaaS Factory

| Gate | Intitulé | Statut | Critères & Preuves |
| :--- | :--- | :--- | :--- |
| **G0** | Market Validation | ✅ PASSÉ | Problème validé : 80%+ du e-commerce au Mali se fait sur WhatsApp de manière informelle sans garantie ni automatisation des commissions. Suguba apporte la structure de confiance. |
| **G1** | Product Definition & Scope | ✅ PASSÉ | PRD, périmètre V1 strict (5 interfaces, commissions fixes, confirmation téléphonique, livraison avec OTP, retraits Mobile Money) définis dans `docs/product/`. |
| **G2** | UX/UI & Mobile Flows | ✅ PASSÉ | Ergonomie Mobile-First conçue pour les smartphones (tap targets 48px+, formulaires sans friction avec repères de quartier, kits de partage WhatsApp). |
| **G3** | Architecture & Base de données | ✅ PASSÉ | Architecture Full-Stack Next.js 15 PWA + PostgreSQL, RLS, machine d'états comptable double entrée et intégrations Mobile Money & OTP. |
| **G4** | Coûts & Faisabilité | ✅ PASSÉ | Modèle économique validé : Commission fixe par produit + Marge Suguba. Hébergement Vercel/PostgreSQL sans frais fixes prohibitifs au démarrage. |
| **G5** | Roadmap & Traçabilité | ✅ PASSÉ | Découpage en jalons ordonnés (`M1` à `M6`) avec traçabilité stricte `REQ-xxx` -> `TASK-xxx` -> `TEST-xxx`. |
| **G6** | Build Loop & Implémentation | 🔄 EN COURS | Développement du socle applicatif et des 5 portails. |
| **G7** | Sécurité | ⏳ EN ATTENTE | RLS, validation des entrées Zod, protection contre le double retrait et la fraude. |
| **G8** | Performance | ⏳ EN ATTENTE | Budget de chargement mobile (< 2s sur réseau mobile 3G/4G). |
| **G9** | Conformité & Réglementation | ⏳ EN ATTENTE | Respect du cadre UEMOA/BCEAO (tenue de registre de créances, pas d'émission de monnaie électronique). |
| **G10**| Validation Beta | ⏳ EN ATTENTE | Tests terrain avec cohorte de 10 revendeurs et 3 fournisseurs à Bamako. |
| **G11**| Release V1.0 | ⏳ EN ATTENTE | Déploiement en production contrôlée. |
