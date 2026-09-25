/**
 * QR de remise (2026-09-25) — contenu du QR imprimé sur le reçu client.
 *
 * Ce n'est PAS une adresse web : scanné par un téléphone quelconque, il
 * n'affiche qu'une ligne de texte et n'ouvre aucune page (donc aucune donnée
 * personnelle). Seul le scanner de l'espace livreur l'exploite, et le serveur
 * vérifie alors que la commande est bien assignée à ce livreur.
 *
 * Il porte le numéro de commande (pour retrouver la livraison) et le code de
 * remise (la preuve). QR et saisie manuelle utilisent donc la MÊME preuve :
 * réussir par l'un rend l'autre inutile, et les essais ratés se cumulent
 * (verify_delivery_atomic, 3 essais). Un code régénéré rend l'ancien QR caduc.
 */

const PREFIXE = 'SUGUBA-REMISE';
const VERSION = '1';

export function contenuQrRemise(orderNumber: string, code: string): string {
  return `${PREFIXE}:${VERSION}:${orderNumber}:${code}`;
}

export function lireQrRemise(texte: unknown): { orderNumber: string; code: string } | null {
  if (typeof texte !== 'string' || texte.length > 200) return null;
  const parties = texte.trim().split(':');
  if (parties.length !== 4 || parties[0] !== PREFIXE || parties[1] !== VERSION) return null;
  const [, , orderNumber, code] = parties;
  if (!/^[A-Z0-9-]{3,40}$/i.test(orderNumber) || !/^\d{4}$/.test(code)) return null;
  return { orderNumber, code };
}
