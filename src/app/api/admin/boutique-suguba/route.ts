import { avecJournal } from '@/lib/admin/journal-route';
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
  // Consultation seule (A1, 2026-09-27) : ouvrir la page ne crée plus la
  // boutique ; la création passe par POST, sur un bouton explicite.
  const boutique = await boutiqueSuguba(false);
  return NextResponse.json({ boutique, produits: (await chargerProduitsSuguba()).length, maxGalerie: MAX_GALERIE });
}

/** Création explicite de la boutique officielle (bouton « Créer la boutique Suguba »). */
export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/boutique-suguba', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de créer la boutique Suguba.' }, { status: 403 });
  const boutique = await boutiqueSuguba(true);
  if (!boutique) return NextResponse.json({ error: 'Création impossible : la mise à jour du réseau n’est pas appliquée sur la base.' }, { status: 503 });
  return NextResponse.json({ boutique, produits: (await chargerProduitsSuguba()).length, maxGalerie: MAX_GALERIE });
}

export async function PATCH(req: NextRequest) {
  return avecJournal(req, 'PATCH /api/admin/boutique-suguba', () => patchInterne(req));
}

async function patchInterne(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de modifier la boutique Suguba.' }, { status: 403 });
  const boutique = await boutiqueSuguba(false);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });
  const r = await majBoutique(boutique.id, null, await req.json().catch(() => ({})));
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: 400 });
  return NextResponse.json({ boutique: await boutiqueSuguba(false) });
}
