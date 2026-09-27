-- ═══════════════════════════════════════════════════════════════════════════
-- Unité de vente v2 (2026-09-27) — habitudes des marchés de Bamako.
--
--   • unités : pièce, paire, douzaine, lot, paquet, carton, boîte ; mètre,
--     yard, pagne (wax 6 yards) ; m², kg, tonne, litre ; sac, bidon, rouleau,
--     barre, feuille, voyage (sable, gravier) ;
--   • contenu avec sa mesure et décimales : « sac de 50 kg », « carton de
--     1,44 m² », « pagne de 6 yards », « rouleau de 100 m » ;
--   • quantité minimale (« minimum 2 m ») ; les quantités restent entières.
--
-- Remplace la contrainte de A-EXECUTER-2026-09-27-unite-vente.sql (à exécuter
-- APRÈS lui). Les lots déjà renseignés sont repris (contenu_lot → contenu).
-- Mêmes règles que src/lib/unite-vente.ts.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unite_vente TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS contenu_lot INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS contenu_valeur NUMERIC(12,3);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS contenu_mesure TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantite_min INTEGER;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unite_vente_check;

UPDATE public.products
   SET contenu_valeur = contenu_lot, contenu_mesure = 'piece'
 WHERE contenu_lot IS NOT NULL AND contenu_valeur IS NULL;
UPDATE public.products SET contenu_lot = NULL WHERE contenu_lot IS NOT NULL;

CREATE OR REPLACE FUNCTION public.unite_vente_valide(u TEXT, v NUMERIC, m TEXT, mini INTEGER)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (mini IS NULL OR mini BETWEEN 2 AND 1000)
    AND CASE
      WHEN u IS NULL THEN v IS NULL AND m IS NULL
      WHEN u NOT IN ('unite','paire','douzaine','lot','paquet','carton','boite','metre','yard','pagne',
                     'm2','kg','tonne','litre','sac','bidon','rouleau','barre','feuille','voyage') THEN false
      WHEN v IS NULL THEN m IS NULL AND u <> 'lot'
      ELSE v > 0 AND v <= 100000
        AND (m <> 'piece' OR (v = trunc(v) AND v >= 2))
        AND m = ANY (CASE u
          WHEN 'lot' THEN ARRAY['piece']
          WHEN 'paquet' THEN ARRAY['piece','kg','l']
          WHEN 'carton' THEN ARRAY['piece','m2','kg','l']
          WHEN 'boite' THEN ARRAY['piece','kg','l']
          WHEN 'pagne' THEN ARRAY['yard','m']
          WHEN 'sac' THEN ARRAY['kg']
          WHEN 'bidon' THEN ARRAY['l']
          WHEN 'rouleau' THEN ARRAY['m','m2']
          WHEN 'barre' THEN ARRAY['m']
          WHEN 'feuille' THEN ARRAY['m2']
          WHEN 'voyage' THEN ARRAY['m3']
          ELSE ARRAY[]::TEXT[] END)
    END
$$;

-- COALESCE : un CHECK dont le résultat est NULL est ACCEPTÉ par PostgreSQL.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unite_vente_v2_check;
ALTER TABLE public.products ADD CONSTRAINT products_unite_vente_v2_check CHECK (
  COALESCE(public.unite_vente_valide(unite_vente, contenu_valeur, contenu_mesure, quantite_min), false)
  AND contenu_lot IS NULL
);

NOTIFY pgrst, 'reload schema';
