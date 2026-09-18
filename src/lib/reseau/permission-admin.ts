import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../session';
import { adminPeut } from './db';
import { PERMISSION_PAR_ROUTE } from './permissions-routes';

/**
 * Contrôle de permission d'équipe pour la route en cours, d'après
 * PERMISSION_PAR_ROUTE. À appeler en PREMIÈRE ligne du gestionnaire :
 *
 *   const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/payouts');
 *   if (refus) return refus;
 *
 * Ne REMPLACE PAS le contrôle « est-ce un admin ? » déjà présent dans chaque
 * route : il s'y ajoute. Sur une route partagée (commandes, versements), une
 * session non-admin passe ici sans contrôle — la route applique ses propres
 * règles pour le livreur ou le fournisseur.
 *
 * Un admin sans rôle d'équipe garde tous les droits (voir
 * permissionsEffectives) : aucun administrateur existant n'est bloqué.
 */
export async function refusSansPermissionAdmin(req: NextRequest, cle: string): Promise<NextResponse | null> {
  const permission = PERMISSION_PAR_ROUTE[cle];
  if (!permission) {
    // Erreur de développement, pas de l'utilisateur : on refuse plutôt que
    // d'ouvrir une route dont personne n'a décidé qui peut l'utiliser.
    console.error('[PERMISSIONS] Route sans permission déclarée :', cle);
    return NextResponse.json({ error: 'Action non configurée.' }, { status: 500 });
  }
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') return null;
  if (await adminPeut(session.uid, permission)) return null;
  return NextResponse.json(
    { error: 'Votre rôle dans l’équipe Suguba ne permet pas cette action.' },
    { status: 403 },
  );
}
