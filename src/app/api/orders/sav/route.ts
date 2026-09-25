import { randomInt, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserImage } from '@/lib/image-upload';
import { assurerBucketSavPhotos, BUCKET_SAV_PHOTOS, PHOTOS_SAV_MAX } from '@/lib/sav-photos';

/**
 * « Signaler un problème avec un article » depuis le reçu client (2026-09-25).
 *
 * Crée une demande dans SAV & retours (table sav_tickets), avec les
 * informations RELUES sur la commande — jamais celles du navigateur. Seul le
 * détenteur de la clé du reçu peut le faire, seulement après livraison, et
 * une seule demande ouverte par article (pas d'empilement).
 *
 * Photos (jusqu'à 3) : réencodées côté serveur (métadonnées et position GPS
 * retirées), rangées dans un stockage PRIVÉ sous le dossier du ticket. Seul
 * l'écran admin SAV en obtient des liens temporaires.
 *
 * Une demande n'est pas une acceptation : l'équipe SAV l'étudie et décide.
 */

const MOTIFS: Record<string, string> = {
  defectueux: 'Article défectueux ou en panne',
  endommage: 'Article abîmé à la livraison',
  non_conforme: 'Pas l’article commandé',
  manquant: 'Article ou pièce manquant',
  autre: 'Autre problème',
};
const SOUHAITS: Record<string, 'swap_new' | 'repair' | 'refund'> = {
  echange: 'swap_new', reparation: 'repair', remboursement: 'refund',
};

async function lireCorps(req: NextRequest): Promise<{ champs: Record<string, unknown>; photos: File[] }> {
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const f = await req.formData();
    const champs: Record<string, unknown> = {};
    for (const cle of ['orderNumber', 'accessKey', 'motif', 'quantite', 'souhait', 'detail']) champs[cle] = f.get(cle) ?? undefined;
    const photos = f.getAll('photos').filter((x): x is File => x instanceof File && x.size > 0);
    return { champs, photos };
  }
  return { champs: await req.json().catch(() => ({})), photos: [] };
}

export async function POST(req: NextRequest) {
  let corps: Awaited<ReturnType<typeof lireCorps>>;
  try { corps = await lireCorps(req); } catch { return NextResponse.json({ error: 'Envoi illisible. Réessayez.' }, { status: 400 }); }
  const { champs, photos } = corps;
  const orderNumber = typeof champs.orderNumber === 'string' ? champs.orderNumber.trim() : '';
  const motif = typeof champs.motif === 'string' && MOTIFS[champs.motif] ? champs.motif : '';
  const detail = typeof champs.detail === 'string' ? champs.detail.trim().slice(0, 1000) : '';
  const quantite = Math.max(1, Math.min(999, Math.round(Number(champs.quantite) || 1)));
  const souhait = typeof champs.souhait === 'string' && SOUHAITS[champs.souhait] ? champs.souhait : 'echange';

  if (!orderNumber || orderNumber.length > 100) return NextResponse.json({ error: 'Article manquant.' }, { status: 400 });
  if (!motif) return NextResponse.json({ error: 'Choisissez le problème rencontré.' }, { status: 400 });
  if (photos.length > PHOTOS_SAV_MAX) return NextResponse.json({ error: `${PHOTOS_SAV_MAX} photos au maximum.` }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });

  // Chaque article d'une livraison est couvert par la clé du même reçu.
  if (!(await hasOrderReceiptAccess(admin, orderNumber, champs.accessKey))) {
    return NextResponse.json({ error: 'Ce reçu s’ouvre sur l’appareil qui a passé la commande.' }, { status: 403 });
  }

  const { data: commande, error } = await admin.from('orders')
    .select('id, order_number, status, quantity, customer_name, customer_phone, product_name')
    .eq('order_number', orderNumber).maybeSingle();
  if (error) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  if (!commande) return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
  if (commande.status !== 'delivered') {
    return NextResponse.json({ error: 'Un problème se signale après la livraison. Avant, refusez simplement le colis au livreur.' }, { status: 409 });
  }

  const { data: ouverts } = await admin.from('sav_tickets')
    .select('ticket_number').eq('order_id', commande.id).in('status', ['open', 'courier_dispatched']).limit(1);
  if (ouverts?.length) {
    return NextResponse.json({ error: `Une demande est déjà en cours pour cet article (${ouverts[0].ticket_number}).`, ticketNumber: ouverts[0].ticket_number }, { status: 409 });
  }

  // Photos d'abord (réencodées), puis le ticket : ainsi la description dit
  // exactement combien de photos l'équipe trouvera.
  const ticketId = randomUUID();
  const deposees: string[] = [];
  if (photos.length) {
    const images: Buffer[] = [];
    for (const p of photos) {
      try { images.push(await normaliserImage(p)); }
      catch { return NextResponse.json({ error: 'Une photo est illisible ou trop lourde (5 Mo maximum, JPEG, PNG ou WEBP).' }, { status: 400 }); }
    }
    try {
      await assurerBucketSavPhotos(admin);
      for (const [i, image] of images.entries()) {
        const chemin = `${ticketId}/${i + 1}.webp`;
        const { error: e } = await admin.storage.from(BUCKET_SAV_PHOTOS).upload(chemin, image, { contentType: 'image/webp', upsert: false });
        if (e) throw new Error(e.message);
        deposees.push(chemin);
      }
    } catch (e) {
      console.error('[API orders/sav] photos', (e as Error).message);
      if (deposees.length) await admin.storage.from(BUCKET_SAV_PHOTOS).remove(deposees);
      return NextResponse.json({ error: 'Envoi des photos impossible. Réessayez, ou envoyez la demande sans photo.' }, { status: 503 });
    }
  }

  const qte = Math.min(quantite, Math.max(1, Number(commande.quantity) || 1));
  const description = [
    `[Demande du client depuis son reçu] ${MOTIFS[motif]}`,
    `Quantité concernée : ${qte}`,
    `Souhait : ${souhait === 'echange' ? 'échange' : souhait === 'reparation' ? 'réparation' : 'remboursement'}`,
    deposees.length ? `Photos jointes : ${deposees.length}` : '',
    detail ? `Détail : ${detail}` : '',
  ].filter(Boolean).join('\n');

  const ticketNumber = `SAV-${Date.now().toString().slice(-6)}${randomInt(10, 100)}`;
  const { error: errInsert } = await admin.from('sav_tickets').insert({
    id: ticketId,
    ticket_number: ticketNumber,
    order_id: commande.id,
    order_number: commande.order_number,
    customer_name: commande.customer_name,
    customer_phone: commande.customer_phone,
    product_name: commande.product_name,
    issue_description: description,
    resolution_type: SOUHAITS[souhait],
    status: 'open',
  });
  if (errInsert) {
    console.error('[API orders/sav]', errInsert.code);
    if (deposees.length) await admin.storage.from(BUCKET_SAV_PHOTOS).remove(deposees);
    return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 503 });
  }
  return NextResponse.json({ ticketNumber, photos: deposees.length });
}
