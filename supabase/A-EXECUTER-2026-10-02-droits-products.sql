-- ═══════════════════════════════════════════════════════════════════════════
-- Droits d'écriture sur les produits (revue RLS du 2026-10-02)
-- REQ-SEC-RLS-001 / TASK-SEC-RLS-001 / TEST-SEC-RLS-001
--
-- Constat (base locale isolée, état identique à la production attendu) : la
-- clé publique (anon) et les sessions Supabase (authenticated) gardent, sur
-- `products`, les droits Supabase par défaut INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES et TRIGGER. Aujourd'hui RIEN n'est exploitable : RLS est actif et
-- la table n'a qu'une règle de LECTURE (« Public read approved products ») ;
-- sans règle d'écriture, toute écriture par l'API publique touche 0 ligne.
--
-- Mais la protection ne tient qu'à une seule barrière : qu'une règle
-- d'écriture soit ajoutée un jour par erreur (ou RLS désactivé pour un
-- dépannage), et n'importe quel visiteur pourrait changer un prix ou un stock.
-- Aucun code n'en a besoin : le navigateur ne lit ni n'écrit jamais `products`
-- directement, toutes les écritures passent par le serveur (service_role,
-- non concerné par ce script).
--
-- Correctif : retrait des droits d'écriture pour anon et authenticated. La
-- lecture publique par colonnes (A-EXECUTER-2026-09-26-catalogue-prix-prives)
-- est conservée telle quelle.
--
-- ⚠️ Sur Supabase, `REVOKE ... FROM PUBLIC` ne suffit pas : anon et
-- authenticated doivent être nommés.
--
-- Aucune donnée modifiée. Aucun ordre à respecter avec le code. Sans risque à
-- relancer. À exécuter une fois dans Supabase › SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Retirer un droit sur la table le retire aussi colonne par colonne.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Vérification 1 (doit renvoyer 0 ligne) : droit d'écriture restant.
-- SELECT r.rolname, x.droit
--   FROM (VALUES ('anon'), ('authenticated')) r(rolname),
--        (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) x(droit)
--  WHERE has_table_privilege(r.rolname, 'public.products', x.droit)
--     OR (x.droit IN ('INSERT', 'UPDATE', 'REFERENCES')
--         AND has_any_column_privilege(r.rolname, 'public.products', x.droit));
--
-- Vérification 2 (doit renvoyer 21 pour chacun) : lecture publique conservée.
-- SELECT grantee, count(*) FROM information_schema.column_privileges
--  WHERE table_schema = 'public' AND table_name = 'products' AND privilege_type = 'SELECT'
--    AND grantee IN ('anon', 'authenticated') GROUP BY grantee;
--
-- Retour arrière (déconseillé, remet les droits par défaut de Supabase) :
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products TO anon, authenticated;
