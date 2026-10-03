import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, majBoutique, obtenirOuCreerBoutique } from '@/lib/reseau/boutiques';
import { nomPublic } from '@/lib/shop';

/**
 * Boutique du revendeur (§ 6) — /boutique/<adresse>.
 *
 * Créée au premier accès à partir du prénom et de l'initiale du compte : un
 * revendeur ne doit pas avoir à « créer une boutique » avant de pouvoir
 * partager quoi que ce soit.
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: profil, error: erreurProfil } =
    (await admin?.from('profiles').select('full_name, reseller_code').eq('id', session.uid).maybeSingle()) || { data: null, error: null };

  // Relecture du lot 1 du chantier boutique (2026-10-03) : création avec
  // « Prénom I. » (nomPublic), comme la porte /reseller/ma-boutique qui renvoie
  // ici en cas d'échec — jamais le nom complet, dont l'adresse était tirée pour
  // toujours. Profil illisible : rien n'est créé (une boutique « Revendeur
  // Suguba » garderait cette adresse) ; la page affiche son écran d'attente.
  const boutique =
    (await boutiqueDuProprietaire('reseller', session.uid)) ||
    (!erreurProfil && profil
      ? await obtenirOuCreerBoutique({
        typeProprietaire: 'reseller',
        proprietaireId: session.uid,
        nom: nomPublic(profil.full_name || null),
      })
      : null);

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
