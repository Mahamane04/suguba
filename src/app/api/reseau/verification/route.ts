import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deposerVerification, estTypeVerification, etatsVerification, badgesDuCompte } from '@/lib/reseau/verifications-db';
import { pourcentageVerifie, VERIFICATIONS } from '@/lib/reseau/badges';

/**
 * Vérification du compte (§ 5) : dépôt de pièces et état d'avancement.
 *
 * ⚠️ Cette route ne reçoit JAMAIS de document en clair : elle n'accepte qu'une
 * URL déjà déposée par /api/products/upload-image. Rien n'est stocké en base
 * à part cette URL et le type de pièce.
 */

export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: profil } = (await admin?.from('profiles').select('phone, email').eq('id', session.uid).maybeSingle()) || { data: null };
  // Seul l'e-mail est vérifié d'office (connexion par lien magique ou Google).
  // Le téléphone est déclaré : il passe par une demande que l'équipe valide
  // après un appel (voir etatsVerification).
  const etats = await etatsVerification(session.uid, {
    phone: profil?.phone || null,
    email: profil?.email || (session.phone.includes('@') ? session.phone : null),
  });

  return NextResponse.json({
    etats,
    pourcentage: pourcentageVerifie(etats),
    etapes: VERIFICATIONS,
    badges: await badgesDuCompte(session.uid),
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const corps = await req.json().catch(() => ({}));
  if (!estTypeVerification(corps.type)) {
    return NextResponse.json({ error: 'Type de vérification inconnu.' }, { status: 400 });
  }

  // Seule une référence PRIVÉE déposée par CE compte est acceptée
  // (/api/reseau/upload?usage=document) : ni URL publique, ni fichier d'un
  // autre utilisateur glissé dans sa propre demande.
  const document = typeof corps.document === 'string' ? corps.document.trim() : null;
  if (document && !document.startsWith(`prive:${session.uid}/`)) {
    return NextResponse.json({ error: 'Document invalide.' }, { status: 400 });
  }
  // Localisation et téléphone se vérifient sans photo : le quartier est
  // déclaré, le téléphone est confirmé par un appel de l'équipe.
  if (!document && corps.type !== 'location' && corps.type !== 'phone') {
    return NextResponse.json({ error: 'Ajoutez une photo du document.' }, { status: 400 });
  }

  const donnees: Record<string, unknown> = {};
  if (corps.type === 'location' && typeof corps.quartier === 'string') {
    donnees.quartier = corps.quartier.trim().slice(0, 80);
  }

  const resultat = await deposerVerification({
    profileId: session.uid,
    type: corps.type,
    document,
    donnees,
  });
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });
  return NextResponse.json({ success: true });
}
