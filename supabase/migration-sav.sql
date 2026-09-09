-- ============================================================================
-- SUGUBA — TABLE SAV (tickets après-vente)
-- ============================================================================
--
-- Le module SAV existait entièrement côté navigateur : `createSavTicket`,
-- `dispatchSavCourier` et `resolveSavTicket` ne modifiaient que le store
-- local. Concrètement, une réclamation client saisie par un admin était
-- invisible pour tous les autres admins, et perdue au premier vidage de
-- cache — sur un sujet où le client, lui, attend un suivi.
--
-- `sav_tickets` porte son propre statut (contrairement à suppliers/drivers,
-- dont le statut vit dans profile_roles) : il s'agit ici du cycle de vie du
-- ticket lui-même, pas du statut d'un compte.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sav_tickets (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  ticket_number     TEXT UNIQUE NOT NULL,
  order_id          TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number      TEXT,
  customer_name     TEXT,
  customer_phone    TEXT,
  product_name      TEXT,
  supplier_name     TEXT,
  issue_description TEXT NOT NULL,
  resolution_type   TEXT NOT NULL DEFAULT 'swap_new'
                    CHECK (resolution_type IN ('swap_new', 'repair', 'refund')),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'courier_dispatched', 'swapped', 'resolved', 'rejected')),
  driver_id         TEXT,
  driver_name       TEXT,
  driver_phone      TEXT,
  swap_otp          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sav_tickets_status ON public.sav_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_order  ON public.sav_tickets(order_id);

COMMENT ON TABLE public.sav_tickets IS
  'Tickets après-vente. Contient des données personnelles client (nom, téléphone) : aucune policy publique, lecture/écriture par service_role uniquement.';

-- Même politique que orders/profiles : rien de public. Les tickets portent
-- nom, téléphone et adresse implicite du client.
ALTER TABLE public.sav_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public sav access" ON public.sav_tickets;
DROP POLICY IF EXISTS "sav service only" ON public.sav_tickets;
