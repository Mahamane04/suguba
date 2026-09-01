-- ============================================================================
-- SUGUBA — MIGRATION PAIEMENT LIGDICASH (remplace PayDunya)
-- ============================================================================
--
-- LigdiCash ne signe pas le corps de sa notification webhook (contrairement
-- à PayDunya, qui envoyait un hash de la clé maître). La seule vérification
-- fiable documentée par LigdiCash est de rappeler leur endpoint /confirm
-- avec le jeton que NOUS avons stocké à la création de la facture — jamais
-- un jeton lu dans le webhook lui-même. D'où cette colonne : sans elle,
-- impossible de re-vérifier, donc impossible de faire confiance à un
-- webhook qui pourrait être forgé par n'importe qui connaissant l'URL.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

ALTER TABLE public.orders  ADD COLUMN IF NOT EXISTS payment_invoice_token TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS payment_invoice_token TEXT;
