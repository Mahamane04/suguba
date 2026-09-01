-- ============================================================================
-- SUGUBA — TABLE LIVREURS RÉELLE
-- ============================================================================
-- Même principe que migration-suppliers.sql : détails métier réels, statut
-- du dossier porté par profile_roles (role='driver'), pas dupliqué ici.
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.drivers (
  profile_id        TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type       TEXT,
  license_plate      TEXT,
  zone               TEXT,
  id_document_number TEXT,
  active_status      BOOLEAN NOT NULL DEFAULT false,
  total_deliveries   INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.drivers IS
  'Détails métier du dossier livreur. Le statut du dossier vit dans profile_roles (role=driver), pas ici.';

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public drivers access" ON public.drivers;
DROP POLICY IF EXISTS "drivers service only" ON public.drivers;
