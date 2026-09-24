import type { Permission } from './permissions';

/**
 * Permission d'équipe exigée par chaque route admin — TABLE UNIQUE.
 *
 * Toute route sous /api/admin (et les routes partagées qu'un admin utilise
 * pour agir sur l'argent ou les commandes) DOIT figurer ici :
 * tests/reseau.test.cjs parcourt le dossier et échoue si une route manque.
 * Sans ce test, la prochaine route admin écrite serait ouverte à tous les
 * membres de l'équipe sans que personne ne s'en aperçoive — c'est exactement
 * ce qui était arrivé aux 16 routes antérieures au module d'équipe.
 */
export const PERMISSION_PAR_ROUTE: Record<string, Permission> = {
  'GET /api/admin/drivers/active': 'livraison.lire',
  'GET /api/admin/drivers/roster': 'livraison.lire',
  'POST /api/admin/drivers/verify': 'livraison.gerer',
  'GET /api/admin/payouts': 'finance.lire',
  'POST /api/admin/payouts': 'finance.payer',
  'POST /api/admin/preview-role': 'plateforme.parametres',
  'GET /api/admin/products/pending': 'produit.lire',
  'POST /api/admin/products/price': 'produit.prix',
  'GET /api/admin/products': 'produit.lire',
  'POST /api/admin/products/status': 'produit.moderer',
  'POST /api/admin/promote': 'utilisateur.promouvoir',
  'GET /api/admin/reseau-stats': 'marketing.lire',
  'POST /api/admin/reset-otp-lock': 'utilisateur.moderer',
  'POST /api/admin/review-profile': 'utilisateur.moderer',
  'GET /api/admin/sav': 'commande.lire',
  'POST /api/admin/sav': 'commande.modifier',
  'PATCH /api/admin/sav': 'commande.modifier',
  'GET /api/admin/settings': 'finance.lire',
  'PUT /api/admin/settings': 'plateforme.parametres',
  'POST /api/admin/unlock-commission': 'finance.payer',
  'GET /api/admin/reseau-reglages': 'finance.lire',
  'POST /api/admin/reseau-reglages': 'commission.configurer',
  // Routes partagées : la permission ne s'applique qu'à une session ADMIN.
  'POST /api/payouts/initiate': 'finance.payer',
  'GET /api/orders/feed': 'commande.lire',
  'POST /api/orders/sync': 'commande.modifier',
};

/**
 * Routes admin qui vérifient déjà une permission précise elles-mêmes
 * (adminPeut), souvent plusieurs selon l'action : elles n'ont pas d'entrée
 * unique dans la table ci-dessus.
 */
export const ROUTES_CONTROLE_INTERNE = [
  '/api/admin/equipe',
  '/api/admin/missions',
  '/api/admin/recompenses',
  '/api/admin/sponsorisations',
  '/api/admin/verifications',
  '/api/admin/utilisateurs',
  '/api/admin/boutiques',
  '/api/admin/commandes',
  '/api/admin/boutique-suguba',
  '/api/admin/diffusion',
  // Guide des parcours : administrateur général seulement
  // (sessionAdministrateurGeneral), plus strict qu'une permission d'équipe.
  '/api/admin/guide/capture/[id]',
];
