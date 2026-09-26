-- ═══════════════════════════════════════════════════════════════════════════
-- Compte client — C2 (2026-09-26) : favoris et destinataires enregistrés.
--
--   • favoris : produits gardés par un compte (un produit une fois) ;
--   • destinataires : personnes pour qui le client commande souvent (lui-même
--     à une autre adresse, un proche) — nom, téléphone, quartier, repère.
--     20 au plus par compte (contrôlé par le serveur).
-- Lecture et écriture par le serveur uniquement (aucune policy).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.favoris (
  profile_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, product_id)
);
CREATE INDEX IF NOT EXISTS favoris_profil_idx ON public.favoris (profile_id, created_at DESC);
ALTER TABLE public.favoris ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.destinataires (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL,
  nom        TEXT NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 80),
  telephone  TEXT NOT NULL CHECK (length(regexp_replace(telephone, '\D', '', 'g')) BETWEEN 8 AND 15),
  ville      TEXT NOT NULL DEFAULT 'Bamako',
  quartier   TEXT,
  repere     TEXT CHECK (repere IS NULL OR length(repere) <= 200),
  relation   TEXT CHECK (relation IS NULL OR length(relation) <= 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS destinataires_profil_idx ON public.destinataires (profile_id, created_at DESC);
ALTER TABLE public.destinataires ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
