-- ═══════════════════════════════════════════════════════════════════════════
-- Frais de paiement à la charge du client (2026-09-27).
--
-- 1. Chaque tentative de paiement Mobile Money garde le montant demandé à
--    SasPay et le détail des frais payés par le client (transaction Suguba,
--    retrait opérateur, fonds de soutien de l'État, SasPay).
-- 2. Les tarifs SasPay, relus automatiquement chez SasPay, sont gardés dans
--    une colonne à part : la relecture ne touche jamais aux réglages de
--    l'équipe.
-- Sans ces colonnes, les paiements fonctionnent quand même (tarifs par
-- défaut, pas de trace). Aucune donnée existante n'est modifiée. Sans risque
-- à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS amount_requested NUMERIC(14,0);
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS fees JSONB;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS tarifs_saspay JSONB;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Vérification : doit afficher les trois colonnes.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'payment_attempts' AND column_name IN ('amount_requested', 'fees'))
    OR (table_name = 'platform_settings' AND column_name = 'tarifs_saspay'));
