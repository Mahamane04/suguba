import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { DOSSIER_GUIDE, sessionAdministrateurGeneral } from '@/lib/guide';

/**
 * Capture d'une page pour le guide des parcours — administrateur général
 * seulement (contrôle estAdministrateurGeneral dans sessionAdministrateurGeneral).
 *
 * 404 et non 403 pour tout autre visiteur : la page cachée ne doit pas
 * laisser deviner qu'elle existe. Les captures ne sont pas dans /public.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const introuvable = () => new NextResponse('Introuvable', { status: 404 });
  const session = await sessionAdministrateurGeneral(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return introuvable();

  const { id } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return introuvable();
  try {
    const image = await readFile(path.join(DOSSIER_GUIDE, 'captures', `${id}.jpg`));
    return new NextResponse(new Uint8Array(image), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return introuvable();
  }
}
