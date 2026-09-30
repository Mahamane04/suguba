/** Identité commerciale partagée par /s/<slug> et /boutique/<slug>.
 * Le dépôt, le téléphone et l'adresse du fournisseur n'entrent jamais ici.
 */
export interface IdentiteFournisseur {
  nom: string;
  logo: string | null;
  description: string | null;
  couverture: string | null;
}
export function identiteFournisseur(
  historique: { company_name?: string; shop_display_name?: string | null; logo_url?: string | null; shop_description?: string | null },
  principale: { name: string; logo_url?: string | null; description?: string | null; cover_url?: string | null } | null,
): IdentiteFournisseur {
  if (principale) return {
    nom: principale.name,
    logo: principale.logo_url || null,
    description: principale.description || null,
    couverture: principale.cover_url || null,
  };
  return {
    nom: historique.shop_display_name || historique.company_name || 'Ma boutique',
    logo: historique.logo_url || null,
    description: historique.shop_description || null,
    couverture: null,
  };
}
