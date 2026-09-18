import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { invitationsPour, monAdhesion, repondreInvitation } from '@/lib/reseau/equipe-fournisseur-db';

/**
 * Invitations d'équipe reçues par la personne connectée — quel que soit son
 * rôle actuel (un client, un revendeur ou un nouveau compte peut être invité).
 * Les invitations sont retrouvées par le téléphone du compte. Ce numéro est
 * DÉCLARÉ (pas de code SMS) : accepter ne donne donc aucun droit, le
 * fournisseur confirme ensuite (voir confirmerCollaborateur).
 */

export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ invitations: [], connecte: false });
  const telephone = session.phone.includes('@') ? null : session.phone;
  return NextResponse.json({
    connecte: true,
    telephoneConnu: Boolean(telephone),
    invitations: telephone ? await invitationsPour(telephone) : [],
    adhesion: await monAdhesion(session.uid),
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  const { invitationId, accepter } = await req.json().catch(() => ({}));
  if (typeof invitationId !== 'string' || typeof accepter !== 'boolean') {
    return NextResponse.json({ error: 'Réponse invalide.' }, { status: 400 });
  }
  const r = await repondreInvitation({
    invitationId, accepter, personneId: session.uid,
    telephone: session.phone.includes('@') ? '' : session.phone,
  });
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
}
