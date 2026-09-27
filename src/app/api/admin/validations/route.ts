import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { LIBELLES_VALIDATION, PERMISSION_VALIDATION, type TypeValidation } from '@/lib/admin/securite-regles';

/**
 * Double validation (A3, 2026-09-27) : les opérations sensibles au-dessus du
 * seuil attendent ici l'approbation d'un AUTRE membre ayant le droit de les
 * exécuter. On ne peut jamais approuver sa propre demande (contrôlé ici et
 * par la base).
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions } = await permissionsDuMembre(session.uid);
  const types = (Object.keys(PERMISSION_VALIDATION) as TypeValidation[]).filter((t) => permissions.includes(PERMISSION_VALIDATION[t]));
  if (!types.length) return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux validations.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { data, error } = await admin.from('validations_admin').select('*').in('type', types).order('cree_le', { ascending: false }).limit(100);
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ validations: [], migrationRequise: true });
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  }
  const ids = [...new Set((data || []).flatMap((v: any) => [v.demandeur_id, v.decideur_id]).filter(Boolean))];
  const { data: profils } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name || 'Membre']));
  return NextResponse.json({
    moi: session.uid,
    validations: (data || []).map((v: any) => ({
      id: v.id, type: v.type, libelle: LIBELLES_VALIDATION[v.type as TypeValidation] || v.type, dossier: v.dossier,
      montant: v.montant == null ? null : Number(v.montant), resume: v.resume, statut: v.statut,
      demandeur: noms.get(v.demandeur_id) || 'Membre', demandeurId: v.demandeur_id,
      decideur: v.decideur_id ? noms.get(v.decideur_id) || 'Membre' : null, motif: v.motif_decision,
      creeLe: v.cree_le, decideLe: v.decide_le,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/validations', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  const decision = corps.decision === 'approuver' ? 'approuvee' : corps.decision === 'refuser' ? 'refusee' : null;
  if (!decision || typeof corps.id !== 'string') return NextResponse.json({ error: 'Décision invalide.' }, { status: 400 });
  const motif = typeof corps.motif === 'string' ? corps.motif.trim().slice(0, 500) : '';
  if (decision === 'refusee' && motif.length < 3) return NextResponse.json({ error: 'Indiquez le motif du refus.' }, { status: 400 });

  const { data: v } = await admin.from('validations_admin').select('id, type, statut, demandeur_id').eq('id', corps.id).maybeSingle();
  if (!v) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  if (v.statut !== 'en_attente') return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
  if (v.demandeur_id === session.uid) return NextResponse.json({ error: 'Vous ne pouvez pas approuver votre propre demande : un collègue doit le faire.' }, { status: 403 });
  const { permissions } = await permissionsDuMembre(session.uid);
  if (!permissions.includes(PERMISSION_VALIDATION[v.type as TypeValidation])) return NextResponse.json({ error: 'Votre rôle ne permet pas de décider cette demande.' }, { status: 403 });

  const { data, error } = await admin.from('validations_admin').update({
    statut: decision, decideur_id: session.uid, motif_decision: motif || null, decide_le: new Date().toISOString(),
  }).eq('id', v.id).eq('statut', 'en_attente').select('id').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Décision non enregistrée. Actualisez.' }, { status: 409 });
  return NextResponse.json({ ok: true, statut: decision });
}
