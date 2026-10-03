/**
 * Porte unique « Ma boutique » (lot 1 du chantier boutique, 2026-10-03) — règles PURES.
 *
 * Toutes les entrées « Ma boutique » du revendeur ouvraient le formulaire de
 * réglages ; voir sa vraie vitrine demandait de copier son lien et de le coller
 * ailleurs, ou passait par l'ancienne /r/<code> dans un nouvel onglet (on sortait
 * de l'application installée). Elles passent désormais toutes par la route
 * /reseller/ma-boutique (src/app/reseller/ma-boutique/route.ts), qui trouve la
 * boutique de la SESSION et ouvre /boutique/<adresse> dans le même onglet.
 *
 * Adresse stable plutôt que /boutique/<adresse> écrite dans chaque lien : aucun
 * écran n'a besoin de connaître l'adresse (ni de la garder dans le navigateur,
 * où elle serait périmée après un changement, ou celle d'un autre compte sur un
 * téléphone partagé).
 */

export const PORTE_MA_BOUTIQUE = '/reseller/ma-boutique';

/**
 * « Mes articles » (lot 3, 2026-10-03) : ranger la vitrine, choisir ses coups de
 * cœur, voir ce que rapporte chaque article, retirer. Une vraie page (pas une
 * redirection) : elle peut être préchargée.
 */
export const PAGE_MES_ARTICLES = '/reseller/boutique/articles';

/**
 * Catalogue ouvert pour ajouter des articles depuis sa boutique (lot 3) : un
 * bandeau collant « Revenir à ma boutique » y ramène.
 */
export const CATALOGUE_DEPUIS_BOUTIQUE = '/reseller/catalog?depuis=boutique';

/** Panneaux d'édition que la vitrine du propriétaire sait ouvrir à l'arrivée (?editer=, lot 2). */
export const PANNEAUX_EDITION = ['logo', 'couverture', 'nom'] as const;

/**
 * Adresse de la vitrine vers laquelle la porte redirige. Seuls ?editer=logo|
 * couverture|nom et ?partager=1 sont recopiés : tout autre paramètre (?next=
 * //ailleurs…) est ignoré, la porte ne doit jamais servir de redirection ouverte.
 */
export function adresseVitrine(slug: string, parametres: URLSearchParams): string {
  const suite = new URLSearchParams();
  const editer = parametres.get('editer');
  if (editer && (PANNEAUX_EDITION as readonly string[]).includes(editer)) suite.set('editer', editer);
  if (parametres.get('partager') === '1') suite.set('partager', '1');
  const requete = suite.toString();
  return `/boutique/${encodeURIComponent(slug)}${requete ? `?${requete}` : ''}`;
}

/**
 * Lien à ne jamais précharger. Le préchargement de Next exécute la route visée
 * dès que le lien entre dans l'écran : la porte lirait la session (voire
 * créerait la boutique) puis suivrait la redirection vers la vitrine, sur
 * CHAQUE page, puisque l'onglet « Boutique » de la barre du bas y mène.
 */
export function sansPrechargement(href: string): boolean {
  return href === PORTE_MA_BOUTIQUE || href.startsWith(`${PORTE_MA_BOUTIQUE}?`);
}
