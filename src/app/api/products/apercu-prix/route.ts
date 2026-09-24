import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarif, calculerTarifGros, prixConseilleGros, prixDepuisPartRevendeur, prixMinimalGros, surcoutSugubaGros } from '@/lib/pricing';

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

  // Prix de gros (2026-09-24) : bornes du prix du revendeur et partage au
  // prix conseillé, selon le mode de gain choisi par l'admin.
  if (req.nextUrl.searchParams.get('modePrix') === 'gros') {
    const conseilFournisseur = Number(req.nextUrl.searchParams.get('prixConseille')) || null;
    const prixMinimal = prixMinimalGros(prixFournisseur, r);
    const prixConseille = prixConseilleGros(prixFournisseur, r, conseilFournisseur);
    const t = calculerTarifGros(prixFournisseur, prixConseille, r);
    return NextResponse.json({
      mode: 'gros',
      prixMinimal,
      prixConseille,
      conseilFournisseurRetenu: Boolean(conseilFournisseur && conseilFournisseur === prixConseille),
      gainRevendeurAuConseil: t.commission,
      prelevementSuguba: t.prelevementSuguba,
      surcoutSuguba: surcoutSugubaGros(prixFournisseur, r),
      modeGain: r.prixDeGros?.modeGain,
      taux: r.prixDeGros?.taux,
      montantFixe: r.prixDeGros?.montantFixe,
    });
  }

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
    // Ce que le revendeur reçoit, et le détail du partage (2026-09-23) : le
    // fournisseur doit voir qui touche quoi. Aucun coût interne n'est exposé,
    // seulement les montants de la vente.
    commission: t.commission,
    commissionBrute: t.commissionBrute,
    prelevementSuguba: t.prelevementSuguba,
    tauxPrelevement: r.modePartSuguba === 'prelevement_revendeur' ? r.tauxPartSuguba : 0,
    partSuguba: d.prixVente - prixFournisseur - t.commission,
    releveAuPlancher: d.releveAuPlancher,
    commissionFaible: t.statut === 'commission_faible',
    commissionMinimale: r.commissionMinimale,
  });
}
