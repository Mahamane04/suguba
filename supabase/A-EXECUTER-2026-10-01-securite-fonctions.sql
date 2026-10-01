-- ═══════════════════════════════════════════════════════════════════════════
-- URGENT — Sécurité des fonctions de la base (audit intégral du 2026-10-01)
-- REQ-SEC-RPC-001 / TASK-SEC-RPC-001 / TEST-SEC-RPC-001
--
-- FAILLE CRITIQUE CONFIRMÉE EN PRODUCTION (sonde sans effet, montant 0) :
-- la clé publique du site (présente dans le navigateur de tout visiteur)
-- peut exécuter des fonctions SECURITY DEFINER anciennes. Sur Supabase, les
-- fonctions créées dans « public » reçoivent par défaut EXECUTE pour anon et
-- authenticated ; `REVOKE ... FROM PUBLIC` ne retire PAS ces droits-là.
--
-- Conséquence la plus grave : `verser_recompense` crée une commission
-- « disponible » du montant voulu pour n'importe quel revendeur, retirable
-- ensuite par /api/payouts/create. Démontré sur la base locale isolée
-- (50 000 F crédités sans connexion). En production au 2026-10-01 : aucune
-- commission de ce type, aucun retrait — pas d'abus constaté.
--
-- Autres fonctions ouvertes : compteurs de missions et de liens
-- (enregistrer_conversion*, enregistrer_clic_tracking), compteurs de
-- sponsorisation, abonnés d'une boutique, demande de rôle pour un autre compte
-- (demander_role, inutilisée par l'application), libération des commissions.
--
-- Correctif : l'exécution est réservée au serveur (service_role) ; les
-- fonctions de déclencheur ne sont plus exécutables directement ; et les
-- futures fonctions ne reçoivent plus EXECUTE pour anon/authenticated par
-- défaut (chaque fichier doit l'accorder explicitement s'il le faut).
--
-- Aucune donnée modifiée. Sans risque à relancer. Retour arrière : voir en bas.
-- À exécuter dans Supabase › SQL Editor, le plus tôt possible.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Fonctions appelées par le serveur uniquement : plus d'accès public.
REVOKE ALL ON FUNCTION public.verser_recompense(TEXT, TEXT, TEXT, NUMERIC, TEXT)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_conversion(TEXT, TEXT, TEXT, NUMERIC)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_clic_tracking(TEXT, TEXT, TEXT, TEXT)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rafraichir_abonnes_boutique(TEXT)                                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberer_commissions_echues()                                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demander_role(TEXT, TEXT)                                           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verser_recompense(TEXT, TEXT, TEXT, NUMERIC, TEXT),
                          public.enregistrer_conversion(TEXT, TEXT, TEXT, NUMERIC),
                          public.enregistrer_clic_tracking(TEXT, TEXT, TEXT, TEXT),
                          public.rafraichir_abonnes_boutique(TEXT),
                          public.liberer_commissions_echues()
  TO service_role;

-- Fonctions du réseau V3 : présentes seulement si A-EXECUTER-equipe-v3-variantes.sql
-- a été exécuté (absentes de la production au 2026-10-01).
DO $$
BEGIN
  IF to_regprocedure('public.compter_sponsorisation(text[],text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) TO service_role;
  END IF;
  IF to_regprocedure('public.enregistrer_conversion_produit(text,text,text,numeric,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
  END IF;
END $$;

-- 2. Fonctions de déclencheur : jamais appelées directement par personne.
REVOKE ALL ON FUNCTION public.audit_order_effects()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculer_total_recu()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refuser_participation_liee()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resultat_demande_commande()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resultat_demande_devis()       FROM PUBLIC, anon, authenticated;

-- 3. Plus jamais d'EXECUTE accordé d'office aux rôles publics pour une
--    nouvelle fonction créée depuis le SQL Editor (rôle postgres).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Vérification (doit renvoyer 0 ligne) : fonctions SECURITY DEFINER encore
-- exécutables par la clé publique ou un compte connecté.
-- SELECT p.oid::regprocedure
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.prosecdef
--    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
--
-- Retour arrière (déconseillé, rouvre la faille) :
-- GRANT EXECUTE ON FUNCTION public.verser_recompense(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
