import { normaliserImage } from '@/lib/image-upload';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Envoi de fichiers du module Réseau.
 *
 * Deux usages, deux stockages, et c'est tout l'objet de cette route :
 *
 *   image    → logo, couverture, galerie de boutique. Stockage PUBLIC
 *              (bucket des photos produit) : ces images sont faites pour être
 *              vues. Ouvert aux revendeurs — /api/products/upload-image ne
 *              l'était pas, un revendeur ne pouvait donc pas mettre de logo.
 *
 *   document → pièce d'identité, selfie de vérification. Stockage PRIVÉ :
 *              aucune URL publique n'est jamais produite. On renvoie une
 *              référence `prive:<chemin>` ; seul l'écran admin des
 *              vérifications en obtient une URL signée, valable dix minutes.
 *              Une carte NINA dans un bucket public, c'est une fuite de
 *              données d'identité indexable par n'importe qui.
 */

const BUCKET_PUBLIC = 'product-images';
const BUCKET_PRIVE = 'verification-docs';
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TAILLE_MAX = 5 * 1024 * 1024;

let bucketPriveVerifie = false;

async function assurerBucketPrive(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  if (bucketPriveVerifie) return;
  const { data } = await admin.storage.getBucket(BUCKET_PRIVE);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET_PRIVE, { public: false, fileSizeLimit: TAILLE_MAX });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  } else if (data.public) {
    // Garde-fou : si quelqu'un a rendu ce bucket public à la main, on refuse
    // d'y déposer des pièces d'identité plutôt que de les exposer.
    throw new Error('Le stockage des pièces est public : envoi refusé. Repassez-le en privé dans Supabase.');
  }
  bucketPriveVerifie = true;
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const usage = req.nextUrl.searchParams.get('usage') === 'document' ? 'document' : 'image';
  if (usage === 'image' && !['reseller', 'supplier', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Envoi d’images réservé aux boutiques.' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Stockage non configuré sur cet environnement.' }, { status: 503 });

  try {
    const formulaire = await req.formData();
    const fichier = formulaire.get('file');
    if (!(fichier instanceof File)) return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    if (!TYPES.includes(fichier.type)) return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WEBP).' }, { status: 400 });
    if (fichier.size > TAILLE_MAX) return NextResponse.json({ error: 'Fichier trop volumineux (5 Mo max).' }, { status: 400 });

    let normalized: Buffer;
    try { normalized = await normaliserImage(fichier); }
    catch { return NextResponse.json({ error: 'Image illisible ou trop grande (5 Mo, 16 mégapixels maximum).' }, { status: 400 }); }
    const nom = `${randomUUID()}.webp`;

    if (usage === 'document') {
      await assurerBucketPrive(admin);
      const chemin = `${session.uid}/${nom}`;
      const { error } = await admin.storage.from(BUCKET_PRIVE).upload(chemin, normalized, { contentType: 'image/webp', upsert: false });
      if (error) return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 500 });
      return NextResponse.json({ success: true, ref: `prive:${chemin}` });
    }

    const chemin = `boutiques/${session.uid}/${nom}`;
    const { error } = await admin.storage.from(BUCKET_PUBLIC).upload(chemin, normalized, {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    });
    if (error) return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 500 });
    const { data } = admin.storage.from(BUCKET_PUBLIC).getPublicUrl(chemin);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (erreur) {
    console.error('[RESEAU UPLOAD]', (erreur as Error).message);
    return NextResponse.json({ error: 'Stockage indisponible. Réessayez ou contactez Suguba.' }, { status: 500 });
  }
}
