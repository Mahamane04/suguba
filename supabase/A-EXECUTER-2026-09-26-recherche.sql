-- ═══════════════════════════════════════════════════════════════════════════
-- Recherche R1 (2026-09-26) : une seule recherche produits, côté serveur.
--
--   • insensible aux accents et aux majuscules (« refrigerateur » trouve
--     « Réfrigérateur ») grâce à l'extension unaccent ;
--   • tolérante aux fautes de frappe (« samsumg ») grâce à pg_trgm ;
--   • cherche dans le nom, la catégorie et la description ;
--   • dictionnaire de synonymes géré par l'admin (« frigo » ↔ « refrigerateur »).
--
-- La fonction n'est appelable que par le serveur (service_role).
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Synonymes : un mot tapé par les clients → le mot du catalogue. Les deux
-- sens sont cherchés. Stockés sans accents et en minuscules.
CREATE TABLE IF NOT EXISTS public.recherche_synonymes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terme      TEXT NOT NULL CHECK (terme ~ '^[a-z0-9]{2,30}$'),
  equivalent TEXT NOT NULL CHECK (equivalent ~ '^[a-z0-9]([a-z0-9 -]{0,58}[a-z0-9])?$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (terme, equivalent)
);
ALTER TABLE public.recherche_synonymes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.recherche_synonymes (terme, equivalent) VALUES
  ('frigo', 'refrigerateur'), ('congelo', 'congelateur'), ('clim', 'climatiseur'),
  ('ventilo', 'ventilateur'), ('tele', 'television'), ('tv', 'television'),
  ('televiseur', 'television'), ('ordi', 'ordinateur'), ('pc', 'ordinateur'),
  ('portable', 'telephone'), ('smartphone', 'telephone'), ('micro', 'micro-ondes')
ON CONFLICT (terme, equivalent) DO NOTHING;

-- Les extensions peuvent déjà exister dans un autre schéma (public) : on
-- construit les fonctions avec le schéma réel de chacune.
DO $$
DECLARE
  s_unaccent TEXT := (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent');
  s_trgm     TEXT := (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm');
BEGIN
  -- unaccent() est STABLE : ce wrapper fige le dictionnaire pour pouvoir
  -- servir dans un index (même piège qu'array_to_string).
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.sans_accents(t TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $q$ SELECT lower(%1$I.unaccent(%2$L::regdictionary, coalesce(t, ''))) $q$
  $f$, s_unaccent, s_unaccent || '.unaccent');

  EXECUTE format($f$
    CREATE INDEX IF NOT EXISTS products_recherche_trgm ON public.products
    USING gin (public.sans_accents(name || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) %I.gin_trgm_ops)
  $f$, s_trgm);

  -- Chaque mot utile de la requête (ou l'un de ses synonymes) doit être
  -- trouvé dans le produit. Note par mot : début de mot du nom 1, ailleurs
  -- dans le nom 0,8, catégorie ou description 0,6, faute de frappe proche
  -- 0,3 à 0,5. Le score est la moyenne des notes.
  EXECUTE format($f$
    CREATE OR REPLACE FUNCTION public.rechercher_produits(p_q TEXT, p_limite INTEGER DEFAULT 60)
    RETURNS TABLE (product_id TEXT, score REAL)
    LANGUAGE sql STABLE
    SET search_path = public, %I
    AS $body$
      WITH mots AS (
        SELECT DISTINCT m FROM regexp_split_to_table(public.sans_accents(left(coalesce(p_q, ''), 80)), '[^a-z0-9]+') AS m
        WHERE length(m) >= 2
          AND m <> ALL (ARRAY['de','du','des','la','le','les','un','une','et','en','pour','avec','au','aux'])
      ),
      formes AS (
        SELECT m, m AS forme FROM mots
        UNION SELECT mots.m, s.equivalent FROM mots JOIN public.recherche_synonymes s ON s.terme = mots.m
        UNION SELECT mots.m, s.terme FROM mots JOIN public.recherche_synonymes s ON s.equivalent = mots.m
      ),
      candidats AS (
        SELECT p.id::text AS id,
               public.sans_accents(p.name) AS nom,
               public.sans_accents(p.name || ' ' || coalesce(p.category, '') || ' ' || coalesce(p.description, '')) AS doc
        FROM public.products p
        WHERE p.status = 'approved' AND p.public_price > 0
      ),
      notes AS (
        SELECT c.id, f.m, max(CASE
            WHEN c.nom LIKE f.forme || '%%' OR c.nom LIKE '%%' || ' ' || f.forme || '%%' THEN 1.0
            WHEN c.nom LIKE '%%' || f.forme || '%%' THEN 0.8
            WHEN c.doc LIKE '%%' || f.forme || '%%' THEN 0.6
            WHEN length(f.forme) >= 4 AND word_similarity(f.forme, c.nom) >= 0.5 THEN 0.5 * word_similarity(f.forme, c.nom)
            WHEN length(f.forme) >= 4 AND word_similarity(f.forme, c.doc) >= 0.6 THEN 0.3
            ELSE 0 END) AS note
        FROM candidats c CROSS JOIN formes f
        GROUP BY c.id, f.m
      )
      SELECT id, avg(note)::real
      FROM notes
      GROUP BY id
      HAVING (SELECT count(*) FROM mots) > 0
         AND count(*) FILTER (WHERE note > 0) = (SELECT count(*) FROM mots)
      ORDER BY 2 DESC, 1
      LIMIT least(greatest(coalesce(p_limite, 60), 1), 200)
    $body$
  $f$, s_trgm);
END $$;

REVOKE ALL ON FUNCTION public.rechercher_produits(TEXT, INTEGER) FROM PUBLIC;
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.rechercher_produits(TEXT, INTEGER) FROM anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.rechercher_produits(TEXT, INTEGER) TO service_role';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
