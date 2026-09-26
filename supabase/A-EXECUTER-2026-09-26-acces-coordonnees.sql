-- ═══════════════════════════════════════════════════════════════════════════
-- Protection Suguba — lot 2 « Coordonnées par dossier » (2026-09-26)
--
-- Journal de qui a reçu les coordonnées de quel dossier : un livreur pour
-- une course en cours, un fournisseur pour une remise prise en charge ou une
-- demande de devis à qualifier. Une ligne par personne, dossier et jour.
-- Sert à repérer, par exemple, un fournisseur qui consulte beaucoup de
-- demandes sans jamais y répondre.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.acces_coordonnees (
  id          BIGSERIAL PRIMARY KEY,
  personne_id TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('driver', 'supplier')),
  raison      TEXT NOT NULL CHECK (raison IN ('course', 'remise', 'devis')),
  dossier     TEXT NOT NULL,
  jour        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (personne_id, dossier, jour)
);
CREATE INDEX IF NOT EXISTS acces_coordonnees_jour_idx ON public.acces_coordonnees (jour DESC, personne_id);

-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.acces_coordonnees ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
