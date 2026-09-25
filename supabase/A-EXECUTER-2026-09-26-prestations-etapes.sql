-- ═══════════════════════════════════════════════════════════════════════════
-- Prestations à étapes (2026-09-26, lot 1c « Offres & réalisation »)
--
-- Une offre remise par le fournisseur (installation, pose, formation…) peut
-- suivre un parcours : visite technique, rendez-vous, matériel remis,
-- installation, prise en main.
--   • le fournisseur DÉCLARE chaque étape terminée, avec sa preuve (note,
--     date, photos) ;
--   • le client la VALIDE depuis son reçu, ou la conteste ;
--   • la réception finale reste le scan du reçu QR : elle clôt la commande
--     et débloque les gains, et elle est REFUSÉE tant qu'une étape n'est pas
--     validée (garde-fou en base, même si l'application était contournée).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- Étapes choisies par le fournisseur pour son offre (liste de clés, dans l'ordre).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS etapes JSONB;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_etapes_check;
ALTER TABLE public.products ADD CONSTRAINT products_etapes_check
  CHECK (etapes IS NULL OR jsonb_typeof(etapes) = 'array');

CREATE TABLE IF NOT EXISTS public.order_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  cle             TEXT NOT NULL CHECK (cle IN ('visite', 'rendez_vous', 'materiel', 'installation', 'prise_en_main')),
  statut          TEXT NOT NULL DEFAULT 'a_faire'
                  CHECK (statut IN ('a_faire', 'declaree', 'validee', 'contestee')),
  note            TEXT,
  date_prevue     TIMESTAMPTZ,
  photos          INTEGER NOT NULL DEFAULT 0 CHECK (photos BETWEEN 0 AND 3),
  declared_at     TIMESTAMPTZ,
  validated_at    TIMESTAMPTZ,
  validated_by    TEXT CHECK (validated_by IS NULL OR validated_by IN ('client', 'admin')),
  admin_note      TEXT,
  contest_reason  TEXT,
  contested_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);
CREATE INDEX IF NOT EXISTS order_steps_statut_idx ON public.order_steps (statut, declared_at);

-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.order_steps ENABLE ROW LEVEL SECURITY;

-- Garde-fou : pas de réception finale (livrée) avec une étape non validée.
CREATE OR REPLACE FUNCTION public.refuser_livraison_etapes_ouvertes()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND EXISTS (SELECT 1 FROM public.order_steps s WHERE s.order_id = NEW.id AND s.statut <> 'validee') THEN
    RAISE EXCEPTION 'ETAPES_NON_VALIDEES' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_etapes_avant_livraison ON public.orders;
CREATE TRIGGER orders_etapes_avant_livraison
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refuser_livraison_etapes_ouvertes();

NOTIFY pgrst, 'reload schema';
