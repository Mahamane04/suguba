/**
 * Équipe (lot U1, 2026-09-27) — règles PURES d'ajout, de changement de rôle
 * et de retrait d'un membre.
 *
 * L'équipe s'inscrit par e-mail ou Google : on AJOUTE un compte existant,
 * trouvé par e-mail, nom ou téléphone. On ne crée jamais de profil : l'ancien
 * « Promouvoir » par téléphone fabriquait, pour un numéro inconnu, un profil
 * « Suguba Ops Master » sans aucun moyen de se connecter.
 */
import type { SugubaRole } from '@/lib/session';

export type TypeRecherche = 'email' | 'telephone' | 'nom';

export const MIN_MOTIF_RETRAIT = 5;

/** Numéro malien : 8 chiffres → +223…, sinon tel quel avec « + ». */
export function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/\D/g, '');
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  if (chiffres.length === 8) return `+223${chiffres}`;
  return `+${chiffres}`;
}

/**
 * Texte de recherche d'un compte. Les caractères qui ont un sens dans un
 * filtre PostgREST (virgule, parenthèses, %, *) sont retirés : la saisie ne
 * doit jamais pouvoir élargir la requête.
 */
export function motifCandidat(brut: unknown):
  | { ok: true; texte: string; type: TypeRecherche }
  | { ok: false; erreur: string } {
  const texte = String(brut ?? '').replace(/[,()%*\\"'`;]/g, ' ').replace(/\s+/g, ' ').trim();
  if (texte.length < 3) return { ok: false, erreur: 'Tapez au moins 3 caractères.' };
  if (texte.length > 80) return { ok: false, erreur: 'Recherche trop longue.' };
  if (texte.includes('@')) return { ok: true, texte: texte.toLowerCase().replace(/\s/g, ''), type: 'email' };
  if (/^[+\d\s.-]+$/.test(texte)) {
    const tel = normaliserTelephone(texte);
    return tel ? { ok: true, texte: tel, type: 'telephone' } : { ok: false, erreur: 'Numéro incomplet : au moins 8 chiffres.' };
  }
  return { ok: true, texte, type: 'nom' };
}

/** Ajouter ce compte à l'équipe : message d'erreur, ou null si permis. */
export function verifierAjout(p: { cibleId: string; moiId: string; statutCompte: string | null; dejaMembre: boolean }): string | null {
  if (p.cibleId === p.moiId) return 'Vous êtes déjà dans l’équipe.';
  if (p.dejaMembre) return 'Ce compte fait déjà partie de l’équipe : changez son rôle dans la liste.';
  if (p.statutCompte === 'suspended' || p.statutCompte === 'rejected') return 'Ce compte est suspendu : réactivez-le avant de l’ajouter à l’équipe.';
  return null;
}

/** Changer le rôle d'un membre. Le dernier Super Admin ne peut pas être rétrogradé. */
export function verifierChangementRole(p: { cibleId: string; moiId: string; ancienRole: string | null; nouveauRole: string; superAdmins: number }): string | null {
  if (p.cibleId === p.moiId) return 'Vous ne pouvez pas modifier vos propres droits.';
  if (p.ancienRole === 'super_admin' && p.nouveauRole !== 'super_admin' && p.superAdmins <= 1) {
    return 'C’est le dernier Super Admin : nommez-en un autre avant de changer ce rôle.';
  }
  return null;
}

/** Retirer un membre. Motif obligatoire ; jamais soi-même ni le dernier Super Admin. */
export function verifierRetrait(p: { cibleId: string; moiId: string; roleCible: string | null; superAdmins: number; motif: unknown }): string | null {
  if (p.cibleId === p.moiId) return 'Vous ne pouvez pas vous retirer vous-même de l’équipe.';
  if (p.roleCible === 'super_admin' && p.superAdmins <= 1) return 'C’est le dernier Super Admin : nommez-en un autre avant de le retirer.';
  if (typeof p.motif !== 'string' || p.motif.trim().length < MIN_MOTIF_RETRAIT) return `Indiquez le motif du retrait (${MIN_MOTIF_RETRAIT} caractères au moins).`;
  return null;
}

const ORDRE_REPLI: SugubaRole[] = ['reseller', 'supplier', 'driver', 'diaspora', 'customer'];

/**
 * Rôle principal du compte après son retrait de l'équipe : son autre profil
 * actif (revendeur, fournisseur…), sinon client.
 */
export function roleDeRepli(roles: { role: string; status: string }[]): SugubaRole {
  return ORDRE_REPLI.find((r) => roles.some((x) => x.role === r && x.status === 'active')) || 'customer';
}

const LIBELLE_PROFIL: Record<string, string> = {
  customer: 'Client', reseller: 'Revendeur', supplier: 'Fournisseur', driver: 'Livreur', diaspora: 'Diaspora', admin: 'Équipe',
};

/** Profils actifs d'un compte, en clair : « Client · Revendeur ». */
export function libelleProfils(roleProfil: string | null, roles: { role: string; status: string }[]): string {
  const actifs = new Set(roles.filter((r) => r.status === 'active').map((r) => r.role));
  if (roleProfil) actifs.add(roleProfil);
  return [...actifs].map((r) => LIBELLE_PROFIL[r] || r).join(' · ') || 'Client';
}
