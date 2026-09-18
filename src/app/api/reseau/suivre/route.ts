import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { basculerAbonnement, boutiqueParSlug, cleAbonne, suitLaBoutique } from '@/lib/reseau/boutiques';
import { journaliser } from '@/lib/reseau/db';

/**
 * Suivre / ne plus suivre une boutique (§ 10).
 *
 * Volontairement ouvert aux visiteurs sans compte : un client qui découvre une
 * boutique par WhatsApp doit pouvoir la suivre tout de suite. Il donne alors
 * son téléphone, qui sert de clé — c'est déjà celui qu'il donnera en commandant.
 */

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('boutique');
  const telephone = req.nextUrl.searchParams.get('telephone');
  if (!slug) return NextResponse.json({ error: 'Boutique requise.' }, { status: 400 });

  const boutique = await boutiqueParSlug(slug);
  if (!boutique) return NextResponse.json({ suit: false, abonnes: 0 });

  const session = await sessionDeLaRequete(req);
  const cle = cleAbonne({ profileId: session?.uid, telephone });
  return NextResponse.json({
    suit: cle ? await suitLaBoutique(boutique.id, cle) : false,
    abonnes: boutique.abonnes,
  });
}

export async function POST(req: NextRequest) {
  const corps = await req.json().catch(() => ({}));
  const slug = typeof corps.boutique === 'string' ? corps.boutique : '';
  if (!slug) return NextResponse.json({ error: 'Boutique requise.' }, { status: 400 });

  const boutique = await boutiqueParSlug(slug);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const session = await sessionDeLaRequete(req);
  const cle = cleAbonne({ profileId: session?.uid, telephone: corps.telephone });
  if (!cle) {
    return NextResponse.json(
      { error: 'Indiquez votre numéro WhatsApp pour suivre cette boutique.' },
      { status: 400 },
    );
  }

  const resultat = await basculerAbonnement({ boutiqueId: boutique.id, cle, profileId: session?.uid || null });
  if (!resultat) {
    return NextResponse.json({ error: 'Abonnements indisponibles pour le moment.' }, { status: 503 });
  }

  if (resultat.suit) {
    await journaliser({
      evenement: 'FOLLOW',
      acteurId: session?.uid || null,
      sujetType: 'store',
      sujetRef: boutique.slug,
    });
  }
  return NextResponse.json(resultat);
}
