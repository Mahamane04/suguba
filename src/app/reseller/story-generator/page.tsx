import { redirect } from 'next/navigation';

/**
 * L'ancien « générateur de stories » (2026-09-11) : il imprimait la page au
 * lieu de produire une image, écrivait le code d'un revendeur de
 * démonstration, affichait une « garantie 12 mois » inventée et envoyait le
 * lien du revendeur à un service tiers (quickchart.io) pour son QR code.
 *
 * Le studio d'affiches vit désormais sur /reseller/marketing. Cette adresse
 * est conservée pour les liens déjà enregistrés.
 */
export default function StoryGeneratorPage() {
  redirect('/reseller/marketing');
}
