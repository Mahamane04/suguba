-- ═══════════════════════════════════════════════════════════════════════════
-- Super Admin (2026-09-27) : infos@microofficeml.com.
--
-- Le rôle « super_admin » donne TOUTES les autorisations d'équipe, y compris
-- celles ajoutées plus tard (gestion de l'équipe, finance, baisse de la part
-- Suguba, export des données…). Seul le compte déjà ADMIN avec cet e-mail
-- est concerné. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.admin_team_members (profile_id, team_role, permissions)
SELECT p.id, 'super_admin', ARRAY[]::TEXT[]
FROM public.profiles p
WHERE lower(p.email) = 'infos@microofficeml.com'
  AND EXISTS (SELECT 1 FROM public.profile_roles r WHERE r.profile_id = p.id AND r.role = 'admin' AND r.status = 'active')
ON CONFLICT (profile_id) DO UPDATE SET team_role = 'super_admin';

-- Vérification : doit afficher une ligne « super_admin ».
SELECT p.full_name, m.team_role, m.created_at
FROM public.admin_team_members m JOIN public.profiles p ON p.id = m.profile_id
WHERE lower(p.email) = 'infos@microofficeml.com';
