import { NextResponse } from 'next/server';
import { chargerReglages } from '@/lib/platform-settings';

/**
 * Les seuls réglages que le navigateur a besoin de connaître :
 *  - les frais de livraison par ville et les points relais, pour que la page
 *    produit propose les bons choix ;
 *  - le retrait minimum, pour l'écran des commissions revendeur.
 *
 * Tout le reste — coûts, marge minimale, part revendeur — relève de la
 * structure de coûts de Suguba et n'est jamais exposé ici. Les codes promo non
 * plus : les publier les rendrait tous découvrables. Un code se vérifie en le
 * soumettant à /api/orders/quote.
 */
export async function GET() {
  const { reglages } = await chargerReglages();
  return NextResponse.json(
    {
      fraisLivraisonClient: reglages.fraisLivraisonClient,
      livraisonParVille: reglages.livraisonParVille,
      pointsRelais: reglages.pointsRelais.map((p) => ({ id: p.id, nom: p.nom, frais: p.frais, horaires: p.horaires })),
      retraitMinimum: reglages.retraitMinimum,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
