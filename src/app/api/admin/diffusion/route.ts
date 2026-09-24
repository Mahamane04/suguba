import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifier } from '@/lib/reseau/notifications';

/**
 * Diffusion d'un message au réseau (2026-09-24).
 *
 * Remplace la maquette de /admin/broadcast : « Diffuser » n'envoyait rien et
 * les nombres de destinataires étaient écrits en dur. Désormais :
 * - GET compte les VRAIS comptes actifs par profil (profile_roles) ;
 * - POST écrit une notification dans l'application pour chacun d'eux
 *   (cloche en haut de l'écran), avec un lien interne facultatif.
 *
 * Pas d'envoi WhatsApp ou SMS automatique en masse : un même message envoyé
 * à des centaines de numéros ferait bannir le numéro Suguba. Pour WhatsApp,
 * la page propose de copier le texte et de le poster soi-même.
 */

const CIBLES = ['reseller', 'supplier', 'driver'] as const;
type Cible = (typeof CIBLES)[number] | 'tous';

async function destinataires(cible: Cible): Promise<string[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const roles = cible === 'tous' ? [...CIBLES] : [cible];
  const { data, error } = await admin.from('profile_roles')
    .select('profile_id').in('role', roles).eq('status', 'active').limit(20000);
  if (error || !data) return [];
  return Array.from(new Set(data.map((l: any) => l.profile_id as string)));
}

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'marketing.lire'))) return NextResponse.json({ error: 'Votre rôle ne donne pas accès à la diffusion.' }, { status: 403 });
  const [reseller, supplier, driver, tous] = await Promise.all([
    destinataires('reseller'), destinataires('supplier'), destinataires('driver'), destinataires('tous'),
  ]);
  return NextResponse.json({ comptes: { reseller: reseller.length, supplier: supplier.length, driver: driver.length, tous: tous.length } });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'marketing.gerer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de diffuser un message.' }, { status: 403 });

  const corps = await req.json().catch(() => ({}));
  const cible: Cible | null = corps.cible === 'tous' || CIBLES.includes(corps.cible) ? corps.cible : null;
  const titre = typeof corps.titre === 'string' ? corps.titre.trim() : '';
  const texte = typeof corps.texte === 'string' ? corps.texte.trim() : '';
  const lien = typeof corps.lien === 'string' && corps.lien.startsWith('/') && !corps.lien.startsWith('//') ? corps.lien : null;
  if (!cible) return NextResponse.json({ error: 'Choisissez à qui envoyer le message.' }, { status: 400 });
  if (titre.length < 3) return NextResponse.json({ error: 'Écrivez un titre d’au moins 3 caractères.' }, { status: 400 });

  const ids = await destinataires(cible);
  if (ids.length === 0) return NextResponse.json({ error: 'Aucun compte actif dans ce groupe.' }, { status: 400 });
  await notifier(ids, { type: 'annonce', titre, texte: texte || null, lien });
  return NextResponse.json({ success: true, envoyes: ids.length });
}
