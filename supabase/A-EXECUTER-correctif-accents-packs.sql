-- Correctif : accents des packs de sponsorisation (copie mal encodée).
UPDATE public.sponsorship_plans SET name = 'Visibilité Starter',
  description = 'Votre produit remonte en tête du catalogue revendeur pendant 7 jours.' WHERE id = 'plan_starter';
UPDATE public.sponsorship_plans SET name = 'Visibilité Boost',
  description = 'Mise en avant sur l''accueil et en tête des résultats de recherche.' WHERE id = 'plan_boost';
UPDATE public.sponsorship_plans SET name = 'Recrutement revendeurs',
  description = 'Votre boutique apparaît dans « Ces boutiques recherchent des revendeurs ».' WHERE id = 'plan_recrute';
SELECT id, name, description FROM public.sponsorship_plans ORDER BY position;
