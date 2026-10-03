-- ═══════════════════════════════════════════════════════════════════════════
-- Vitrine de la boutique : rayons personnalisés, annonce datée, adresse à
-- l'enseigne (chantier « Ma boutique », lot 6, 2026-10-03)
--
-- C'est le SEUL fichier SQL du chantier boutique. Ce qu'il active :
--   1. stores.reglages : les réglages de vitrine choisis par le propriétaire.
--      Dès qu'il est exécuté, le revendeur voit apparaître :
--        • la tuile « Rayons » sur sa boutique et la page « Mes rayons »
--          (8 rayons maison au plus, noms de 24 caractères, affichés avant les
--          rayons automatiques, dans l'ordre qu'il choisit) ;
--        • le champ « Annonce sur ma boutique » dans « Personnaliser » (un
--          message affiché jusqu'à une date, 14 jours au plus, sans prix ni
--          pourcentage).
--   2. store_slug_aliases et changer_adresse_boutique : la base du changement
--      d'adresse UNIQUE à l'enseigne (décision du fondateur : oui, une seule
--      fois, l'ancienne adresse redirige). L'écran viendra au lot 8 ; tant que
--      la fonction n'est pas appelée, l'adresse actuelle reste la seule.
--
-- Le code fonctionne AVANT ce fichier : rayons personnalisés, annonce datée et
-- changement d'adresse restent simplement invisibles (ni tuile, ni champ, ni
-- écran « en panne »), et la vitrine garde ses rayons automatiques.
--
-- Coups de cœur, ordre des articles, partage suivi, visites, statistiques et
-- annonce aux abonnés n'ont PAS besoin de ce fichier.
--
-- Aucune donnée existante modifiée : une colonne ajoutée avec une valeur par
-- défaut constante (la table n'est pas réécrite), une table et une fonction
-- nouvelles. Aucune table d'articles n'est touchée. Sans risque à relancer.
-- À exécuter une fois dans Supabase › SQL Editor (d'abord sur la copie locale
-- isolée, puis en production), suivi des 4 vérifications en bas de fichier.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Réglages de vitrine choisis par le propriétaire (rayons, annonce datée).
--    Une colonne JSON par boutique : vaut pour la principale ET les boutiques Pro.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS reglages JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stores_reglages_objet' AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores ADD CONSTRAINT stores_reglages_objet
      CHECK (jsonb_typeof(reglages) = 'object' AND pg_column_size(reglages) <= 16384);
  END IF;
END $$;

COMMENT ON COLUMN public.stores.reglages IS
  'Vitrine choisie par le propriétaire : rayons [{cle, nom, ids}] (8 max), annonce {texte, fin} (14 jours max). Validé par src/lib/boutique-reglages.ts, écrit seulement par le serveur (service_role).';

-- 2. Anciennes adresses : changement d'adresse UNIQUE (lot 8, sur décision du fondateur).
--    Le slug actuel reste la seule adresse tant que la fonction n'est pas appelée.
CREATE TABLE IF NOT EXISTS public.store_slug_aliases (
  slug       TEXT PRIMARY KEY CHECK (slug = lower(slug)),
  store_id   TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_slug_aliases_store ON public.store_slug_aliases (store_id);
ALTER TABLE public.store_slug_aliases ENABLE ROW LEVEL SECURITY;
-- ⚠️ Sur Supabase, `REVOKE ... FROM PUBLIC` ne suffit pas : anon et authenticated doivent être nommés.
REVOKE ALL ON public.store_slug_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.store_slug_aliases TO service_role;

CREATE OR REPLACE FUNCTION public.changer_adresse_boutique(p_store_id TEXT, p_owner_id TEXT, p_nouveau TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ancien  TEXT;
  v_nouveau TEXT := lower(btrim(p_nouveau));
BEGIN
  IF v_nouveau IS NULL OR v_nouveau !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_nouveau) NOT BETWEEN 3 AND 50 THEN
    RETURN 'invalide';
  END IF;
  SELECT lower(slug) INTO v_ancien FROM public.stores
   WHERE id = p_store_id AND owner_id = p_owner_id
   FOR UPDATE;
  IF v_ancien IS NULL THEN RETURN 'introuvable'; END IF;
  IF v_ancien = v_nouveau THEN RETURN 'identique'; END IF;
  IF EXISTS (SELECT 1 FROM public.store_slug_aliases WHERE store_id = p_store_id) THEN RETURN 'deja_change'; END IF;
  IF EXISTS (SELECT 1 FROM public.stores WHERE lower(slug) = v_nouveau)
     OR EXISTS (SELECT 1 FROM public.store_slug_aliases WHERE slug = v_nouveau) THEN
    RETURN 'pris';
  END IF;
  INSERT INTO public.store_slug_aliases (slug, store_id) VALUES (v_ancien, p_store_id);
  UPDATE public.stores SET slug = v_nouveau, updated_at = NOW() WHERE id = p_store_id;
  RETURN 'ok';
EXCEPTION WHEN unique_violation THEN
  RETURN 'pris';
END $$;
REVOKE ALL ON FUNCTION public.changer_adresse_boutique(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.changer_adresse_boutique(TEXT, TEXT, TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Vérification 1 (attendu : 1 ligne) :
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'reglages';
-- Vérification 2 (attendu : store_slug_aliases) : SELECT to_regclass('public.store_slug_aliases');
-- Vérification 3 (attendu : false | false) :
--   SELECT has_function_privilege('anon', 'public.changer_adresse_boutique(text,text,text)', 'EXECUTE'),
--          has_function_privilege('authenticated', 'public.changer_adresse_boutique(text,text,text)', 'EXECUTE');
-- Vérification 4 (attendu : 0) : SELECT count(*) FROM public.store_slug_aliases a JOIN public.stores s ON lower(s.slug) = a.slug;
--
-- Retour arrière (les rayons et annonces enregistrés seraient perdus) :
--   DROP FUNCTION IF EXISTS public.changer_adresse_boutique(TEXT, TEXT, TEXT);
--   DROP TABLE IF EXISTS public.store_slug_aliases;
--   ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_reglages_objet;
--   ALTER TABLE public.stores DROP COLUMN IF EXISTS reglages;
