import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { listerMissions } from '@/lib/reseau/missions-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TYPES_MISSION } from '@/lib/reseau/missions';
import { estTypeResultat } from '@/lib/reseau/resultats-constantes';
import { lireReglagesReseau } from '@/lib/reseau/recompenses';

/** Administration des missions (§ 48 des écrans). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'mission.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux missions.' }, { status: 403 });
  }
  // Les campagnes au résultat (lot 3) ne se créent que côté fournisseur.
  return NextResponse.json({ missions: await listerMissions(), types: TYPES_MISSION.filter((t) => !estTypeResultat(t.valeur)) });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'mission.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de créer une mission.' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));

  // Budget reçu d'une campagne : historique des paiements (/api/admin/paiements-recus).
  if (corps.action === 'budget') {
    return NextResponse.json({ error: 'Les paiements reçus s’enregistrent désormais dans l’historique « Paiements reçus ».' }, { status: 410 });
  }

  // Changement de statut d'une mission existante.
  if (typeof corps.missionId === 'string') {
    if (!['draft', 'active', 'paused', 'ended'].includes(corps.statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }
    if (corps.statut === 'active') {
      const { data: m } = await admin.from('missions').select('*').eq('id', corps.missionId).maybeSingle();
      if (m && estTypeResultat(m.mission_type)) {
        // Campagne au résultat (lot 3) : interrupteur allumé, budget prévu
        // réglé à la première ouverture, puis de quoi payer un résultat.
        if (!(await lireReglagesReseau()).remunerationResultat) {
          return NextResponse.json({ error: 'La rémunération au résultat est désactivée : activez-la dans « Qualité des mesures » avant d’ouvrir cette campagne.' }, { status: 409 });
        }
        const prix = Number(m.reward_amount) || 0;
        const recu = Number(m.budget_recu) || 0;
        const consomme = Number(m.budget_consomme) || 0;
        const prevu = prix * (Number(m.objective) || 1);
        const attendu = consomme === 0 ? prevu : consomme + prix;
        if (recu < attendu) {
          return NextResponse.json({ error: `Budget pas encore réglé : ${attendu.toLocaleString('fr-FR')} F attendus, ${recu.toLocaleString('fr-FR')} F reçus.` }, { status: 409 });
        }
      }
      const du = (Number(m?.reward_amount) || 0) * (Number(m?.max_participants) || 0);
      if (m?.supplier_id && !estTypeResultat(m.mission_type) && 'budget_recu' in m && (Number(m.budget_recu) || 0) < du) {
        return NextResponse.json({ error: `Budget de la campagne pas encore réglé en entier (${du.toLocaleString('fr-FR')} F attendus) : enregistrez le paiement du fournisseur avant de l’activer.` }, { status: 409 });
      }
    }
    const { error } = await admin.from('missions').update({ status: corps.statut }).eq('id', corps.missionId);
    if (error && /BUDGET_NON_REGLE/.test(error.message)) {
      return NextResponse.json({ error: 'Budget de la campagne pas encore réglé en entier : enregistrez le paiement du fournisseur avant de l’activer.' }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const titre = typeof corps.titre === 'string' ? corps.titre.trim() : '';
  const type = TYPES_MISSION.find((t) => t.valeur === corps.type && !estTypeResultat(t.valeur))?.valeur;
  if (titre.length < 3 || !type) {
    return NextResponse.json({ error: 'Titre et type de mission requis.' }, { status: 400 });
  }

  const objectif = Math.max(1, Math.min(10000, Number(corps.objectif) || 1));
  const recompense = Math.max(0, Math.min(1000000, Number(corps.recompense) || 0));

  const { data, error } = await admin
    .from('missions')
    .insert({
      title: titre.slice(0, 120),
      description: typeof corps.description === 'string' ? corps.description.slice(0, 600) : null,
      mission_type: type,
      objective: objectif,
      reward_amount: recompense,
      reward_label: typeof corps.recompenseLibelle === 'string' ? corps.recompenseLibelle.slice(0, 80) : null,
      conditions: typeof corps.conditions === 'string' ? corps.conditions.slice(0, 400) : null,
      product_id: typeof corps.produitId === 'string' && corps.produitId ? corps.produitId : null,
      created_by: session.uid,
      ends_at: typeof corps.finitLe === 'string' && corps.finitLe ? new Date(corps.finitLe).toISOString() : null,
      max_participants: corps.maxParticipants ? Math.max(1, Number(corps.maxParticipants)) : null,
      // Une mission naît en brouillon : elle n'apparaît aux revendeurs
      // qu'après une activation explicite, pour éviter qu'une frappe malheureuse
      // ne promette une récompense à tout le réseau.
      status: 'draft',
    })
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ missionId: data?.id });
}
