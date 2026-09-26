-- ═══════════════════════════════════════════════════════════════════════════
-- Protection Suguba — lot 1 « Trésorerie » (2026-09-26)
--
-- 1. Un gain de vente payée en ESPÈCES n'est retirable qu'une fois l'argent
--    reçu par Suguba (commande rattachée à un versement de caisse). Décision
--    du 2026-09-26 : « elle attend les fonds ». Seules les commandes livrées
--    après l'exécution de ce SQL sont concernées : les anciennes gardent la
--    règle d'avant.
-- 2. L'admin peut AVANCER un gain qui attend les fonds, avec un motif : la
--    trace (qui, quand, pourquoi) reste sur la commission.
-- 3. Paiements reçus des campagnes et sponsorisations : un HISTORIQUE
--    (paiements_recus) remplace la saisie d'un total qui s'écrasait. Une même
--    référence de paiement ne sert qu'une fois ; une correction = annuler un
--    paiement avec un motif, jamais l'effacer. Le total reçu est recalculé
--    par la base, et ne peut plus être écrit directement.
-- 4. Demande qualifiée (lot 3) : une demande faite avec le numéro du
--    revendeur lui-même n'est jamais payée.
--
-- Prérequis : caisse livreurs, campagnes (2b), sponsorisations-paiement,
-- campagnes-resultat (lot 3).
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Gains qui attendent les fonds ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tresorerie_reglages (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  fonds_requis_depuis TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.tresorerie_reglages (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tresorerie_reglages ENABLE ROW LEVEL SECURITY;

-- Vrai si l'argent de cette commande est bien chez Suguba (ou n'a pas à y
-- arriver par la caisse : paiement Mobile Money, commande ancienne, ou
-- livraison sans collecteur — forcée par l'admin, qui a constaté l'argent).
CREATE OR REPLACE FUNCTION public.fonds_recus(p_order_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT o.payment_method = 'mobile_money'
        OR o.cash_remittance_id IS NOT NULL
        OR o.assigned_driver_id IS NULL
        OR o.delivered_at IS NULL
        OR o.delivered_at < (SELECT fonds_requis_depuis FROM public.tresorerie_reglages WHERE id = 1)
      FROM public.orders o WHERE o.id = p_order_id
  ), true);
$$;
REVOKE ALL ON FUNCTION public.fonds_recus(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.liberer_commissions_echues()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_liberees INTEGER;
BEGIN
  UPDATE public.commissions c
     SET status = 'available',
         available_at = NOW()
   WHERE c.status = 'locked'
     AND c.unlock_at IS NOT NULL
     AND c.unlock_at <= NOW()
     AND (c.order_id IS NULL OR public.fonds_recus(c.order_id));

  GET DIAGNOSTICS v_liberees = ROW_COUNT;
  RETURN v_liberees;
END;
$$;

-- Avance décidée par l'admin (gain retirable avant l'arrivée des fonds).
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS avance_motif TEXT;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS avance_par TEXT;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS avance_le TIMESTAMPTZ;

-- ── 2. Historique des paiements reçus ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paiements_recus (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cible            TEXT NOT NULL CHECK (cible IN ('campagne', 'sponsorisation')),
  cible_id         TEXT NOT NULL,
  montant          NUMERIC(12, 2) NOT NULL CHECK (montant > 0 AND montant <= 100000000),
  reference        TEXT NOT NULL CHECK (length(trim(reference)) >= 3),
  -- « OM 123-456 » et « om123456 » sont la même transaction.
  reference_norm   TEXT GENERATED ALWAYS AS (upper(regexp_replace(reference, '[^A-Za-z0-9]', '', 'g'))) STORED,
  note             TEXT,
  recu_par         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  annule_le        TIMESTAMPTZ,
  annule_par       TEXT,
  motif_annulation TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS paiements_recus_reference_unique
  ON public.paiements_recus (reference_norm) WHERE annule_le IS NULL;
CREATE INDEX IF NOT EXISTS paiements_recus_cible_idx ON public.paiements_recus (cible, cible_id, created_at);
ALTER TABLE public.paiements_recus ENABLE ROW LEVEL SECURITY;

-- Le total reçu n'est plus écrit à la main : seule la base le recalcule
-- depuis l'historique (pg_trigger_depth > 1 = écriture venue du trigger).
CREATE OR REPLACE FUNCTION public.refuser_total_recu_direct()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'PAIEMENT_PAR_HISTORIQUE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recalculer_total_recu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cible TEXT := COALESCE(NEW.cible, OLD.cible);
  v_id    TEXT := COALESCE(NEW.cible_id, OLD.cible_id);
  v_total NUMERIC;
  v_der   public.paiements_recus%ROWTYPE;
BEGIN
  SELECT COALESCE(sum(montant), 0) INTO v_total FROM public.paiements_recus
   WHERE cible = v_cible AND cible_id = v_id AND annule_le IS NULL;
  SELECT * INTO v_der FROM public.paiements_recus
   WHERE cible = v_cible AND cible_id = v_id AND annule_le IS NULL ORDER BY created_at DESC LIMIT 1;
  IF v_cible = 'campagne' THEN
    UPDATE public.missions SET budget_recu = v_total, budget_recu_le = v_der.created_at,
           budget_reference = v_der.reference, budget_recu_par = v_der.recu_par
     WHERE id = v_id;
  ELSE
    UPDATE public.sponsorships SET paid_amount = v_total, paid_at = v_der.created_at,
           payment_reference = v_der.reference, paid_by = v_der.recu_par
     WHERE id = v_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS paiements_recus_total ON public.paiements_recus;
CREATE TRIGGER paiements_recus_total
  AFTER INSERT OR UPDATE ON public.paiements_recus
  FOR EACH ROW EXECUTE FUNCTION public.recalculer_total_recu();

-- Un paiement ne se supprime pas et ne se modifie pas : seule l'annulation
-- (une fois, avec un motif) est permise.
CREATE OR REPLACE FUNCTION public.proteger_paiement_recu()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PAIEMENT_NON_SUPPRIMABLE' USING ERRCODE = 'P0001'; END IF;
  IF OLD.annule_le IS NOT NULL
     OR NEW.montant IS DISTINCT FROM OLD.montant OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.cible IS DISTINCT FROM OLD.cible OR NEW.cible_id IS DISTINCT FROM OLD.cible_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.recu_par IS DISTINCT FROM OLD.recu_par
     OR NEW.annule_le IS NULL OR length(trim(COALESCE(NEW.motif_annulation, ''))) < 3 THEN
    RAISE EXCEPTION 'PAIEMENT_NON_MODIFIABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS paiements_recus_proteges ON public.paiements_recus;
CREATE TRIGGER paiements_recus_proteges
  BEFORE UPDATE OR DELETE ON public.paiements_recus
  FOR EACH ROW EXECUTE FUNCTION public.proteger_paiement_recu();

-- Reprise de l'existant : chaque total déjà saisi devient un paiement de
-- l'historique (référence d'origine gardée dans la note).
INSERT INTO public.paiements_recus (cible, cible_id, montant, reference, note, recu_par, created_at)
SELECT 'campagne', m.id, m.budget_recu, 'REPRISE-CAMPAGNE-' || m.id,
       'Total saisi avant l’historique' || COALESCE(' · réf. ' || m.budget_reference, ''), m.budget_recu_par, COALESCE(m.budget_recu_le, now())
  FROM public.missions m
 WHERE COALESCE(m.budget_recu, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.paiements_recus p WHERE p.cible = 'campagne' AND p.cible_id = m.id);
INSERT INTO public.paiements_recus (cible, cible_id, montant, reference, note, recu_par, created_at)
SELECT 'sponsorisation', s.id, s.paid_amount, 'REPRISE-SPONSO-' || s.id,
       'Total saisi avant l’historique' || COALESCE(' · réf. ' || s.payment_reference, ''), s.paid_by, COALESCE(s.paid_at, now())
  FROM public.sponsorships s
 WHERE COALESCE(s.paid_amount, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM public.paiements_recus p WHERE p.cible = 'sponsorisation' AND p.cible_id = s.id);

-- Verrou posé APRÈS la reprise.
DROP TRIGGER IF EXISTS missions_total_recu_par_historique ON public.missions;
CREATE TRIGGER missions_total_recu_par_historique
  BEFORE UPDATE OF budget_recu ON public.missions
  FOR EACH ROW WHEN (NEW.budget_recu IS DISTINCT FROM OLD.budget_recu)
  EXECUTE FUNCTION public.refuser_total_recu_direct();
DROP TRIGGER IF EXISTS sponsorships_total_recu_par_historique ON public.sponsorships;
CREATE TRIGGER sponsorships_total_recu_par_historique
  BEFORE UPDATE OF paid_amount ON public.sponsorships
  FOR EACH ROW WHEN (NEW.paid_amount IS DISTINCT FROM OLD.paid_amount)
  EXECUTE FUNCTION public.refuser_total_recu_direct();

-- ── 3. Demande qualifiée : pas avec le numéro du revendeur ──────────────────
CREATE OR REPLACE FUNCTION public.resultats_demande(p_product_id TEXT, p_reseller_id TEXT, p_phone TEXT, p_origine TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_m RECORD;
  v_tel TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF p_product_id IS NULL OR p_reseller_id IS NULL OR length(v_tel) < 8 THEN RETURN; END IF;
  -- Le revendeur qui se fait une demande à lui-même n'apporte aucun client.
  IF EXISTS (SELECT 1 FROM public.profiles
              WHERE id = p_reseller_id AND right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 8) = right(v_tel, 8)) THEN
    RETURN;
  END IF;
  FOR v_m IN
    SELECT m.id FROM public.missions m
      JOIN public.mission_participants p ON p.mission_id = m.id AND p.reseller_id = p_reseller_id AND p.status = 'joined'
     WHERE m.mission_type = 'demande_qualifiee' AND m.status = 'active' AND m.product_id = p_product_id
  LOOP
    PERFORM public.enregistrer_resultat_campagne(v_m.id, p_reseller_id, 'demande', 'client:' || md5(right(v_tel, 8)), p_origine, NULL);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'resultats_demande: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.resultats_demande(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
