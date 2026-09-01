-- ============================================================================
-- SUGUBA — CORRECTIF CONTRAINTE STATUT COMMANDE
-- ============================================================================
--
-- La contrainte CHECK sur orders.status posée dans schema.sql accepte
-- 'assigned_driver' et 'in_delivery' — mais TOUT le code applicatif (types,
-- pages admin/livreur/tracking) utilise 'dispatched' et 'in_transit'. Neuf
-- fichiers utilisent la convention applicative, un seul (la contrainte
-- elle-même) utilise l'autre : c'est la contrainte qui est l'erreur.
--
-- Resté invisible jusqu'ici parce qu'aucun code ne poussait réellement un
-- changement de statut de dispatch vers Supabase (sugubaStore.assignDriver
-- ne faisait que notify() en local, jamais de push cloud) — corrigé le
-- 2026-08-26 en même temps que le branchement réel du rôle Livreur. Sans ce
-- correctif, la première tentative réelle de dispatch aurait échoué avec une
-- violation de contrainte, silencieusement côté client (le store local se
-- serait mis à jour quand même, croyant que tout allait bien).
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned')
);

-- Migre les lignes existantes qui porteraient encore l'ancienne convention
-- (aucune ne devrait exister en pratique, voir l'explication ci-dessus,
-- mais idempotent et sans risque si c'est le cas).
UPDATE public.orders SET status = 'dispatched' WHERE status = 'assigned_driver';
UPDATE public.orders SET status = 'in_transit' WHERE status = 'in_delivery';
