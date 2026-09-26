-- ═══════════════════════════════════════════════════════════════════════════
-- Prix fournisseur privés (2026-09-26, lot A « Priorité au réseau »)
--
-- Constat : la règle « Public read approved products » laissait la clé
-- publique lire TOUTES les colonnes d'un produit approuvé — prix fournisseur,
-- part revendeur, part proposée, statut de tarification. N'importe quel
-- visiteur pouvait les obtenir sans compte.
--
-- Le catalogue passe désormais par /api/catalogue (serveur), qui filtre les
-- colonnes selon le rôle. Ce script retire à la clé publique (anon) et aux
-- sessions Supabase (authenticated) la lecture des colonnes sensibles. Le
-- serveur (service_role) n'est pas concerné.
--
-- ⚠️ À exécuter APRÈS la mise en ligne du code du lot A : l'ancien code lisait
-- `select *`, qui serait refusé.
--
-- Une colonne ajoutée plus tard à `products` sera PRIVÉE par défaut : pour la
-- rendre publique, l'ajouter au GRANT ci-dessous (et à COLONNES_PUBLIQUES dans
-- src/lib/catalogue.ts).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id, name, slug, category, description, public_price, stock, images, status,
  supplier_id, supplier_name, created_at, updated_at, mode_prix, prix_conseille,
  type_offre, mode_remise, frais_remise, offre_inclus, mode_commande, etapes
) ON public.products TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
