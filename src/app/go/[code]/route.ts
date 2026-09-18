import { NextRequest, NextResponse } from 'next/server';
import { normaliserCodeLien, destinationDuLien } from '@/lib/reseau/codes';
import { lienParCode, enregistrerClic, empreinteVisiteur, journaliser } from '@/lib/reseau/db';
import { avancerMissions, produitParSlug } from '@/lib/reseau/missions-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Redirection trackée — /go/<code>.
 *
 * Toute la mesure du réseau passe par ici : un lien partagé sur WhatsApp, un
 * QR code sur un flyer, un lien de parrainage — c'est toujours cette route
 * qui compte le clic puis renvoie le visiteur vers la vraie page.
 *
 * Trois règles non négociables :
 *   1. **Le visiteur part toujours quelque part.** Un code inconnu, une base
 *      indisponible, une migration pas encore appliquée : on redirige vers
 *      l'accueil. Une page d'erreur au bout d'un lien partagé, c'est un client
 *      perdu et un revendeur qui cesse de partager.
 *   2. **La destination est calculée ici**, jamais lue telle quelle en base :
 *      rediriger vers une URL stockée ouvrirait une redirection ouverte, un
 *      lien Suguba menant sur un site tiers.
 *   3. **Aucune IP n'est stockée**, seulement une empreinte salée (voir
 *      empreinteVisiteur) — assez pour distinguer deux visiteurs, pas pour
 *      remonter à une personne.
 */

export const dynamic = 'force-dynamic';

/** Cookie d'attribution : le code revendeur suit le visiteur jusqu'à sa commande. */
const COOKIE_ATTRIBUTION = 'suguba_ref';
const COOKIE_LIEN = 'suguba_via';
const DUREE_ATTRIBUTION = 60 * 60 * 24 * 30; // 30 jours

function familleAppareil(userAgent: string | null): string {
  const ua = (userAgent || '').toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/mobile/.test(ua)) return 'mobile';
  if (!ua) return 'inconnu';
  return 'ordinateur';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: brut } = await params;
  const code = normaliserCodeLien(brut);
  const accueil = new URL('/', req.url);

  if (!code) return NextResponse.redirect(accueil, 302);

  const lien = await lienParCode(code);
  if (!lien) return NextResponse.redirect(accueil, 302);

  // Code revendeur du propriétaire du lien : c'est lui qui portera la vente.
  let codeRevendeur: string | null = null;
  if (lien.ownerId) {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('profiles').select('reseller_code').eq('id', lien.ownerId).maybeSingle()) || { data: null };
    codeRevendeur = data?.reseller_code || null;
  }

  const userAgent = req.headers.get('user-agent');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const visiteur = empreinteVisiteur(ip, userAgent);

  // La mesure ne doit jamais retarder ni empêcher la redirection : une erreur
  // de comptage n'est pas une raison de perdre le visiteur.
  try {
    await enregistrerClic({
      code,
      visiteur,
      referer: req.headers.get('referer')?.slice(0, 300) || null,
      device: familleAppareil(userAgent),
    });
    await journaliser({
      evenement: 'CLICK',
      resellerId: lien.ownerId,
      sujetType: lien.cible,
      sujetRef: lien.ref,
      linkCode: code,
    });
    if (lien.ownerId) {
      await avancerMissions(lien.ownerId, 'click', 1, lien.cible === 'product' ? await produitParSlug(lien.ref) : null);
    }
  } catch (erreur) {
    console.error('[GO] Clic non compté:', (erreur as Error).message);
  }

  const destination = new URL(destinationDuLien(lien.cible, lien.ref, codeRevendeur, code), req.url);
  const reponse = NextResponse.redirect(destination, 302);

  if (codeRevendeur) {
    reponse.cookies.set(COOKIE_ATTRIBUTION, codeRevendeur, {
      httpOnly: false, // lu par la page de commande pour pré-remplir le code.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DUREE_ATTRIBUTION,
    });
  }
  reponse.cookies.set(COOKIE_LIEN, code, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_ATTRIBUTION,
  });

  return reponse;
}
