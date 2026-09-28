import { fusionnerBrouillon } from '@/lib/admin/settings-draft';
import { avecJournal } from '@/lib/admin/journal-route';
import { exigerValidation, marquerExecutee } from '@/lib/admin/securite';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { actualiserSiAncien, releveAncien } from '@/lib/tarifs-saspay';
import { completerFraisPaiement } from '@/lib/frais-paiement';
import { adminPeut } from '@/lib/reseau/db';
import { baissesPartSuguba } from '@/lib/protection';
import {
  tarifProduit,
  completerReglages,
  coutFixeParCommande,
  totalCoutsFixes,
  validerReglages,
  type ReglagesPlateforme,
} from '@/lib/pricing';

/**
 * Réglages économiques de la plateforme — lecture et modification, admin seul.
 *
 * Enregistrer de nouveaux réglages recalcule AUTOMATIQUEMENT la commission de
 * tous les produits approuvés. En revanche, le prix de vente n'est jamais
 * modifié ici : des liens déjà partagés sur WhatsApp afficheraient un prix
 * faux. La route renvoie la liste des produits qui passent sous le plancher,
 * avec leur prix minimal, pour que l'admin décide lui-même.
 */

async function exigerAdmin(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/settings');
  if (refusEquipe) return refusEquipe;
  if (!(await exigerAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  let etat;
  try { etat = await chargerReglages(true); } catch { return NextResponse.json({ error: 'Réglages indisponibles. Réessayez.' }, { status: 503 }); }
  // Tarifs SasPay (2026-09-27) : ceux relus automatiquement ; relus en
  // arrière-plan si le relevé a plus de 6 heures.
  const fraisPaiement = completerFraisPaiement(etat.reglages.fraisPaiement);
  actualiserSiAncien(fraisPaiement);
  // Produits en ligne (2026-09-24) : le panneau calcule en direct l'effet des
  // réglages en cours d'édition sur chacun, AVANT d'enregistrer.
  const admin = getSupabaseAdmin();
  const { data: produits, error: erreurProduits } = admin
    ? await admin
      .from('products')
      // `*` : inclut mode_prix dès que la base l'a (articles au prix de gros).
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(300)
    : { data: [], error: null };
  if (erreurProduits) return NextResponse.json({ error: 'Impact catalogue indisponible. Réessayez.' }, { status: 503 });
  return NextResponse.json({
    ...etat,
    produits: produits || [],
    totalCoutsFixes: totalCoutsFixes(etat.reglages),
    coutFixeParCommande: Math.round(coutFixeParCommande(etat.reglages)),
    tarifsSasPay: { releveLe: fraisPaiement.saspay.releveLe, ancien: releveAncien(fraisPaiement) },
  });
}

export async function PUT(req: NextRequest) {
  return avecJournal(req, 'PUT /api/admin/settings', () => putInterne(req));
}

async function putInterne(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'PUT /api/admin/settings');
  if (refusEquipe) return refusEquipe;
  const session = await exigerAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (!body.reglages || typeof body.reglages !== 'object' || Array.isArray(body.reglages)) return NextResponse.json({ error: 'Réglages requis.' }, { status: 400 });
  if (!body.baseReglages || typeof body.baseReglages !== 'object' || Array.isArray(body.baseReglages)) return NextResponse.json({ error: 'Rechargez les réglages avant de les modifier.' }, { status: 409 });
  let etat;
  try { etat = await chargerReglages(true); } catch { return NextResponse.json({ error: 'Réglages indisponibles.' }, { status: 503 }); }
  const actuels = etat.reglages;
  let reglages: ReglagesPlateforme;
  try { reglages = completerReglages(body.reglages as Partial<ReglagesPlateforme>); }
  catch { return NextResponse.json({ error: 'Format des réglages invalide.' }, { status: 400 }); }
  if (body.baseReglages) {
    try { reglages = fusionnerBrouillon(actuels, completerReglages(body.baseReglages), reglages); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
  }

  let erreurs: string[];
  try { erreurs = validerReglages(reglages); }
  catch { return NextResponse.json({ error: 'Format des réglages invalide.' }, { status: 400 }); }
  if (erreurs.length > 0) {
    return NextResponse.json({ error: erreurs.join(' '), erreurs }, { status: 400 });
  }

  // Protection Suguba (lot 3) : baisser la part de Suguba n'est pas une
  // modification technique. Droit dédié, motif obligatoire, trace gardée.

  const baisses = baissesPartSuguba(actuels, reglages);
  let validationPart: string | null = null;
  const motif = typeof body.motif === 'string' ? body.motif.trim().slice(0, 500) : '';
  if (baisses.length > 0) {
    if (!(await adminPeut(session.uid, 'marge.reduire'))) {
      return NextResponse.json({ error: `Ces changements réduisent la part de Suguba (${baisses.map((b) => b.libelle).join(', ')}) : réservé aux membres qui ont le droit « Baisser la part Suguba ».` }, { status: 403 });
    }
    if (motif.length < 5) {
      return NextResponse.json({ error: 'Ces changements réduisent la part de Suguba : indiquez le motif (promotion, lancement, accord commercial…).', motifRequis: true, baisses }, { status: 409 });
    }
    // Double validation (A3) : quand elle est active, une baisse de la part
    // Suguba doit être approuvée par un autre membre ayant le même droit.
    const validation = await exigerValidation(admin, {
      type: 'part_suguba', dossier: 'reglages:part-suguba', montant: null,
      resume: { baisses: baisses.map((b) => ({ libelle: b.libelle, avant: b.avant, apres: b.apres })), motif },
      demandeurId: session.uid,
    });
    if (!validation.ok) return NextResponse.json(validation.corps, { status: validation.status });
    validationPart = validation.validationId;
    const { error: eJournal } = await admin.from('journal_part_suguba').insert({ admin_id: session.uid, motif, changements: baisses });
    if (eJournal) {
      return NextResponse.json({ error: 'Journal de la part Suguba indisponible : enregistrement annulé. Réessayez.' }, { status: 503 });
    }
  }

  const valeur = { id: 1, valeurs: reglages, confirme: true, updated_at: new Date().toISOString(), updated_by: session.uid };
  // Compare-and-swap protects changes made between our read and write.
  const sauvegarde = body.baseReglages
    ? etat.majLe
      ? await admin.from('platform_settings').update(valeur).eq('id', 1).eq('updated_at', etat.majLe).select('id').maybeSingle()
      : await admin.from('platform_settings').insert(valeur).select('id').maybeSingle()
    : await admin.from('platform_settings').upsert(valeur);
  if (sauvegarde.error || (body.baseReglages && !sauvegarde.data)) return NextResponse.json({ error: 'Enregistrement non effectué : les réglages ont changé ou la base est indisponible. Rechargez avant de réessayer.' }, { status: 409 });
  await marquerExecutee(admin, validationPart);

  // ── Recalcul des commissions de tous les produits approuvés ─────────────
  const produits: any[] = [];
  let erreurLectureProduits = false;
  for (let page = 0; page < 100; page++) {
    const { data, error } = await admin.from('products').select('*').eq('status', 'approved').order('id').range(page * 1000, page * 1000 + 999);
    if (error) { erreurLectureProduits = true; break; }
    produits.push(...(data || []));
    if (!data || data.length < 1000) break;
    if (page === 99) erreurLectureProduits = true;
  }

  const alertes: { id: string; nom: string; statut: string; prixVente: number; prixMinimal: number }[] = [];
  let recalcules = 0;
  let echecs = 0;
  const maintenant = new Date().toISOString();

  for (const p of produits || []) {
    // La part revendeur choisie par le fournisseur est conservée (sauf en mode automatique).
    // Prix de gros : commission indicative au prix conseillé (le revendeur
    // fixe ensuite son propre prix).
    const t = tarifProduit({
      prixFournisseur: Number(p.supplier_price), prixVente: Number(p.public_price),
      commissionProposee: p.commission_proposee, modePrix: p.mode_prix,
    }, reglages);
    if (t.statut !== 'ok') {
      alertes.push({ id: p.id, nom: p.name, statut: t.statut, prixVente: t.prixVente, prixMinimal: t.prixMinimal });
    }
    const { error: majErr } = await admin
      .from('products')
      .update({ reseller_commission: t.commission, pricing_status: t.statut, pricing_computed_at: maintenant })
      .eq('id', p.id);
    if (!majErr) recalcules++; else echecs++;
  }

  return NextResponse.json({
    success: true,
    reglages,
    avertissement: erreurLectureProduits || echecs > 0 ? 'Les réglages sont sauvegardés, mais certaines commissions du catalogue n’ont pas été actualisées. Vérifiez le catalogue avant de poursuivre.' : null,
    recalcules,
    alertes,
    totalCoutsFixes: totalCoutsFixes(reglages),
    coutFixeParCommande: Math.round(coutFixeParCommande(reglages)),
  });
}
