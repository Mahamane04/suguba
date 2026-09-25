import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { normaliserImage } from '@/lib/image-upload';
import { randomUUID } from 'node:crypto';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BUCKET_NAME = 'product-images';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Corrige BUG-011 à la racine : remplace le champ "collez une URL" du
 * formulaire fournisseur (n'importe quel lien externe, cassé ou non) par un
 * vrai upload de fichier vers un stockage que Suguba maîtrise. Réservé aux
 * comptes fournisseur/admin authentifiés — un visiteur anonyme ne doit pas
 * pouvoir remplir le bucket.
 */
export async function POST(req: NextRequest) {
  const denied = await refusSansPermissionAdmin(req, 'POST /api/products/upload-image');
  if (denied) return denied;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'supplier'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification fournisseur ou admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Stockage non configuré sur cet environnement.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WEBP uniquement).' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux (5MB max).' }, { status: 400 });
    }

    let normalized: Buffer;
    try { normalized = await normaliserImage(file); }
    catch { return NextResponse.json({ error: 'Image illisible ou trop grande. Envoyez une photo JPEG, PNG ou WebP, 5 Mo et 16 mégapixels maximum.' }, { status: 400 }); }
    const path = `${session.role}/${session.uid}/${randomUUID()}.webp`;

    const { error: uploadErr } = await admin.storage.from(BUCKET_NAME).upload(path, normalized, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

    if (uploadErr) {
      return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(path);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('[API upload-image] Échec de traitement.');
    return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 500 });
  }
}
