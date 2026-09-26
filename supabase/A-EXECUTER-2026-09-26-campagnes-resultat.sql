-- ═══════════════════════════════════════════════════════════════════════════
-- Rémunération au résultat (2026-09-26, lot 3)
--
-- Deux nouveaux types de campagne fournisseur, payées à l'unité :
--   • « visite_qualifiee »  : un visiteur venu par le lien d'un revendeur,
--     resté au moins 20 s sur le produit et qui a touché l'écran ;
--   • « demande_qualifiee » : une demande de devis à laquelle le fournisseur
--     a répondu, ou une commande confirmée par l'appel Suguba.
--
-- Règles (décidées le 2026-09-26) :
--   • interrupteur général « remunerationResultat » (réglages du réseau),
--     DÉSACTIVÉ par défaut : rien n'est payé tant que l'admin ne l'active pas ;
--   • budget payé d'avance ; chaque résultat le consomme ; la campagne se met
--     en pause toute seule quand le reste ne couvre plus un résultat ;
--   • un visiteur ou un client ne compte qu'UNE fois par campagne ;
--   • 50 visites payées au plus par revendeur, par campagne et par jour ;
--   • Suguba garde 20 % du prix, le revendeur reçoit 80 % ;
--   • le gain reste en attente 7 jours (commission « locked ») ; un résultat
--     suspect ou contesté par le fournisseur (48 h) attend la décision de
--     l'admin (commission « pending ») ; un résultat annulé rend son prix au
--     budget de la campagne.
--
-- Prérequis : SQL des campagnes (lot 2b) et des devis (lot 1b).
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Types de campagne et budget consommé ─────────────────────────────────
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_mission_type_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_mission_type_check
  CHECK (mission_type IN ('share', 'click', 'sale', 'referral', 'post', 'view', 'visite_qualifiee', 'demande_qualifiee'));

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS budget_consomme NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_budget_consomme_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_budget_consomme_check CHECK (budget_consomme >= 0);

-- Activation : une campagne au résultat doit pouvoir payer au moins un
-- résultat ; les autres campagnes fournisseur gardent la règle du lot 2b.
CREATE OR REPLACE FUNCTION public.refuser_campagne_non_reglee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF NEW.mission_type IN ('visite_qualifiee', 'demande_qualifiee') THEN
      IF COALESCE(NEW.budget_recu, 0) - COALESCE(NEW.budget_consomme, 0) < GREATEST(COALESCE(NEW.reward_amount, 0), 1) THEN
        RAISE EXCEPTION 'BUDGET_NON_REGLE' USING ERRCODE = 'P0001';
      END IF;
    ELSIF NEW.supplier_id IS NOT NULL
       AND COALESCE(NEW.budget_recu, 0) < COALESCE(NEW.reward_amount, 0) * COALESCE(NEW.max_participants, 0) THEN
      RAISE EXCEPTION 'BUDGET_NON_REGLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ── 2. Mesure des visites (avec ou sans campagne) ───────────────────────────
-- Sert la page admin « Qualité des mesures » : on juge la fiabilité AVANT
-- d'activer le paiement. Aucune IP : empreintes salées seulement.
CREATE TABLE IF NOT EXISTS public.visites_mesurees (
  id           BIGSERIAL PRIMARY KEY,
  product_id   TEXT NOT NULL,
  reseller_id  TEXT NOT NULL,
  visiteur     TEXT NOT NULL,
  reseau       TEXT,
  etat         TEXT NOT NULL DEFAULT 'ouverte' CHECK (etat IN ('ouverte', 'qualifiee', 'robot')),
  jour         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualifiee_le TIMESTAMPTZ,
  UNIQUE (product_id, reseller_id, visiteur, jour)
);
CREATE INDEX IF NOT EXISTS visites_mesurees_jour_idx ON public.visites_mesurees (jour DESC, reseller_id);
ALTER TABLE public.visites_mesurees ENABLE ROW LEVEL SECURITY;

-- ── 3. Résultats payés ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campagne_resultats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id     TEXT NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  reseller_id    TEXT NOT NULL,
  genre          TEXT NOT NULL CHECK (genre IN ('visite', 'demande')),
  cle            TEXT NOT NULL CHECK (length(cle) BETWEEN 1 AND 200),
  origine        TEXT,
  reseau         TEXT,
  prix           NUMERIC(12, 2) NOT NULL CHECK (prix > 0),
  part_revendeur NUMERIC(12, 2) NOT NULL CHECK (part_revendeur >= 0),
  statut         TEXT NOT NULL DEFAULT 'retenu' CHECK (statut IN ('retenu', 'a_verifier', 'conteste', 'annule')),
  motif          TEXT,
  conteste_le    TIMESTAMPTZ,
  decide_par     TEXT,
  decide_le      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un visiteur, un client : une seule fois par campagne.
  UNIQUE (mission_id, cle)
);
CREATE INDEX IF NOT EXISTS campagne_resultats_statut_idx ON public.campagne_resultats (statut, created_at);
CREATE INDEX IF NOT EXISTS campagne_resultats_revendeur_idx ON public.campagne_resultats (reseller_id, created_at DESC);
ALTER TABLE public.campagne_resultats ENABLE ROW LEVEL SECURITY;

-- ── 4. Enregistrer un résultat (atomique) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.enregistrer_resultat_campagne(
  p_mission_id TEXT, p_reseller_id TEXT, p_genre TEXT, p_cle TEXT, p_origine TEXT, p_reseau TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actif   BOOLEAN;
  v_mission public.missions%ROWTYPE;
  v_prix    NUMERIC;
  v_part    NUMERIC;
  v_statut  TEXT := 'retenu';
  v_id      UUID;
  v_type    TEXT := CASE p_genre WHEN 'visite' THEN 'visite_qualifiee' WHEN 'demande' THEN 'demande_qualifiee' END;
BEGIN
  SELECT COALESCE((valeurs->>'remunerationResultat')::boolean, false) INTO v_actif
    FROM public.reseau_reglages WHERE id = 1;
  IF NOT COALESCE(v_actif, false) THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'desactive');
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF NOT FOUND
     OR v_mission.mission_type IS DISTINCT FROM v_type
     OR v_mission.status <> 'active' OR now() < v_mission.starts_at
     OR (v_mission.ends_at IS NOT NULL AND now() > v_mission.ends_at) THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'mission');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mission_participants
                  WHERE mission_id = p_mission_id AND reseller_id = p_reseller_id AND status = 'joined') THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'participation');
  END IF;

  IF EXISTS (SELECT 1 FROM public.campagne_resultats WHERE mission_id = p_mission_id AND cle = p_cle) THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'deja');
  END IF;

  IF p_genre = 'visite' AND (
    SELECT count(*) FROM public.campagne_resultats
     WHERE mission_id = p_mission_id AND reseller_id = p_reseller_id AND created_at >= date_trunc('day', now())
  ) >= 50 THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'plafond');
  END IF;

  v_prix := v_mission.reward_amount;
  IF v_prix IS NULL OR v_prix <= 0 THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'mission');
  END IF;
  IF COALESCE(v_mission.budget_recu, 0) - v_mission.budget_consomme < v_prix THEN
    UPDATE public.missions SET status = 'paused' WHERE id = p_mission_id;
    RETURN jsonb_build_object('compte', false, 'raison', 'budget');
  END IF;

  -- Beaucoup de visites d'un même réseau pour un même revendeur : l'admin
  -- vérifie avant tout paiement (les opérateurs mobiles partagent des IP,
  -- donc on signale, on ne refuse pas).
  IF p_genre = 'visite' AND p_reseau IS NOT NULL AND (
    SELECT count(*) FROM public.campagne_resultats
     WHERE mission_id = p_mission_id AND reseller_id = p_reseller_id AND reseau = p_reseau
       AND created_at >= now() - interval '24 hours'
  ) >= 5 THEN
    v_statut := 'a_verifier';
  END IF;

  v_part := floor(v_prix * 0.8);
  INSERT INTO public.campagne_resultats (mission_id, reseller_id, genre, cle, origine, reseau, prix, part_revendeur, statut)
  VALUES (p_mission_id, p_reseller_id, p_genre, p_cle, p_origine, p_reseau, v_prix, v_part, v_statut)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'deja');
  END IF;

  UPDATE public.missions
     SET budget_consomme = budget_consomme + v_prix,
         status = CASE WHEN COALESCE(budget_recu, 0) - (budget_consomme + v_prix) < v_prix THEN 'paused' ELSE status END
   WHERE id = p_mission_id;
  UPDATE public.mission_participants SET progress = progress + 1
   WHERE mission_id = p_mission_id AND reseller_id = p_reseller_id;

  IF v_part > 0 THEN
    INSERT INTO public.commissions (reseller_id, amount, status, source, source_ref, label, unlock_at)
    VALUES (p_reseller_id, v_part,
            CASE WHEN v_statut = 'retenu' THEN 'locked' ELSE 'pending' END,
            'campagne', v_id::text,
            left('Campagne : ' || v_mission.title, 120),
            CASE WHEN v_statut = 'retenu' THEN now() + interval '7 days' END)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('compte', true, 'id', v_id, 'statut', v_statut);
END;
$$;
REVOKE ALL ON FUNCTION public.enregistrer_resultat_campagne(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_resultat_campagne(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ── 5. Contester, valider, annuler ──────────────────────────────────────────
--   'contester' : le fournisseur, dans les 48 h (l'appelant vérifie qu'il
--                 possède la campagne) → attend l'admin, gain gelé ;
--   'valider'   : l'admin, sur un résultat suspect ou contesté → gain en
--                 attente jusqu'à 7 jours après le résultat ;
--   'annuler'   : l'admin, tant que le gain n'est pas retirable → gain
--                 annulé, prix rendu au budget de la campagne.
CREATE OR REPLACE FUNCTION public.decider_resultat_campagne(p_id UUID, p_decision TEXT, p_par TEXT, p_motif TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_r public.campagne_resultats%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.campagne_resultats WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESULTAT_INTROUVABLE' USING ERRCODE = 'P0001'; END IF;

  IF p_decision = 'contester' THEN
    IF v_r.statut NOT IN ('retenu', 'a_verifier') THEN RAISE EXCEPTION 'DEJA_TRAITE' USING ERRCODE = 'P0001'; END IF;
    IF now() > v_r.created_at + interval '48 hours' THEN RAISE EXCEPTION 'DELAI_DEPASSE' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.campagne_resultats SET statut = 'conteste', motif = p_motif, conteste_le = now() WHERE id = p_id;
    UPDATE public.commissions SET status = 'pending', unlock_at = NULL
     WHERE source = 'campagne' AND source_ref = p_id::text AND status = 'locked';
    RETURN 'conteste';
  END IF;

  IF p_decision = 'valider' THEN
    IF v_r.statut NOT IN ('a_verifier', 'conteste') THEN RAISE EXCEPTION 'DEJA_TRAITE' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.campagne_resultats SET statut = 'retenu', decide_par = p_par, decide_le = now() WHERE id = p_id;
    UPDATE public.commissions SET status = 'locked', unlock_at = GREATEST(v_r.created_at + interval '7 days', now())
     WHERE source = 'campagne' AND source_ref = p_id::text AND status = 'pending';
    RETURN 'retenu';
  END IF;

  IF p_decision = 'annuler' THEN
    IF v_r.statut = 'annule' THEN RAISE EXCEPTION 'DEJA_TRAITE' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.commissions WHERE source = 'campagne' AND source_ref = p_id::text
                AND status NOT IN ('locked', 'pending', 'reversed')) THEN
      RAISE EXCEPTION 'DEJA_VERSE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.campagne_resultats SET statut = 'annule', motif = COALESCE(p_motif, motif), decide_par = p_par, decide_le = now() WHERE id = p_id;
    UPDATE public.commissions SET status = 'reversed'
     WHERE source = 'campagne' AND source_ref = p_id::text AND status IN ('locked', 'pending');
    UPDATE public.missions SET budget_consomme = GREATEST(budget_consomme - v_r.prix, 0) WHERE id = v_r.mission_id;
    UPDATE public.mission_participants SET progress = GREATEST(progress - 1, 0)
     WHERE mission_id = v_r.mission_id AND reseller_id = v_r.reseller_id;
    RETURN 'annule';
  END IF;

  RAISE EXCEPTION 'DECISION_INCONNUE' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.decider_resultat_campagne(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decider_resultat_campagne(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ── 6. Demandes qualifiées : comptées par la base elle-même ─────────────────
-- Un client (numéro de téléphone) ne compte qu'une fois par campagne, qu'il
-- demande un devis puis commande, ou commande deux fois.
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
  FOR v_m IN
    SELECT m.id FROM public.missions m
      JOIN public.mission_participants p ON p.mission_id = m.id AND p.reseller_id = p_reseller_id AND p.status = 'joined'
     WHERE m.mission_type = 'demande_qualifiee' AND m.status = 'active' AND m.product_id = p_product_id
  LOOP
    PERFORM public.enregistrer_resultat_campagne(v_m.id, p_reseller_id, 'demande', 'client:' || md5(right(v_tel, 8)), p_origine, NULL);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Jamais au prix d'une commande ou d'un devis : le résultat est perdu, pas la vente.
  RAISE WARNING 'resultats_demande: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.resultats_demande(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resultat_demande_commande()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending_call' THEN
    PERFORM public.resultats_demande(NEW.product_id, NEW.reseller_id, NEW.customer_phone, 'commande:' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_resultat_campagne ON public.orders;
CREATE TRIGGER orders_resultat_campagne
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.resultat_demande_commande();

CREATE OR REPLACE FUNCTION public.resultat_demande_devis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'proposee' AND OLD.status = 'demande' THEN
    PERFORM public.resultats_demande(NEW.product_id, NEW.reseller_id, NEW.customer_phone, 'devis:' || NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quote_requests_resultat_campagne ON public.quote_requests;
CREATE TRIGGER quote_requests_resultat_campagne
  AFTER UPDATE OF status ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.resultat_demande_devis();

NOTIFY pgrst, 'reload schema';
