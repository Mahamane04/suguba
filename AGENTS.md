# AGENTS.md — Suguba SaaS Factory
# Role and operating rules for AI Agents on Suguba

## 1. Primary Mandate
Every development action must adhere strictly to the MicroOffice SaaS Factory V3 principles:
- **Mobile-First Priority**: The entire application is built primarily for smartphone users (resellers, suppliers, customers, delivery riders) on mobile networks in Mali (Bamako & regions).
- **Suguba Controls the Transaction**: No direct bypass between supplier and reseller/customer (never publish a supplier's phone or address). The client price is computed server-side by `src/lib/pricing.ts` (supplier price + reseller share chosen by the supplier + Suguba share set by the admin, never below the cost floor). Delivery dispatch, order confirmation and the commission ledger are mastered by Suguba.
- **Never trust the browser with money**: no route accepts an amount from the client, except the reseller share a supplier chooses for their own product.
- **Traceability**: All features map to Requirements (`REQ-xxx`), Tasks (`TASK-xxx`), and Tests (`TEST-xxx`).
- **Source of truth**: read `REPRISE.md` (project state, pending decisions, known pitfalls) before any work; apply a Supabase migration BEFORE pushing code that reads it; always validate with `npm run build`.

## 2. Roles & Portals
1. **Fournisseur (Supplier)**: Adds products, manages inventory, prepares packages.
2. **Revendeur (Reseller)**: Shares media kits to WhatsApp/TikTok, generates orders, tracks commissions and requests Mobile Money payouts.
3. **Client (Buyer)**: 1-click order form (no mandatory account creation), track delivery by phone/OTP.
4. **Livreur (Rider)**: View assigned runs, navigate with landmarks, validate delivery with Customer OTP.
5. **Suguba Admin**: Moderation, pricing margins, order confirmation call desk, rider dispatch, ledger & payout audit.
