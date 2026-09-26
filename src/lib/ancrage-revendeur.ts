/**
 * Revendeur d'origine d'un visiteur (2026-09-26, lot B « Priorité au réseau »).
 *
 * Avant, le code du revendeur ne suivait le visiteur que s'il était arrivé par
 * un lien suivi (/go/<code>). Arrivé par la boutique /r/<code>, /boutique/…
 * ou un lien ?ref=, il le perdait dès qu'il passait par l'accueil ou la
 * boutique du fournisseur : la vente n'était plus attribuée au revendeur.
 *
 * Désormais, la première arrivée par un revendeur pose le même cookie que
 * /go/ (suguba_ref, 30 jours). LE PREMIER CONTACT GAGNE : un autre lien ne
 * l'écrase pas. Ce n'est qu'une PROVENANCE : le rattachement durable du
 * client se fait à sa première commande, et au moment de commander le
 * serveur décide (client déjà rattaché d'abord, voir attribution-commande).
 */

export const COOKIE_REVENDEUR = 'suguba_ref';
const DUREE_JOURS = 30;
const FORMAT = /^[A-Z0-9-]{3,40}$/;

/** Code revendeur valide (format seulement : son existence est vérifiée par le serveur). */
export function normaliserCodeRevendeur(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const code = brut.trim().toUpperCase();
  return FORMAT.test(code) ? code : null;
}

/** Code porté par l'adresse : ?ref=CODE, ou la boutique /r/CODE. */
export function codeDansAdresse(pathname: string, search: string): string | null {
  const ref = new URLSearchParams(search).get('ref');
  if (ref) return normaliserCodeRevendeur(ref);
  const m = pathname.match(/^\/r\/([^/?#]+)/);
  return m ? normaliserCodeRevendeur(decodeURIComponent(m[1])) : null;
}

/** Valeur du cookie dans une chaîne `document.cookie`. */
export function lireCookie(cookies: string, nom = COOKIE_REVENDEUR): string | null {
  const m = cookies.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${nom}=`));
  return m ? normaliserCodeRevendeur(decodeURIComponent(m.slice(nom.length + 1))) : null;
}

/** Revendeur d'origine gardé sur cet appareil (navigateur uniquement). */
export function revendeurAncre(): string | null {
  if (typeof document === 'undefined') return null;
  return lireCookie(document.cookie);
}

/**
 * Pose le revendeur d'origine s'il n'y en a pas encore. Renvoie le code
 * retenu (l'ancien s'il existait).
 */
export function ancrerRevendeur(code: unknown): string | null {
  if (typeof document === 'undefined') return null;
  const deja = revendeurAncre();
  if (deja) return deja;
  const propre = normaliserCodeRevendeur(code);
  if (!propre) return null;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_REVENDEUR}=${encodeURIComponent(propre)}; Path=/; Max-Age=${DUREE_JOURS * 86_400}; SameSite=Lax${secure}`;
  return propre;
}

/**
 * Code revendeur à utiliser pour cette visite : celui de l'adresse s'il y en
 * a un (le client est sur l'offre de CE revendeur), sinon le revendeur
 * d'origine gardé sur l'appareil.
 */
export function codeRevendeurVisite(refDeLAdresse: string | null | undefined): string | null {
  return normaliserCodeRevendeur(refDeLAdresse) || revendeurAncre();
}
