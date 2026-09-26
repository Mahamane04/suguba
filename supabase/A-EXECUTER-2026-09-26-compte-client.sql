-- ═══════════════════════════════════════════════════════════════════════════
-- Compte client — C1 (2026-09-26)
--
-- Acheter reste possible SANS compte. Le compte client, facultatif, permet de
-- retrouver ses commandes et ses devis sur n'importe quel téléphone :
--   • orders.customer_profile_id / quote_requests.customer_profile_id : le
--     compte de l'ACHETEUR (jamais le revendeur qui saisit une vente pour son
--     client, jamais un admin) ;
--   • acces_cles : clés de reçu ou de devis délivrées au propriétaire du
--     compte sur un nouveau téléphone (seul leur hash est gardé) ;
--   • une ancienne commande n'est rattachée qu'avec la clé de son reçu
--     (preuve d'accès), jamais sur la seule foi d'un numéro de téléphone.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_profile_id TEXT;
CREATE INDEX IF NOT EXISTS orders_customer_profile_idx ON public.orders (customer_profile_id, created_at DESC)
  WHERE customer_profile_id IS NOT NULL;

ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS customer_profile_id TEXT;
CREATE INDEX IF NOT EXISTS quote_requests_customer_profile_idx ON public.quote_requests (customer_profile_id, created_at DESC)
  WHERE customer_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.acces_cles (
  key_hash   TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('commande', 'devis')),
  ref        TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acces_cles_ref_idx ON public.acces_cles (type, ref);
-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.acces_cles ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
