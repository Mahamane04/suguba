import { NextResponse } from 'next/server';
import { lireReglagesReseau } from '@/lib/reseau/recompenses';
import { chargerReglages } from '@/lib/platform-settings';
import { actualiserSiAncien } from '@/lib/tarifs-saspay';
import { completerFraisPaiement } from '@/lib/frais-paiement';

/**
 * Les seuls réglages que le navigateur a besoin de connaître :
 *  - les frais de livraison par ville et les points relais, pour que la page
 *    produit propose les bons choix ;
 *  - le retrait minimum et les frais de retrait (payés par le revendeur),
 *    pour l'écran des commissions revendeur.
 *
 * Tout le reste — coûts, marge minimale, part revendeur — relève de la
 * structure de coûts de Suguba et n'est jamais exposé ici. Les codes promo non
 * plus : les publier les rendrait tous découvrables. Un code se vérifie en le
 * soumettant à /api/orders/quote.
 */
export async function GET() {
  const [{ reglages }, reseau] = await Promise.all([chargerReglages(), lireReglagesReseau()]);
  // Tarifs SasPay enregistrés (instantané) ; relus chez SasPay APRÈS la
  // réponse si le relevé a plus de 6 heures.
  actualiserSiAncien(completerFraisPaiement(reglages.fraisPaiement));
  return NextResponse.json(
    {
      fraisLivraisonClient: reglages.fraisLivraisonClient,
      livraisonParVille: reglages.livraisonParVille,
      pointsRelais: reglages.pointsRelais.map((p) => ({ id: p.id, nom: p.nom, frais: p.frais, horaires: p.horaires })),
      retraitMinimum: reglages.retraitMinimum,
      // Carte bancaire (diaspora) : proposée seulement une fois vérifiée par un paiement test.
      paiementCarte: reglages.paiementCarteVerifie === true,
      // Blocs de l'accueil affichés (A5, 2026-09-27) : réglés par l'équipe.
      accueil: reseau.accueilBlocs,
      // Frais de retrait payés par le revendeur : il doit les voir avant de valider.
      fraisRetrait: {
        saspayPct: reglages.fraisVersementPct,
        operateurPct: reglages.fraisOperateurRetraitPct,
        sugubaPct: reglages.fraisRetraitSugubaPct,
        // Taux Suguba par bénéficiaire et par moyen (2026-09-27) : caisse / Mobile Money.
        sugubaParRole: reglages.fraisRetraitSuguba,
      },
      // Frais d'un paiement Mobile Money, payés par le client (2026-09-27) :
      // affichés ligne par ligne avant qu'il valide, avec le même calcul que
      // le serveur. Ce sont des tarifs publics, aucun coût interne de Suguba.
      fraisPaiement: reglages.fraisPaiement,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
