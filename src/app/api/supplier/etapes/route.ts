import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserImage } from '@/lib/image-upload';
import { declarerEtape, EtapeError, PHOTOS_ETAPE_MAX } from '@/lib/etapes';

/**
 * Déclarer une étape de prestation terminée (2026-09-26, lot 1c), avec sa
 * preuve : note, date du rendez-vous, jusqu'à 3 photos (réencodées côté
 * serveur, métadonnées et position GPS retirées, stockage privé).
 *
 * Le fournisseur DÉCLARE ; seul le client (depuis son reçu) ou Suguba VALIDE.
 */
export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'commandes');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  let f: FormData;
  try { f = await req.formData(); } catch { return NextResponse.json({ error: 'Envoi illisible. Réessayez.' }, { status: 400 }); }
  const fichiers = f.getAll('photos').filter((x): x is File => x instanceof File && x.size > 0);
  if (fichiers.length > PHOTOS_ETAPE_MAX) return NextResponse.json({ error: `${PHOTOS_ETAPE_MAX} photos au maximum.` }, { status: 400 });
  const photos: Buffer[] = [];
  for (const p of fichiers) {
    try { photos.push(await normaliserImage(p)); }
    catch { return NextResponse.json({ error: 'Une photo est illisible ou trop lourde (5 Mo maximum, JPEG, PNG ou WEBP).' }, { status: 400 }); }
  }

  try {
    const etape = await declarerEtape(admin, acces.contexte.fournisseurId, {
      orderId: f.get('orderId'), position: f.get('position'), note: f.get('note'), datePrevue: f.get('datePrevue'), photos,
    });
    return NextResponse.json({ etape });
  } catch (e) {
    const err = e as EtapeError;
    return NextResponse.json({ error: err.message || 'Action impossible.' }, { status: err.status || 500 });
  }
}
