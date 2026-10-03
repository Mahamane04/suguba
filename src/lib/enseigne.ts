/**
 * Nom public d'une boutique revendeur — règles PURES (lot 2 du chantier
 * boutique, 2026-10-03). Sans accès à la base : utilisable côté serveur comme
 * dans un composant client.
 *
 * Décision du fondateur : le titre public est l'ENSEIGNE seule dès que le
 * revendeur en a choisi une, sinon « La sélection de Awa D. ». Jamais le nom
 * complet : les premières boutiques étaient créées au nom complet du compte
 * (« Awa Traoré Diallo »), et la vitrine affichait « La sélection de Awa Traoré
 * Diallo » à n'importe quel visiteur.
 *
 * Le nom complet ne quitte jamais le serveur : c'est lui qui calcule `enseigne`
 * (voir chargerBoutiqueRevendeur et /api/reseller/boutique) ; le navigateur ne
 * reçoit que le nom à afficher et ce booléen.
 */

/**
 * Nom donné à une boutique quand le compte n'a pas encore de nom (relecture du
 * lot 2, 2026-10-03). Partagé par nomPublic et estEnseigne : ce n'est jamais
 * une enseigne choisie, quel que soit le nom du compte rempli ensuite.
 */
export const NOM_PAR_DEFAUT = 'Revendeur Suguba';

/** « Awa Traoré Diallo » → « Awa D. » : un prénom suffit pour une vitrine publique. */
export function nomPublic(nomComplet: string | null): string {
  const mots = String(nomComplet || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return NOM_PAR_DEFAUT;
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

/** Mots comparables : sans accents, sans ponctuation, en minuscules. */
function mots(texte: string | null | undefined): string[] {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Adresses que seule Suguba peut porter (relecture du lot 2, 2026-10-03) :
 * celles de la boutique officielle (voir boutiqueSuguba) et celles qui se
 * feraient passer pour l'équipe.
 */
export const ADRESSES_RESERVEES: readonly string[] = [
  'suguba', 'suguba-officiel', 'boutique-suguba', 'admin', 'administrateur', 'administration',
  'support', 'service-client', 'officiel', 'boutique-officielle', 'equipe', 'moderation', 'aide',
];

/**
 * Nom réservé à Suguba (relecture du lot 2, 2026-10-03). Le lot 2 a permis de
 * choisir l'adresse par le nom et affiche l'enseigne SEULE en titre : un
 * revendeur pouvait prendre « Suguba Officiel », titre et adresse de la boutique
 * officielle. Réservé : un mot qui contient « suguba » (« Suguba », « SugubaML »,
 * « Sugu Ba »), ou un nom dont l'adresse serait réservée (« Admin », « Support »).
 * « Sugu Bamako » reste libre : « sugu » (le marché) est un mot courant.
 */
export function nomReserve(nom: string | null | undefined): boolean {
  const liste = mots(nom);
  if (liste.some((m, i) => m.includes('suguba') || (m === 'sugu' && liste[i + 1] === 'ba'))) return true;
  return ADRESSES_RESERVEES.includes(liste.join('-'));
}

/** Adresse (slug) réservée à Suguba : jamais attribuée à une boutique de fournisseur ou de revendeur. */
export function adresseReservee(slug: string | null | undefined): boolean {
  return nomReserve(String(slug || '').replace(/-/g, ' '));
}

/**
 * Le nom de boutique est-il une vraie enseigne, choisie par le revendeur ?
 *
 * Non quand il reprend le nom de la personne : égal au nom du compte, à
 * « Prénom I. » (nom donné à la création), ou fait uniquement de mots de son
 * nom (« Awa Traoré », « Traoré Awa », « Awa D »). Afficher l'un d'eux en titre
 * publierait le nom d'un particulier ; on affiche alors « La sélection de Awa D. ».
 *
 * Non plus (relecture du lot 2, 2026-10-03) pour le nom par défaut « Revendeur
 * Suguba », quel que soit le nom du compte rempli depuis, ni pour un nom réservé
 * à Suguba : le titre public ne doit jamais se faire passer pour Suguba.
 */
export function estEnseigne(nomBoutique: string | null | undefined, nomComplet: string | null | undefined): boolean {
  const boutique = mots(nomBoutique);
  if (boutique.join('').length < 2) return false;
  if (boutique.join(' ') === mots(NOM_PAR_DEFAUT).join(' ') || nomReserve(nomBoutique)) return false;
  if (boutique.join(' ') === mots(nomPublic(nomComplet || null)).join(' ')) return false;
  const compte = mots(nomComplet);
  if (compte.length === 0) return true;
  const motDuCompte = (m: string) => compte.includes(m) || (m.length === 1 && compte.some((c) => c.startsWith(m)));
  return !boutique.every(motDuCompte);
}

/**
 * Nom public d'une boutique revendeur : l'enseigne, ou « Awa D. » (relecture du
 * lot 2, 2026-10-03). Même règle partout : vitrine, annuaire, recherche,
 * boutiques suivies, réponses de /api/reseller/boutique.
 */
export function nomPublicBoutique(nomBoutique: string | null | undefined, nomComplet: string | null | undefined): string {
  return estEnseigne(nomBoutique, nomComplet) ? String(nomBoutique).trim() : nomPublic(nomComplet || null);
}

/**
 * Titre affiché en haut de la vitrine et dans les aperçus de lien : l'enseigne
 * seule, ou « La sélection de Awa D. » (boutique revendeur) ; le nom de la
 * boutique pour un fournisseur ou Suguba.
 */
export function titreVitrine(boutique: { type: 'fournisseur' | 'revendeur'; nom: string; enseigne?: boolean }): string {
  if (boutique.type !== 'revendeur' || boutique.enseigne) return boutique.nom;
  return `La sélection de ${boutique.nom}`;
}
