-- ═══════════════════════════════════════════════════════════════════════════
-- Lot C — Solde et retraits des fournisseurs (2026-09-27)
--
-- 1. SOLDE : à la livraison d'une commande, le montant dû au fournisseur est
--    inscrit dans son grand-livre (`gains_fournisseurs`), bloqué pendant un
--    délai de sécurité (réglage « délai avant retrait des fournisseurs »,
--    7 jours par défaut). Il devient retirable ensuite, et seulement une fois
--    l'argent chez Suguba pour une vente payée en espèces (même règle que les
--    revendeurs : fonds_recus).
--      Montant dû = prix fournisseur FIGÉ à la commande × quantité,
--                   + les frais de remise quand le fournisseur livre lui-même
--                   (il reverse alors tout l'argent à la caisse Suguba).
--    Une commande annulée ou retournée annule le gain encore non retiré.
-- 2. RETRAIT : un retrait fournisseur est une ligne de `payouts` marquée
--    beneficiaire = 'fournisseur'. La demande réserve le solde (verrou,
--    idempotence) avec ses frais figés.
-- 3. PAIEMENT PAR L'ADMIN : mêmes actions que pour un revendeur (virement
--    SasPay, espèces au guichet, refus). Un virement échoué ou un refus rend
--    le montant au solde disponible du fournisseur.
--
-- Seules les commandes livrées APRÈS l'exécution de ce SQL créditent un
-- solde (aucune commande n'était livrée au 2026-09-27).
-- Prérequis : audit sécurité (2026-09-25), caisse livreurs, trésorerie.
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Un retrait appartient à un revendeur OU à un fournisseur ─────────────
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS beneficiaire TEXT NOT NULL DEFAULT 'revendeur'
  CHECK (beneficiaire IN ('revendeur', 'fournisseur'));
COMMENT ON COLUMN public.payouts.reseller_id IS
  'Titulaire du retrait : profil du revendeur, ou profil propriétaire du fournisseur (voir beneficiaire).';

-- ── 2. Grand-livre des fournisseurs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gains_fournisseurs (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id                TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number            TEXT,
  supplier_id             TEXT NOT NULL,          -- profil propriétaire (products.supplier_id)
  amount                  NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status                  TEXT NOT NULL DEFAULT 'locked'
                          CHECK (status IN ('locked', 'available', 'reserved', 'paid', 'reversed')),
  unlock_at               TIMESTAMPTZ,            -- fin du délai de sécurité
  available_at            TIMESTAMPTZ,
  reserved_for_withdrawal TEXT,                   -- payouts.id
  split_from              TEXT REFERENCES public.gains_fournisseurs(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un seul crédit par commande (les morceaux créés par un retrait partiel ont split_from).
CREATE UNIQUE INDEX IF NOT EXISTS gains_fournisseurs_une_par_commande
  ON public.gains_fournisseurs (order_id) WHERE split_from IS NULL;
CREATE INDEX IF NOT EXISTS gains_fournisseurs_solde
  ON public.gains_fournisseurs (supplier_id, status, created_at);
CREATE INDEX IF NOT EXISTS gains_fournisseurs_retrait
  ON public.gains_fournisseurs (reserved_for_withdrawal) WHERE reserved_for_withdrawal IS NOT NULL;

-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.gains_fournisseurs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gains_fournisseurs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gains_fournisseurs TO service_role;

-- ── 3. Crédit à la livraison, annulation au retour ──────────────────────────
CREATE OR REPLACE FUNCTION public.gains_fournisseur_suivre_commande()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fournisseur TEXT;
  v_unitaire    NUMERIC;
  v_montant     NUMERIC;
  v_jours       INTEGER;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

  IF NEW.status = 'delivered' THEN
    SELECT p.supplier_id, p.supplier_price INTO v_fournisseur, v_unitaire
      FROM public.products p WHERE p.id = NEW.product_id;
    IF v_fournisseur IS NULL OR v_fournisseur = '' THEN RETURN NULL; END IF;
    -- Prix fournisseur figé dans le devis de la commande ; le prix du
    -- catalogue seulement pour une commande qui n'en a pas.
    IF jsonb_typeof(NEW.pricing_snapshot #> '{devis,tarif,prixFournisseur}') = 'number' THEN
      v_unitaire := (NEW.pricing_snapshot #>> '{devis,tarif,prixFournisseur}')::numeric;
    END IF;
    v_montant := round(coalesce(v_unitaire, 0) * greatest(coalesce(NEW.quantity, 1), 1));
    -- Le fournisseur qui remet lui-même reverse tout à la caisse, frais de
    -- remise compris : ils lui reviennent.
    IF NEW.pricing_snapshot #>> '{remise,mode}' = 'fournisseur' THEN
      v_montant := v_montant + round(greatest(coalesce(NEW.delivery_fee, 0), 0));
    END IF;
    IF v_montant <= 0 THEN RETURN NULL; END IF;

    SELECT CASE WHEN jsonb_typeof(s.valeurs -> 'delaiGainFournisseurJours') = 'number'
                THEN least(60, greatest(0, round((s.valeurs ->> 'delaiGainFournisseurJours')::numeric)))::int END
      INTO v_jours FROM public.platform_settings s WHERE s.id = 1;
    v_jours := coalesce(v_jours, 7);

    INSERT INTO public.gains_fournisseurs (order_id, order_number, supplier_id, amount, status, unlock_at)
    VALUES (NEW.id, NEW.order_number, v_fournisseur, v_montant, 'locked', now() + make_interval(days => v_jours))
    ON CONFLICT (order_id) WHERE split_from IS NULL DO NOTHING;

  ELSIF NEW.status IN ('cancelled', 'returned') THEN
    -- Déjà retiré (ou en cours de retrait) : rapprochement manuel, comme
    -- pour la commission du revendeur.
    IF EXISTS (SELECT 1 FROM public.gains_fournisseurs
                WHERE order_id = NEW.id AND status IN ('reserved', 'paid')) THEN
      RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED';
    END IF;
    UPDATE public.gains_fournisseurs SET status = 'reversed'
     WHERE order_id = NEW.id AND status IN ('locked', 'available');
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.gains_fournisseur_suivre_commande() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gains_fournisseur_suivre_commande ON public.orders;
CREATE TRIGGER gains_fournisseur_suivre_commande
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.gains_fournisseur_suivre_commande();

-- ── 4. Fin du délai de sécurité ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.liberer_gains_fournisseurs_echus()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_liberes INTEGER;
BEGIN
  UPDATE public.gains_fournisseurs g
     SET status = 'available', available_at = now()
   WHERE g.status = 'locked'
     AND g.unlock_at IS NOT NULL
     AND g.unlock_at <= now()
     AND (g.order_id IS NULL OR public.fonds_recus(g.order_id));
  GET DIAGNOSTICS v_liberes = ROW_COUNT;
  RETURN v_liberes;
END $$;

-- ── 5. Demande de retrait : réserve du solde, verrouillée et idempotente ────
CREATE OR REPLACE FUNCTION public.reserver_gains_fournisseur(p_fournisseur TEXT, p_montant NUMERIC, p_retrait TEXT)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.gains_fournisseurs%ROWTYPE; total NUMERIC := 0; prise NUMERIC; restant NUMERIC;
BEGIN
  IF p_montant <= 0 OR p_montant <> trunc(p_montant) THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  PERFORM 1 FROM public.payouts
    WHERE id = p_retrait AND reseller_id = p_fournisseur AND beneficiaire = 'fournisseur' AND status = 'pending'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_OWNER_MISMATCH'; END IF;
  SELECT coalesce(sum(amount), 0) INTO total FROM public.gains_fournisseurs
    WHERE reserved_for_withdrawal = p_retrait AND supplier_id = p_fournisseur AND status = 'reserved';
  IF total > 0 THEN
    IF total <> p_montant THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
    RETURN total;
  END IF;
  FOR g IN SELECT * FROM public.gains_fournisseurs
            WHERE supplier_id = p_fournisseur AND status = 'available'
            ORDER BY created_at, id FOR UPDATE LOOP
    EXIT WHEN total >= p_montant;
    prise := least(g.amount, p_montant - total);
    restant := g.amount - prise;
    UPDATE public.gains_fournisseurs SET amount = prise, status = 'reserved', reserved_for_withdrawal = p_retrait
     WHERE id = g.id;
    IF restant > 0 THEN
      INSERT INTO public.gains_fournisseurs (order_id, order_number, supplier_id, amount, status, created_at, available_at, unlock_at, split_from)
      VALUES (g.order_id, g.order_number, g.supplier_id, restant, 'available', g.created_at, g.available_at, g.unlock_at, coalesce(g.split_from, g.id));
    END IF;
    total := total + prise;
  END LOOP;
  -- Exception = annulation de toutes les écritures de la demande.
  IF total < p_montant THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.creer_retrait_fournisseur(p_fournisseur TEXT, p_cle TEXT, p_empreinte TEXT, p_ligne JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE ancien public.payouts%ROWTYPE; nouveau public.payouts%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payout-fournisseur:' || p_fournisseur, 0));
  SELECT * INTO ancien FROM public.payouts
   WHERE reseller_id = p_fournisseur AND beneficiaire = 'fournisseur' AND request_key = p_cle;
  IF FOUND THEN
    IF ancien.request_fingerprint <> p_empreinte THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN to_jsonb(ancien);
  END IF;
  INSERT INTO public.payouts (id, reseller_id, reseller_name, beneficiaire, amount, payment_method, phone_number, status,
                              montant_demande, frais_retrait, detail_frais, request_key, request_fingerprint)
  VALUES (p_ligne ->> 'id', p_fournisseur, p_ligne ->> 'reseller_name', 'fournisseur', (p_ligne ->> 'amount')::numeric,
          p_ligne ->> 'payment_method', p_ligne ->> 'phone_number', 'pending',
          (p_ligne ->> 'montant_demande')::numeric, (p_ligne ->> 'frais_retrait')::numeric, p_ligne -> 'detail_frais',
          p_cle, p_empreinte)
  RETURNING * INTO nouveau;
  IF nouveau.amount <= 0 OR nouveau.montant_demande <> nouveau.amount + nouveau.frais_retrait THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  PERFORM public.reserver_gains_fournisseur(p_fournisseur, nouveau.montant_demande, nouveau.id);
  RETURN to_jsonb(nouveau);
END $$;

-- ── 6. Paiement par l'admin : chaque retrait dans SON grand-livre ───────────
-- Mêmes fonctions qu'avant pour les revendeurs ; seule la branche
-- « fournisseur » est nouvelle.
CREATE OR REPLACE FUNCTION public.finalize_payout_atomic(p_id TEXT, p_status TEXT, p_reference TEXT DEFAULT NULL, p_expected_status TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.payouts%ROWTYPE; reserve NUMERIC;
BEGIN
  SELECT * INTO p FROM public.payouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;
  IF p_status NOT IN ('completed', 'rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF p.status = p_status THEN RETURN to_jsonb(p); END IF;
  IF p_expected_status IS NOT NULL AND p.status <> p_expected_status THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.beneficiaire = 'fournisseur' THEN
    SELECT coalesce(sum(amount), 0) INTO reserve FROM public.gains_fournisseurs
      WHERE supplier_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  ELSE
    SELECT coalesce(sum(amount), 0) INTO reserve FROM public.commissions
      WHERE reseller_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  END IF;
  IF reserve <> coalesce(p.montant_demande, p.amount) THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
  IF p.beneficiaire = 'fournisseur' THEN
    -- Payé : le gain est consommé. Refusé ou échoué : il revient au solde disponible.
    UPDATE public.gains_fournisseurs
       SET status = CASE WHEN p_status = 'completed' THEN 'paid' ELSE 'available' END,
           reserved_for_withdrawal = CASE WHEN p_status = 'completed' THEN reserved_for_withdrawal END
     WHERE supplier_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  ELSIF p_status = 'completed' THEN PERFORM public.settle_commissions_for_withdrawal(p.id);
  ELSE PERFORM public.release_commissions_for_withdrawal(p.id);
  END IF;
  UPDATE public.payouts SET status = p_status, processed_at = now(), transaction_ref = coalesce(p_reference, transaction_ref)
   WHERE id = p.id RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;

-- Prise en charge d'un virement : la réserve doit être exacte AVANT le prestataire.
CREATE OR REPLACE FUNCTION public.begin_payout_transfer(p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.payouts%ROWTYPE; reserved NUMERIC;
BEGIN
  SELECT * INTO p FROM public.payouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR p.status NOT IN ('pending', 'processing') OR p.payment_method = 'cash' THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.beneficiaire = 'fournisseur' THEN
    SELECT coalesce(sum(amount), 0) INTO reserved FROM public.gains_fournisseurs
      WHERE supplier_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  ELSE
    SELECT coalesce(sum(amount), 0) INTO reserved FROM public.commissions
      WHERE reseller_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  END IF;
  IF reserved <> coalesce(p.montant_demande, p.amount) THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
  UPDATE public.payouts SET status = 'processing' WHERE id = p.id RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;

-- ── 7. Droits : serveur uniquement ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.liberer_gains_fournisseurs_echus(),
                       public.reserver_gains_fournisseur(TEXT, NUMERIC, TEXT),
                       public.creer_retrait_fournisseur(TEXT, TEXT, TEXT, JSONB),
                       public.finalize_payout_atomic(TEXT, TEXT, TEXT, TEXT),
                       public.begin_payout_transfer(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberer_gains_fournisseurs_echus(),
                          public.reserver_gains_fournisseur(TEXT, NUMERIC, TEXT),
                          public.creer_retrait_fournisseur(TEXT, TEXT, TEXT, JSONB),
                          public.finalize_payout_atomic(TEXT, TEXT, TEXT, TEXT),
                          public.begin_payout_transfer(TEXT)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Vérification (doit renvoyer 2 lignes) :
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE (table_name = 'payouts' AND column_name = 'beneficiaire')
--     OR (table_name = 'gains_fournisseurs' AND column_name = 'supplier_id');
