import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SugubaRole } from '@/lib/session';

/**
 * « Se connecter en tant que » — 2026-09-11, demandé par l'utilisateur pour
 * tester lui-même les écrans client, revendeur, fournisseur et diaspora sans
 * avoir à créer et vérifier un vrai compte à chaque fois.
 *
 * Le middleware protège déjà tout `/api/admin/*` (`session.role === 'admin'`,
 * voir `middleware.ts`) ; on revérifie ici quand même — un endpoint qui
 * délivre une session avec un autre rôle ne doit jamais dépendre d'une seule
 * couche de protection.
 *
 * L'identité émise n'est PAS celle de l'admin : un compte de test dédié et
 * stable par rôle (`apercu-<role>`), pour que toute donnée créée pendant
 * l'aperçu (une commande, un dépôt produit…) soit facilement reconnaissable
 * et ne se mélange jamais avec le vrai profil de l'admin. Elle n'existe dans
 * aucune table `profiles`/`suppliers`/`resellers` : les écrans affichent donc
 * exactement ce que verrait un compte flambant neuf, sans historique — c'est
 * précisément ce qu'un premier usage doit montrer.
 *
 * ⚠️ Les actions réalisées PENDANT l'aperçu (déposer un produit, passer une
 * commande…) écrivent quand même en BASE RÉELLE, comme n'importe quel compte
 * de ce rôle — un produit déposé en aperçu fournisseur part en vente pour de
 * vrai. Le bandeau d'aperçu (voir PreviewBanner.tsx) le rappelle en
 * permanence ; à l'admin de nettoyer ce qu'il crée pour tester.
 */

const ROLES_APERCU: SugubaRole[] = ['customer', 'reseller', 'supplier', 'diaspora'];

// Un numéro stable par rôle : jamais un vrai numéro malien, reconnaissable
// au premier coup d'œil dans les listes admin (commandes, dépôts…).
const TELEPHONE_PAR_ROLE: Record<string, string> = {
  customer: '+22300000091',
  reseller: '+22300000092',
  supplier: '+22300000093',
  diaspora: '+22300000094',
};

export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  // On ne chaîne pas les aperçus : impossible de prévisualiser depuis un
  // aperçu déjà en cours (il faudrait alors perdre la trace de l'admin
  // d'origine). Revenir d'abord avec /api/admin/preview-role/exit.
  if (session.apercu) {
    return NextResponse.json({ error: 'Quittez l\'aperçu en cours avant d\'en ouvrir un autre.' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body.role as SugubaRole;
  if (!ROLES_APERCU.includes(role)) {
    return NextResponse.json({ error: 'Rôle d\'aperçu invalide.' }, { status: 400 });
  }

  const token = await createSessionToken({
    uid: `apercu-${role}`,
    phone: TELEPHONE_PAR_ROLE[role],
    role,
    status: 'active',
    roles: { [role]: 'active' },
    apercu: { depuis: { uid: session.uid, phone: session.phone } },
  });

  const res = NextResponse.json({ success: true, role });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}
