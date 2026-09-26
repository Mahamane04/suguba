import type { SupabaseClient } from '@supabase/supabase-js';
import { empreinteVisiteur } from './db';
import { estRobotApercu } from './missions';
import { lireReglagesReseau } from './recompenses';
import { notifier } from './notifications';
import { nomPublic } from '../shop';
import { contestable, empreinteReseau, lireJeton, signerJeton, tauxQualification } from './resultats';

/**
 * Rémunération au résultat (2026-09-26, lot 3) — SERVEUR UNIQUEMENT.
 *
 * Visites : la page produit ouverte par le lien d'un revendeur demande un
 * jeton (debutVisite), puis le rend après 20 s et un geste (qualifierVisite).
 * Toute visite est MESURÉE (visites_mesurees), même sans campagne et même
 * interrupteur coupé : c'est ce qui permet de juger la fiabilité avant de
 * payer. Le paiement passe par la fonction SQL enregistrer_resultat_campagne,
 * qui fait foi (interrupteur, budget, doublons, plafond, 80 %, 7 jours).
 *
 * Demandes : comptées par la base elle-même (triggers sur devis et commandes).
 */

export class ResultatError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const secret = () => process.env.SESSION_SECRET || '';
const jourDe = (t: number) => new Date(t).toISOString().slice(0, 10);

async function revendeurActif(admin: SupabaseClient, code: string): Promise<string | null> {
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) return null;
  const { data: profil } = await admin.from('profiles').select('id').eq('reseller_code', code).maybeSingle();
  if (!profil) return null;
  const { data: role } = await admin.from('profile_roles').select('status')
    .eq('profile_id', profil.id).eq('role', 'reseller').maybeSingle();
  return role?.status === 'active' ? profil.id : null;
}

interface Visiteur { ip: string | null; userAgent: string | null; sessionUid: string | null }

// ── Visites ─────────────────────────────────────────────────────────────────
export async function debutVisite(admin: SupabaseClient, params: { produitId: unknown; code: unknown } & Visiteur) {
  const produitId = typeof params.produitId === 'string' ? params.produitId.slice(0, 64) : '';
  const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
  if (!produitId || !code || !secret()) return { jeton: null };
  if (estRobotApercu(params.userAgent)) return { jeton: null };

  const resellerId = await revendeurActif(admin, code);
  // Le revendeur qui ouvre son propre lien n'est pas un visiteur.
  if (!resellerId || resellerId === params.sessionUid) return { jeton: null };
  const { data: produit } = await admin.from('products').select('id').eq('id', produitId).eq('status', 'approved').maybeSingle();
  if (!produit) return { jeton: null };

  const visiteur = empreinteVisiteur(params.ip, params.userAgent);
  const t = Date.now();
  await admin.from('visites_mesurees').upsert({
    product_id: produitId, reseller_id: resellerId, visiteur,
    reseau: empreinteReseau(params.ip, secret()), etat: 'ouverte', jour: jourDe(t),
  }, { onConflict: 'product_id,reseller_id,visiteur,jour', ignoreDuplicates: true });
  return { jeton: signerJeton({ produit: produitId, code, visiteur, t }, `${secret()}|visite`) };
}

export async function qualifierVisite(admin: SupabaseClient, params: { jeton: unknown } & Visiteur) {
  if (!secret() || estRobotApercu(params.userAgent)) return { qualifiee: false, payees: 0 };
  const visiteur = empreinteVisiteur(params.ip, params.userAgent);
  const lu = lireJeton(params.jeton, `${secret()}|visite`, visiteur);
  if (!lu.ok) return { qualifiee: false, payees: 0, raison: lu.raison };
  const { produit, code, t } = lu.contenu;

  const resellerId = await revendeurActif(admin, code);
  if (!resellerId || resellerId === params.sessionUid) return { qualifiee: false, payees: 0 };

  const { data: maj } = await admin.from('visites_mesurees')
    .update({ etat: 'qualifiee', qualifiee_le: new Date().toISOString() })
    .eq('product_id', produit).eq('reseller_id', resellerId).eq('visiteur', visiteur).eq('jour', jourDe(t)).eq('etat', 'ouverte')
    .select('id').maybeSingle();
  // Déjà qualifiée (page rechargée) : rien à refaire.
  if (!maj) return { qualifiee: true, payees: 0 };

  // Paiement : seulement les campagnes « visites » actives sur ce produit.
  const { data: campagnes } = await admin.from('missions').select('id')
    .eq('mission_type', 'visite_qualifiee').eq('status', 'active').eq('product_id', produit);
  let payees = 0;
  for (const c of campagnes || []) {
    const { data, error } = await admin.rpc('enregistrer_resultat_campagne', {
      p_mission_id: c.id, p_reseller_id: resellerId, p_genre: 'visite', p_cle: `visiteur:${visiteur}`,
      p_origine: null, p_reseau: empreinteReseau(params.ip, secret()),
    });
    if (error) { console.error('[RESULTATS] visite non enregistrée:', error.code); continue; }
    if ((data as { compte?: boolean } | null)?.compte) payees++;
  }
  return { qualifiee: true, payees };
}

/** Robot d'aperçu sur un lien produit : compté à part, pour la page qualité. */
export async function mesurerRobot(admin: SupabaseClient, produitId: string, resellerId: string, ip: string | null, userAgent: string | null) {
  await admin.from('visites_mesurees').upsert({
    product_id: produitId, reseller_id: resellerId, visiteur: empreinteVisiteur(ip, userAgent), etat: 'robot', jour: jourDe(Date.now()),
  }, { onConflict: 'product_id,reseller_id,visiteur,jour', ignoreDuplicates: true });
}

// ── Lecture des résultats ───────────────────────────────────────────────────
const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));

export interface ResultatVue {
  id: string; missionId: string; campagne: string; genre: 'visite' | 'demande';
  revendeur: { nom: string; code: string | null }; prix: number; partRevendeur: number;
  statut: 'retenu' | 'a_verifier' | 'conteste' | 'annule'; motif: string | null; origine: string | null;
  creeLe: string; contestable: boolean;
}

async function versVues(admin: SupabaseClient, lignes: any[]): Promise<ResultatVue[]> {
  if (!lignes.length) return [];
  const [{ data: missions }, { data: profils }] = await Promise.all([
    admin.from('missions').select('id, title').in('id', [...new Set(lignes.map((r) => r.mission_id))]),
    admin.from('profiles').select('id, full_name, reseller_code').in('id', [...new Set(lignes.map((r) => r.reseller_id))]),
  ]);
  const m = new Map((missions || []).map((x: any) => [x.id, x]));
  const p = new Map((profils || []).map((x: any) => [x.id, x]));
  return lignes.map((r) => ({
    id: r.id, missionId: r.mission_id, campagne: (m.get(r.mission_id) as any)?.title || 'Campagne', genre: r.genre,
    revendeur: { nom: (p.get(r.reseller_id) as any)?.full_name || 'Revendeur', code: (p.get(r.reseller_id) as any)?.reseller_code || null },
    prix: Number(r.prix) || 0, partRevendeur: Number(r.part_revendeur) || 0, statut: r.statut, motif: r.motif || null,
    origine: r.origine || null, creeLe: r.created_at, contestable: contestable(r.statut, r.created_at),
  }));
}

/** Résultats des campagnes d'un fournisseur (les 200 derniers). */
export async function resultatsFournisseur(admin: SupabaseClient, fournisseurId: string) {
  const { data: campagnes } = await admin.from('missions').select('id').eq('supplier_id', fournisseurId)
    .in('mission_type', ['visite_qualifiee', 'demande_qualifiee']);
  const ids = (campagnes || []).map((c: any) => c.id);
  if (!ids.length) return [];
  const { data, error } = await admin.from('campagne_resultats').select('*').in('mission_id', ids)
    .order('created_at', { ascending: false }).limit(200);
  if (error) return [];
  // Le fournisseur ne voit que « Awa D. » et pas le code du revendeur.
  return (await versVues(admin, data || [])).map((r) => ({ ...r, revendeur: { nom: nomPublic(r.revendeur.nom), code: null } }));
}

export async function contesterResultat(admin: SupabaseClient, fournisseurId: string, params: { id: unknown; motif: unknown }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 300) : '';
  if (!id) throw new ResultatError('Résultat manquant.', 400);
  if (motif.length < 5) throw new ResultatError('Expliquez en quelques mots pourquoi ce résultat n’est pas sérieux.', 400);
  const { data: r } = await admin.from('campagne_resultats').select('id, mission_id').eq('id', id).maybeSingle();
  if (!r) throw new ResultatError('Résultat introuvable.', 404);
  const { data: m } = await admin.from('missions').select('supplier_id').eq('id', r.mission_id).maybeSingle();
  if (!m || m.supplier_id !== fournisseurId) throw new ResultatError('Résultat introuvable.', 404);
  const { error } = await admin.rpc('decider_resultat_campagne', { p_id: id, p_decision: 'contester', p_par: fournisseurId, p_motif: motif });
  if (error) throw erreurDecision(error.message);
  return { statut: 'conteste' as const };
}

function erreurDecision(message: string) {
  if (/DELAI_DEPASSE/.test(message)) return new ResultatError('Le délai de 48 h pour contester est dépassé.', 409);
  if (/DEJA_TRAITE/.test(message)) return new ResultatError('Ce résultat a déjà été traité.', 409);
  if (/DEJA_VERSE/.test(message)) return new ResultatError('Le gain est déjà retirable par le revendeur : il ne peut plus être annulé ici.', 409);
  return new ResultatError('Décision impossible pour le moment. Réessayez.', 503);
}

// ── Admin ───────────────────────────────────────────────────────────────────
export async function resultatsAdmin(admin: SupabaseClient) {
  const [aVerifier, recents] = await Promise.all([
    admin.from('campagne_resultats').select('*').in('statut', ['a_verifier', 'conteste']).order('created_at', { ascending: true }).limit(100),
    admin.from('campagne_resultats').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  if (aVerifier.error) {
    if (tableAbsente(aVerifier.error.code)) return { migrationRequise: true, aVerifier: [], recents: [] };
    throw new ResultatError('Résultats indisponibles.', 503);
  }
  return { migrationRequise: false, aVerifier: await versVues(admin, aVerifier.data || []), recents: await versVues(admin, recents.data || []) };
}

export async function deciderResultatAdmin(admin: SupabaseClient, adminId: string, params: { id: unknown; decision: unknown; motif?: unknown }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 300) : '';
  if (!id) throw new ResultatError('Résultat manquant.', 400);
  if (params.decision !== 'valider' && params.decision !== 'annuler') throw new ResultatError('Décision inconnue.', 400);
  if (params.decision === 'annuler' && motif.length < 3) throw new ResultatError('Indiquez le motif de l’annulation (le revendeur le verra).', 400);
  const { data: r } = await admin.from('campagne_resultats').select('reseller_id, part_revendeur').eq('id', id).maybeSingle();
  if (!r) throw new ResultatError('Résultat introuvable.', 404);
  const { data, error } = await admin.rpc('decider_resultat_campagne', { p_id: id, p_decision: params.decision, p_par: adminId, p_motif: motif || null });
  if (error) throw erreurDecision(error.message);
  if (params.decision === 'annuler') {
    await notifier(r.reseller_id, {
      type: 'mission', titre: 'Résultat de campagne annulé',
      texte: `${Number(r.part_revendeur).toLocaleString('fr-FR')} F retirés de vos gains en attente : ${motif}`, lien: '/reseller/missions',
    });
  }
  return { statut: data as string };
}

/** Page « Qualité des mesures » : 30 derniers jours, par revendeur. */
export async function qualiteMesures(admin: SupabaseClient) {
  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [visites, resultats, reglages] = await Promise.all([
    admin.from('visites_mesurees').select('reseller_id, reseau, etat, jour').gte('jour', depuis).limit(20000),
    admin.from('campagne_resultats').select('reseller_id, statut, prix').gte('created_at', depuis).limit(20000),
    lireReglagesReseau(),
  ]);
  if (visites.error) {
    if (tableAbsente(visites.error.code)) return { migrationRequise: true, actif: reglages.remunerationResultat, total: null, revendeurs: [] };
    throw new ResultatError('Mesures indisponibles.', 503);
  }

  type Agregat = { ouvertes: number; qualifiees: number; robots: number; reseaux: Map<string, number>; payes: number; annules: number; montant: number };
  const par = new Map<string, Agregat>();
  const agregat = (id: string) => {
    if (!par.has(id)) par.set(id, { ouvertes: 0, qualifiees: 0, robots: 0, reseaux: new Map(), payes: 0, annules: 0, montant: 0 });
    return par.get(id)!;
  };
  for (const v of visites.data || []) {
    const a = agregat(v.reseller_id);
    if (v.etat === 'ouverte') a.ouvertes++;
    else if (v.etat === 'qualifiee') a.qualifiees++;
    else a.robots++;
    if (v.reseau && v.etat === 'qualifiee') {
      const cle = `${v.jour}|${v.reseau}`;
      a.reseaux.set(cle, (a.reseaux.get(cle) || 0) + 1);
    }
  }
  for (const r of resultats.data || []) {
    const a = agregat(r.reseller_id);
    if (r.statut === 'annule') a.annules++;
    else { a.payes++; a.montant += Number(r.prix) || 0; }
  }

  const ids = [...par.keys()];
  const { data: profils } = ids.length
    ? await admin.from('profiles').select('id, full_name, reseller_code').in('id', ids.slice(0, 500))
    : { data: [] as any[] };
  const p = new Map((profils || []).map((x: any) => [x.id, x]));

  const revendeurs = [...par.entries()].map(([id, a]) => ({
    id, nom: (p.get(id) as any)?.full_name || 'Revendeur', code: (p.get(id) as any)?.reseller_code || null,
    ouvertes: a.ouvertes, qualifiees: a.qualifiees, robots: a.robots,
    taux: tauxQualification(a.ouvertes, a.qualifiees),
    // Plus grand nombre de visites qualifiées d'un même réseau le même jour.
    maxMemeReseau: Math.max(0, ...a.reseaux.values()),
    payes: a.payes, annules: a.annules, montant: a.montant,
  })).sort((x, y) => (y.qualifiees + y.ouvertes) - (x.qualifiees + x.ouvertes)).slice(0, 100);

  const total = revendeurs.reduce((t, r) => ({
    ouvertes: t.ouvertes + r.ouvertes, qualifiees: t.qualifiees + r.qualifiees, robots: t.robots + r.robots,
    payes: t.payes + r.payes, annules: t.annules + r.annules, montant: t.montant + r.montant,
  }), { ouvertes: 0, qualifiees: 0, robots: 0, payes: 0, annules: 0, montant: 0 });

  return { migrationRequise: false, actif: reglages.remunerationResultat, total, revendeurs };
}

/** Gains d'un revendeur sur les campagnes au résultat, par campagne. */
export async function gainsRevendeur(admin: SupabaseClient, resellerId: string) {
  const { data, error } = await admin.from('campagne_resultats').select('mission_id, statut, part_revendeur')
    .eq('reseller_id', resellerId).limit(2000);
  if (error) return {};
  const par: Record<string, { resultats: number; gagne: number; annules: number }> = {};
  for (const r of data || []) {
    const g = (par[r.mission_id] ||= { resultats: 0, gagne: 0, annules: 0 });
    if (r.statut === 'annule') { g.annules++; continue; }
    g.resultats++;
    g.gagne += Number(r.part_revendeur) || 0;
  }
  return par;
}
