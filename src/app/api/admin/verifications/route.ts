import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { deciderVerification, fileDattente } from '@/lib/reseau/verifications-db';

/** File d'attente des vérifications (§ 42 des écrans). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'verification.lire'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux vérifications.' }, { status: 403 });
  }
  return NextResponse.json({ demandes: await fileDattente() });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'verification.decider'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de décider d’une vérification.' }, { status: 403 });
  }

  const { demandeId, decision, note } = await req.json().catch(() => ({}));
  if (typeof demandeId !== 'string' || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Demande et décision requises.' }, { status: 400 });
  }

  const resultat = await deciderVerification({
    demandeId,
    decision,
    note: typeof note === 'string' ? note.slice(0, 300) : null,
    adminId: session.uid,
  });
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });
  return NextResponse.json({ success: true });
}
