import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserImage } from '@/lib/image-upload';
import { mesPreuves, PreuveError, soumettrePreuve } from '@/lib/reseau/preuves-missions';

/**
 * Preuves de publication du revendeur (2026-09-26, lot 2a). La capture est
 * réencodée côté serveur (métadonnées et position retirées) et rangée dans
 * un stockage privé ; seule l'équipe Suguba la voit.
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  return NextResponse.json({ preuves: admin ? await mesPreuves(admin, session.uid) : [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  let f: FormData;
  try { f = await req.formData(); } catch { return NextResponse.json({ error: 'Envoi illisible. Réessayez.' }, { status: 400 }); }
  const photo = f.get('capture');
  if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ error: 'Ajoutez la capture de votre publication.' }, { status: 400 });
  let image: Buffer;
  try { image = await normaliserImage(photo); }
  catch { return NextResponse.json({ error: 'Capture illisible ou trop lourde (5 Mo maximum, JPEG, PNG ou WEBP).' }, { status: 400 }); }

  try {
    const r = await soumettrePreuve(admin, session.uid, {
      missionId: f.get('missionId'), canal: f.get('canal'), lien: f.get('lien'), note: f.get('note'), image,
    });
    return NextResponse.json(r);
  } catch (e) {
    const err = e as PreuveError;
    return NextResponse.json({ error: err.message || 'Envoi impossible.' }, { status: err.status || 500 });
  }
}
