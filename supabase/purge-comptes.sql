-- ============================================================================
-- SUGUBA — PURGE DE TOUS LES COMPTES
-- Pour repartir d'une base vierge et tester l'inscription de bout en bout.
-- ============================================================================
--
-- ⚠️ IRRÉVERSIBLE. À n'exécuter que sur une base sans vrais clients.
--
-- ⚠️ LIS D'ABORD CECI — RISQUE D'ENFERMEMENT
-- Après cette purge, plus AUCUN compte admin n'existe. Or :
--   • un compte créé par Google ou par email ne peut jamais s'attribuer le
--     rôle admin (SELF_SERVE_ROLES l'exclut dans supabase-exchange) ;
--   • tout rôle autre que « client » naît en `pending_approval` et doit être
--     approuvé par un admin.
-- Donc : nouvelle inscription = en attente, et personne pour l'approuver.
-- La procédure de sortie est en bas de ce fichier. Lis-la AVANT de purger.
--
-- ── Ce qui est supprimé ─────────────────────────────────────────────────────
--   auth.users        les identités Supabase Auth (Google + liens email)
--   profiles          les profils applicatifs
--   profile_roles     en CASCADE depuis profiles
--   suppliers         en CASCADE depuis profiles
--   drivers           en CASCADE depuis profiles
--   otp_challenges    vestiges de l'OTP maison retiré en août
--
-- ── Ce qui est CONSERVÉ ─────────────────────────────────────────────────────
--   products          le catalogue. `products.supplier_id` n'a pas de clé
--                     étrangère : la colonne pointera dans le vide après la
--                     purge, sans rien casser (l'affichage utilise
--                     `supplier_name`). Voir la requête optionnelle en fin de
--                     fichier pour la nettoyer.
--   orders, payouts, commissions, sav_tickets : vides à ce jour.
-- ============================================================================


-- ── 1. AVANT : constater ce qui va disparaître ──────────────────────────────
SELECT 'auth.users'     AS table, count(*) FROM auth.users
UNION ALL SELECT 'profiles',       count(*) FROM public.profiles
UNION ALL SELECT 'profile_roles',  count(*) FROM public.profile_roles
UNION ALL SELECT 'suppliers',      count(*) FROM public.suppliers
UNION ALL SELECT 'drivers',        count(*) FROM public.drivers
UNION ALL SELECT 'otp_challenges', count(*) FROM public.otp_challenges;


-- ── 2. LA PURGE ─────────────────────────────────────────────────────────────
-- En une seule transaction : si une instruction échoue, rien n'est supprimé.
BEGIN;

  -- profile_roles, suppliers et drivers partent en CASCADE avec les profils
  -- (ON DELETE CASCADE, voir migration-multi-role/suppliers/drivers.sql).
  DELETE FROM public.profiles;

  -- Le côté Supabase Auth n'est pas lié par clé étrangère : sans cette ligne,
  -- ton compte Google existerait toujours et la « première inscription » que
  -- tu veux tester n'en serait pas vraiment une.
  DELETE FROM auth.users;

  DELETE FROM public.otp_challenges;

COMMIT;


-- ── 3. APRÈS : tout doit être à zéro ────────────────────────────────────────
SELECT 'auth.users'     AS table, count(*) FROM auth.users
UNION ALL SELECT 'profiles',       count(*) FROM public.profiles
UNION ALL SELECT 'profile_roles',  count(*) FROM public.profile_roles
UNION ALL SELECT 'suppliers',      count(*) FROM public.suppliers
UNION ALL SELECT 'drivers',        count(*) FROM public.drivers
UNION ALL SELECT 'otp_challenges', count(*) FROM public.otp_challenges;


-- ── OPTIONNEL : détacher les produits de leur fournisseur supprimé ──────────
-- UPDATE public.products SET supplier_id = NULL WHERE supplier_id IS NOT NULL;


-- ============================================================================
-- REMONTER UN ADMIN APRÈS LA PURGE
-- ============================================================================
-- Deux scripts, dans cet ordre, depuis le dossier du projet.
-- Ils utilisent la clé service_role de .env.local, jamais le navigateur.
--
--   node scripts/create-admin.js "+22371360525" "Mahamane Haidara"
--   node scripts/link-admin-google.js "+22371360525" "infos@sugubaml.com"
--
-- Le premier crée un profil `admin` / `active` par téléphone. Le second pose
-- l'email dessus, ce qui permet à la connexion Google de retrouver ce profil
-- et d'en hériter le rôle : supabase-exchange cherche par `auth_user_id`,
-- puis par `email`.
--
-- Pourquoi ça marche sans ligne dans `profile_roles` : `chargerRoles()` se
-- replie sur le rôle principal du profil quand la table ne renvoie rien.
-- Personne ne gagne de droit par ce repli, il reproduit le modèle à rôle
-- unique d'avant la migration.
--
-- Ordre conseillé pour ton test :
--   1. purger
--   2. recréer l'admin (les deux scripts ci-dessus)
--   3. tester une inscription Google avec une AUTRE adresse → elle doit
--      arriver en `pending_approval`
--   4. l'approuver depuis l'espace admin
-- ============================================================================
