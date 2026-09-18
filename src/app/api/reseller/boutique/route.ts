import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, majBoutique, obtenirOuCreerBoutique } from '@/lib/reseau/boutiques';

/**
 * Boutique du revendeur (§ 6) — /boutique/<adresse>.
 *
 * Créée au premier accès à partir du nom du compte : un revendeur ne doit pas
 * avoir à « créer une boutique » avant de pouvoir partager quoi que ce soit.
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: profil } = (await admin?.from('profiles').select('full_name, reseller_code').eq('id', session.uid).maybeSingle()) || { data: null };

  const boutique =
    (await boutiqueDuProprietaire('reseller', session.uid)) ||
    (await obtenirOuCreerBoutique({
      typeProprietaire: 'reseller',
      proprietaireId: session.uid,
      nom: profil?.full_name || 'Ma boutique',
    }));

  return NextResponse.json({ boutique, codeRevendeur: profil?.reseller_code || null });
}

export async function PATCH(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const boutique = await boutiqueDuProprietaire('reseller', session.uid);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const corps = await req.json().catch(() => ({}));
  const resultat = await majBoutique(boutique.id, session.uid, corps);
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });

  return NextResponse.json({ boutique: await boutiqueDuProprietaire('reseller', session.uid) });
}
