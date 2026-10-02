/**
 * Règles du formulaire de commande, communes à l'achat direct et au panier
 * (PUB-10, audit UI/UX du 2026-10-02) — logique PURE, partagée navigateur / tests.
 *
 * Les deux tunnels recopiaient leurs règles et en divergeaient : le panier
 * affichait « Ce code n'est pas valable » pour un code reconnu mais sans
 * remise, et ses erreurs de champ ne menaient pas au champ fautif.
 */

export type ModeReception = 'home_delivery' | 'pickup_point';

export interface SaisieCommande {
  nom: string;
  telephone: string;
  mode: ModeReception;
  quartier: string;
  repere: string;
}

export interface ErreursCommande { nom?: string; tel?: string; quartier?: string; repere?: string }

/** « 70 12-34.56 » → « 70123456 ». */
export const telephoneNormalise = (telephone: string) => telephone.replace(/[\s().-]/g, '');

export function erreursCommande(s: SaisieCommande): ErreursCommande {
  const domicile = s.mode === 'home_delivery';
  return {
    nom: s.nom.trim().length < 2 ? 'Indiquez votre nom et prénom.' : undefined,
    tel: !/^\+?\d{8,15}$/.test(telephoneNormalise(s.telephone)) ? 'Numéro invalide : 8 chiffres minimum.' : undefined,
    quartier: domicile && !s.quartier.trim() ? 'Choisissez votre quartier.' : undefined,
    repere: domicile && !s.repere.trim() ? 'Un repère aide le livreur à vous trouver.' : undefined,
  };
}

/** Identifiants des champs, dans l'ordre de l'écran : la première erreur est celle qu'on montre. */
export const CHAMPS_COMMANDE: [keyof ErreursCommande, string][] = [
  ['nom', 'champ-nom'], ['tel', 'champ-tel'], ['quartier', 'champ-quartier'], ['repere', 'champ-repere'],
];

export function premierChampEnErreur(erreurs: ErreursCommande): string | null {
  return CHAMPS_COMMANDE.find(([cle]) => erreurs[cle])?.[1] ?? null;
}

export type AvisPromo = { ton: 'succes' | 'attente' | 'erreur'; texte: string } | null;

/**
 * Message du code promo, quel que soit le tunnel : appliqué (montant), reconnu
 * mais sans remise sur ces articles, ou invalide.
 */
export function avisCodePromo(p: { soumis: string; reconnu: boolean | null; remise: number; plafonnee?: boolean; formater: (n: number) => string }): AvisPromo {
  if (!p.soumis || p.reconnu === null) return null;
  if (!p.reconnu) return { ton: 'erreur', texte: 'Code invalide ou expiré.' };
  if (p.remise > 0) return { ton: 'succes', texte: `Code ${p.soumis} appliqué : −${p.formater(p.remise)}${p.plafonnee ? ' (remise maximale sur cet article)' : ''}` };
  return { ton: 'attente', texte: `Code ${p.soumis} reconnu, mais aucune remise n’est possible sur ces articles.` };
}
