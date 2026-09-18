/**
 * Missions — logique PURE (§ 13 du cahier des charges).
 */

export type TypeMission = 'share' | 'click' | 'sale' | 'referral' | 'post' | 'view';

export const TYPES_MISSION: { valeur: TypeMission; libelle: string; verbe: string }[] = [
  { valeur: 'share',    libelle: 'Partager',            verbe: 'partages' },
  { valeur: 'click',    libelle: 'Générer des visites', verbe: 'visites' },
  { valeur: 'sale',     libelle: 'Vendre',              verbe: 'ventes' },
  { valeur: 'referral', libelle: 'Parrainer',           verbe: 'parrainages' },
  { valeur: 'post',     libelle: 'Publier un visuel',   verbe: 'publications' },
  { valeur: 'view',     libelle: 'Faire visionner',     verbe: 'vues' },
];

export function libelleType(type: TypeMission): string {
  return TYPES_MISSION.find((t) => t.valeur === type)?.libelle ?? type;
}

export function verbeType(type: TypeMission): string {
  return TYPES_MISSION.find((t) => t.valeur === type)?.verbe ?? 'actions';
}

export interface Mission {
  id: string;
  type: TypeMission;
  objectif: number;
  finitLe: string | null;
  statut: 'draft' | 'active' | 'paused' | 'ended';
  maxParticipants: number | null;
}

export type EtatParticipation = 'joined' | 'completed' | 'validated' | 'rejected';

/** Pourcentage d'avancement, borné à 100. Un objectif à 0 est considéré atteint. */
export function progression(avancement: number, objectif: number): number {
  if (!Number.isFinite(objectif) || objectif <= 0) return 100;
  const brut = (Math.max(0, avancement) / objectif) * 100;
  return Math.min(100, Math.round(brut));
}

/** Une mission est-elle ouverte à de nouveaux participants ? */
export function ouverteALaParticipation(
  mission: Mission,
  participantsActuels: number,
  maintenant: Date,
): { ouverte: boolean; raison?: string } {
  if (mission.statut !== 'active') return { ouverte: false, raison: 'Cette mission n’est pas active.' };
  if (mission.finitLe && new Date(mission.finitLe).getTime() <= maintenant.getTime()) {
    return { ouverte: false, raison: 'Cette mission est terminée.' };
  }
  if (mission.maxParticipants && participantsActuels >= mission.maxParticipants) {
    return { ouverte: false, raison: 'Le nombre maximum de participants est atteint.' };
  }
  return { ouverte: true };
}

/** État après une progression : une mission atteinte passe en « à valider ». */
export function etatApresProgression(
  etatActuel: EtatParticipation,
  avancement: number,
  objectif: number,
): EtatParticipation {
  if (etatActuel !== 'joined') return etatActuel;
  return avancement >= objectif ? 'completed' : 'joined';
}

/** Jours restants (arrondi au supérieur). null = sans date de fin. */
export function joursRestants(finitLe: string | null, maintenant: Date): number | null {
  if (!finitLe) return null;
  const delta = new Date(finitLe).getTime() - maintenant.getTime();
  if (!Number.isFinite(delta)) return null;
  return Math.max(0, Math.ceil(delta / 86400000));
}
