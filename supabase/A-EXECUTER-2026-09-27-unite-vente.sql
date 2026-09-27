-- ═══════════════════════════════════════════════════════════════════════════
-- Unité de vente (V2 vue client, 2026-09-27).
--
-- Le prix d'un produit vaut pour quoi ? une unité, un lot de 4, un carton de
-- 12, un kilo… Affiché à côté du prix (« 36 500 F / lot de 4 »).
--   unite_vente : unite | lot | paquet | carton | paire | kg | litre | metre
--                 (NULL = pas encore renseignée : rien n'est affiché)
--   contenu_lot : nombre d'articles d'un lot (obligatoire), d'un paquet ou
--                 d'un carton (facultatif)
-- Colonnes lues par le serveur (/api/catalogue) : pas de GRANT à la clé
-- publique, comme les autres colonnes récentes du catalogue.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unite_vente TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS contenu_lot INTEGER;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unite_vente_check;
-- COALESCE : un CHECK dont le résultat est NULL est ACCEPTÉ par PostgreSQL ;
-- sans lui, un « lot » sans contenu passerait.
ALTER TABLE public.products ADD CONSTRAINT products_unite_vente_check CHECK (COALESCE(
  (unite_vente IS NULL AND contenu_lot IS NULL)
  OR (unite_vente = 'lot' AND contenu_lot IS NOT NULL AND contenu_lot BETWEEN 2 AND 10000)
  OR (unite_vente IN ('paquet', 'carton') AND (contenu_lot IS NULL OR contenu_lot BETWEEN 2 AND 10000))
  OR (unite_vente IN ('unite', 'paire', 'kg', 'litre', 'metre') AND contenu_lot IS NULL),
  false));

NOTIFY pgrst, 'reload schema';
