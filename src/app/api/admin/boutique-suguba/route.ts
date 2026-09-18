import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { boutiqueSuguba, majBoutique, MAX_GALERIE } from '@/lib/reseau/boutiques';
import { chargerProduitsSuguba } from '@/lib/shop';

/** Boutique officielle Suguba (§ 24) : Suguba vendeuse de ses propres produits. */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne donne pas accès à la boutique Suguba.' }, { status: 403 });
  const boutique = await boutiqueSuguba(true);
  return NextResponse.json({ boutique, produits: (await chargerProduitsSuguba()).length, maxGalerie: MAX_GALERIE });
}

export async function PATCH(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de modifier la boutique Suguba.' }, { status: 403 });
  const boutique = await boutiqueSuguba(false);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });
  const r = await majBoutique(boutique.id, null, await req.json().catch(() => ({})));
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: 400 });
  return NextResponse.json({ boutique: await boutiqueSuguba(false) });
}
