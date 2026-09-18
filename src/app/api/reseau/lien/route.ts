import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { estCanal, estCible, type CanalPartage, type CibleLien } from '@/lib/reseau/codes';
import { creerLienTracke, liensDuProprietaire, journaliser } from '@/lib/reseau/db';
import { avancerMissions, produitParSlug } from '@/lib/reseau/missions-db';

/**
 * Liens trackés d'un utilisateur — création et historique (§ 11, § 19).
 *
 * Le propriétaire du lien vient TOUJOURS de la session : impossible de créer
 * un lien au nom d'un autre revendeur et de capter son trafic.
 */

export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  return NextResponse.json({ liens: await liensDuProprietaire(session.uid) });
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const corps = await req.json().catch(() => ({}));
  const cible = corps.cible;
  const canal = corps.canal ?? 'autre';
  if (!estCible(cible)) return NextResponse.json({ error: 'Cible de lien inconnue.' }, { status: 400 });
  if (!estCanal(canal)) return NextResponse.json({ error: 'Canal de partage inconnu.' }, { status: 400 });

  const ref = typeof corps.ref === 'string' ? corps.ref.trim().slice(0, 120) : null;
  const libelle = typeof corps.libelle === 'string' ? corps.libelle.trim().slice(0, 120) : null;

  const lien = await creerLienTracke({
    ownerId: session.uid,
    ownerRole: session.role,
    cible: cible as CibleLien,
    ref: ref || null,
    canal: canal as CanalPartage,
    libelle,
  });
  if (!lien) {
    return NextResponse.json(
      { error: 'Suivi des partages indisponible. La migration réseau n’est pas encore appliquée.' },
      { status: 503 },
    );
  }

  // Un partage compte pour les missions de type « partager » dès la création
  // du lien : c'est le seul moment que Suguba observe réellement, l'envoi dans
  // WhatsApp lui-même se passe hors de la plateforme.
  await journaliser({
    evenement: 'SHARE',
    acteurId: session.uid,
    resellerId: session.role === 'reseller' ? session.uid : null,
    sujetType: lien.cible,
    sujetRef: lien.ref,
    linkCode: lien.code,
  });
  if (session.role === 'reseller') {
    await avancerMissions(session.uid, 'share', 1, lien.cible === 'product' ? await produitParSlug(lien.ref) : null);
  }

  return NextResponse.json({ lien });
}
