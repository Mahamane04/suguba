/**
 * Attribution client → revendeur — logique PURE.
 *
 * Question à laquelle ce module répond : « quel revendeur a amené ce
 * client ? ». C'est elle qui décide qui est payé ; elle ne doit donc dépendre
 * d'aucune base ni d'aucune horloge implicite (le `maintenant` est passé en
 * argument pour rester testable).
 *
 * Règle retenue : LE PREMIER CONTACT GAGNE, à vie tant que le revendeur reste
 * actif. L'alternative (« le dernier lien cliqué gagne ») est plus simple à
 * coder mais ouvre un abus évident : il suffirait de renvoyer son lien à un
 * client qu'un autre a mis des semaines à convaincre, juste avant sa commande,
 * pour lui prendre sa commission.
 *
 * L'exception est la ré-attribution explicite par un administrateur, qui passe
 * par `motif: 'admin'` — tracée, décidée par un humain.
 */

export interface AttributionExistante {
  resellerId: string | null;
  source: string;
  linkCode: string | null;
  firstSeenAt: string;
}

export interface ContactEntrant {
  resellerId: string | null;
  source: string;
  linkCode: string | null;
  /** 'admin' force la ré-attribution ; tout le reste respecte le premier contact. */
  motif?: 'visite' | 'commande' | 'admin';
}

export interface DecisionAttribution {
  /** Le revendeur référent après décision. */
  resellerId: string | null;
  /** Faut-il écrire une nouvelle ligne / mettre à jour le référent ? */
  changeLeReferent: boolean;
  /** Faut-il au moins rafraîchir le « dernier passage » (statistiques) ? */
  metAJourDernierPassage: boolean;
  raison: 'premier-contact' | 'referent-conserve' | 'reattribution-admin' | 'aucun-revendeur';
}

export function deciderAttribution(
  existante: AttributionExistante | null,
  entrant: ContactEntrant,
): DecisionAttribution {
  if (!existante) {
    if (!entrant.resellerId) {
      return { resellerId: null, changeLeReferent: false, metAJourDernierPassage: false, raison: 'aucun-revendeur' };
    }
    return {
      resellerId: entrant.resellerId,
      changeLeReferent: true,
      metAJourDernierPassage: true,
      raison: 'premier-contact',
    };
  }

  if (entrant.motif === 'admin' && entrant.resellerId) {
    return {
      resellerId: entrant.resellerId,
      changeLeReferent: true,
      metAJourDernierPassage: true,
      raison: 'reattribution-admin',
    };
  }

  // Cas particulier : une ligne existe mais son revendeur a été détaché
  // (compte supprimé, ON DELETE SET NULL). Le premier revendeur qui se
  // présente ensuite devient légitimement le référent — personne n'est lésé.
  if (!existante.resellerId && entrant.resellerId) {
    return {
      resellerId: entrant.resellerId,
      changeLeReferent: true,
      metAJourDernierPassage: true,
      raison: 'premier-contact',
    };
  }

  return {
    resellerId: existante.resellerId,
    changeLeReferent: false,
    metAJourDernierPassage: Boolean(entrant.resellerId || entrant.linkCode),
    raison: 'referent-conserve',
  };
}

/**
 * Téléphone malien normalisé en clé d'attribution : `+223 76 12 34 56`,
 * `0022376123456` et `76123456` désignent la même personne. Sans cette
 * normalisation, un même client aurait plusieurs référents selon la façon
 * dont il a tapé son numéro.
 */
export function cleClient(telephone: unknown): string | null {
  if (typeof telephone !== 'string') return null;
  let chiffres = telephone.replace(/[^\d+]/g, '');
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1);
  chiffres = chiffres.replace(/\D/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  // Numéro local malien (8 chiffres) : on préfixe l'indicatif pays.
  if (chiffres.length === 8) chiffres = `223${chiffres}`;
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  return `+${chiffres}`;
}
