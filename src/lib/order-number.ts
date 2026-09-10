/**
 * Génération des numéros de commande Suguba.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 * L'ancienne formule tenait en une ligne dans store.ts :
 *
 *     `SG-${Math.floor(10000 + Math.random() * 90000)}`
 *
 * Soit 90 000 valeurs tirées au hasard, sans aucun contrôle d'unicité —
 * alors que `orders.order_number` est `UNIQUE NOT NULL` en base. Par le
 * paradoxe des anniversaires, deux commandes partagent le même numéro avec
 * 49 % de probabilité dès la 350ᵉ, et 99,6 % dès la 1000ᵉ.
 *
 * À la collision, l'INSERT Postgres échoue. Et comme la synchronisation part
 * en arrière-plan sans que personne n'attende son résultat, l'échec était
 * SILENCIEUX : le client voyait sa page de confirmation et son code secret,
 * mais la commande n'existait nulle part. Ni paiement, ni livreur, ni trace.
 *
 * ── Le choix retenu ──────────────────────────────────────────────────────
 * 8 caractères tirés d'un alphabet de 30 symboles sans ambiguïté visuelle,
 * soit 6,5 × 10¹¹ combinaisons. À 100 000 commandes, la probabilité qu'une
 * seule collision survienne est de l'ordre de 10⁻⁵ %. Autrement dit : jamais.
 *
 * L'alphabet exclut `0/O`, `1/I/L` et `U` : un client dicte son numéro au
 * service client par téléphone, et un livreur le lit sur un écran en plein
 * soleil. Confondre un zéro et un O ferait échouer la recherche sans que
 * personne ne comprenne pourquoi.
 */

/** 30 symboles — ni 0/O, ni 1/I/L, ni U. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const LONGUEUR = 8;

/**
 * Octets aléatoires, de la meilleure source disponible.
 * `crypto` existe côté navigateur comme côté Node depuis longtemps ; le repli
 * sur Math.random ne sert que pour un environnement d'exécution exotique.
 */
function octetsAleatoires(n: number): Uint8Array {
  const octets = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(octets);
    return octets;
  }
  for (let i = 0; i < n; i++) octets[i] = Math.floor(Math.random() * 256);
  return octets;
}

/**
 * Un numéro de commande, au format `SG-XXXXXXXX`.
 *
 * Le tirage rejette les octets qui tomberaient dans la zone de repli du
 * modulo : avec 256 % 30 = 16, prendre `octet % 30` sans précaution rendrait
 * les 16 premiers symboles de l'alphabet plus probables que les autres.
 * Un biais sans gravité ici, mais gratuit à éviter.
 */
export function genererNumeroCommande(): string {
  const limite = 256 - (256 % ALPHABET.length); // 240
  let sortie = '';
  while (sortie.length < LONGUEUR) {
    for (const octet of octetsAleatoires(LONGUEUR)) {
      if (octet >= limite) continue;
      sortie += ALPHABET[octet % ALPHABET.length];
      if (sortie.length === LONGUEUR) break;
    }
  }
  return `SG-${sortie}`;
}

/**
 * Normalise ce qu'un humain a saisi : espaces, minuscules, préfixe oublié.
 *
 * Volontairement AUCUNE correction de caractères ambigus. On pourrait être
 * tenté de remplacer un `O` par un `Q` puisque ni `O` ni `0` n'existent dans
 * l'alphabet — donc les saisir est forcément une erreur. Mais on ignore
 * laquelle : un `O` mal lu peut valoir `Q`, `D` ou `2`. Deviner ferait tomber
 * sur la commande d'un AUTRE client, ce qui est bien pire qu'une recherche
 * infructueuse. Mieux vaut ne rien trouver et le dire.
 */
export function normaliserNumeroCommande(saisie: string): string {
  const brut = saisie.trim().toUpperCase().replace(/^SG-?/, '').replace(/[\s-]/g, '');
  return brut ? `SG-${brut}` : '';
}
