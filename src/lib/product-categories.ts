/**
 * Catégories de produits — liste commune (2026-09-11).
 *
 * Avant : trois listes différentes tapées à la main (dépôt fournisseur, dépôt
 * admin, chacune avec SES 6 catégories, jamais les mêmes). Un fournisseur
 * signalait ne rien trouver qui corresponde à son article. La catégorie est
 * un champ texte libre côté serveur (aucune contrainte en base, voir
 * `products.category`) : l'ajouter ici suffit, rien à migrer.
 *
 * Regroupée par famille pour un <select> plus lisible (voir <optgroup> dans
 * les formulaires de dépôt) ; le catalogue public, lui, ignore les familles
 * et ne montre que les catégories réellement utilisées par au moins un
 * produit (src/app/page.tsx calcule sa propre liste depuis les produits).
 */
export const FAMILLES_CATEGORIES: { famille: string; categories: string[] }[] = [
  {
    famille: 'Électronique & Électroménager',
    categories: [
      'Électroménager',
      'Électronique & TV',
      'Téléphones & Tablettes',
      'Informatique & Bureautique',
      'Audio & Son',
      'Énergie Solaire',
      'Accessoires électroniques',
    ],
  },
  {
    famille: 'Mode & Beauté',
    categories: [
      'Mode Homme',
      'Mode Femme',
      'Mode Enfant',
      'Chaussures',
      'Sacs & Maroquinerie',
      'Bijoux & Accessoires',
      'Beauté & Cosmétiques',
      'Parfums',
      'Soins capillaires & Perruques',
    ],
  },
  {
    famille: 'Maison & Vie quotidienne',
    categories: [
      'Maison & Déco',
      'Meubles',
      'Cuisine & Arts de la table',
      'Literie & Linge de maison',
      'Bricolage & Outillage',
      'Jardin & Extérieur',
      'Nettoyage & Entretien',
    ],
  },
  {
    famille: 'Famille & Loisirs',
    categories: [
      'Bébé & Puériculture',
      'Jouets & Jeux',
      'Sport & Loisirs',
      'Papeterie & Fournitures scolaires',
      'Livres & Musique',
    ],
  },
  {
    famille: 'Auto, Alimentation & Santé',
    categories: [
      'Auto & Moto — pièces et accessoires',
      'Alimentation & Boissons',
      'Santé & Bien-être',
    ],
  },
  {
    famille: 'Autre',
    categories: ['Autre'],
  },
];

/** Liste à plat, pour un filtre ou une recherche. */
export const CATEGORIES_PRODUITS: string[] = FAMILLES_CATEGORIES.flatMap((f) => f.categories);
