import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarif, prixDepuisPartRevendeur } from '@/lib/pricing';

/**
 * Aperçu du prix client pour le fournisseur, pendant qu'il remplit sa fiche
 * (2026-09-11) : « avec ce prix et cette part revendeur, le client paiera X F ».
 *
 * Calculé côté serveur parce que la structure de coûts de Suguba (coûts fixes,
 * provisions, marge minimale) n'a pas à partir dans le navigateur : la route
 * ne renvoie que le prix client, la commission et deux indicateurs.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'supplier'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification fournisseur ou admin requise.' }, { status: 401 });
  }

  const prixFournisseur = Number(req.nextUrl.searchParams.get('prixFournisseur'));
  const partRevendeur = Number(req.nextUrl.searchParams.get('partRevendeur')) || 0;
  if (!(prixFournisseur > 0)) {
    return NextResponse.json({ error: 'Prix fournisseur requis.' }, { status: 400 });
  }

  const { reglages: r } = await chargerReglages();

  // Mode automatique, ou aucune part indiquée : le moteur décide.
  if (r.modePartSuguba === 'auto' || !(partRevendeur > 0)) {
    const prixVente = calculerTarif(prixFournisseur, 0, r).prixRecommande;
    const t = calculerTarif(prixFournisseur, prixVente, r);
    return NextResponse.json({
      mode: r.modePartSuguba,
      partChoisieUtilisee: false,
      prixVente,
      commission: t.commission,
      commissionMinimale: r.commissionMinimale,
    });
  }

  const d = prixDepuisPartRevendeur(prixFournisseur, partRevendeur, r);
  const t = calculerTarif(prixFournisseur, d.prixVente, r, partRevendeur);
  return NextResponse.json({
    mode: r.modePartSuguba,
    partChoisieUtilisee: true,
    prixVente: d.prixVente,
    commission: t.commission,
    releveAuPlancher: d.releveAuPlancher,
    commissionFaible: t.statut === 'commission_faible',
    commissionMinimale: r.commissionMinimale,
  });
}
