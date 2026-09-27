import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { MAX_GROUPE, apercuAction, lireFiltres, type ActionGroupee } from '@/lib/admin/tableau';
import { idsDuFiltre } from '@/lib/admin/catalogue-admin';
import { normaliserUniteVente } from '@/lib/unite-vente';

/**
 * Actions groupées sur le catalogue (A4, 2026-09-27) : changer la catégorie
 * ou l'unité de vente de plusieurs produits. D'abord un APERÇU (combien,
 * quoi, lesquels sont exclus et pourquoi), puis la confirmation. Sélection :
 * des identifiants (cette page) ou le filtre (tous les résultats, 500 au plus).
 * Aucune action groupée sur les prix, les paiements ou les suppressions.
 */
export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/produits-groupes', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/produits-groupes');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const action = corps.action as ActionGroupee;
  if (action !== 'categorie' && action !== 'unite') return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });

  let ids: string[] = Array.isArray(corps.ids) ? corps.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length <= 80) : [];
  if (corps.filtre && typeof corps.filtre === 'object') {
    ids = await idsDuFiltre(admin, lireFiltres(corps.filtre), MAX_GROUPE).catch(() => []);
  }
  ids = [...new Set(ids)];
  if (!ids.length) return NextResponse.json({ error: 'Aucun produit sélectionné.' }, { status: 400 });
  if (ids.length > MAX_GROUPE) return NextResponse.json({ error: `${MAX_GROUPE} produits au plus par action : affinez le filtre.` }, { status: 400 });

  const colonnes = action === 'unite' ? 'id, name, status, type_offre, category, unite_vente' : 'id, name, status, type_offre, category';
  const { data, error } = await admin.from('products').select(colonnes).in('id', ids);
  if (error) {
    if (String(error.code) === '42703') return NextResponse.json({ error: 'Exécutez d’abord le SQL de l’unité de vente.' }, { status: 409 });
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  }
  const produits = (data || []).map((p: any) => ({ id: p.id, nom: p.name, statut: p.status, typeOffre: p.type_offre, categorie: p.category, uniteVente: p.unite_vente ?? null }));
  const apercu = apercuAction(produits, action, corps.valeur);
  const introuvables = ids.filter((id) => !produits.some((p) => p.id === id)).map((id) => ({ id, nom: id, raison: 'Produit introuvable' }));
  apercu.exclus.push(...introuvables);
  if (apercu.erreur) return NextResponse.json({ error: apercu.erreur }, { status: 400 });
  if (corps.confirmer !== true) return NextResponse.json({ apercu });

  const cibles = apercu.concernes.map((c) => c.id);
  if (!cibles.length) return NextResponse.json({ error: 'Rien à modifier : tous les produits sont exclus.' }, { status: 400 });
  let maj: Record<string, unknown>;
  if (action === 'categorie') maj = { category: String(corps.valeur).trim().replace(/\s+/g, ' ').slice(0, 60) };
  else {
    const v = corps.valeur || {};
    const u = normaliserUniteVente(v.unite, v.contenu, v.mesure, v.quantiteMin);
    if (!u.ok) return NextResponse.json({ error: u.erreur }, { status: 400 });
    maj = { unite_vente: u.unite, contenu_valeur: u.contenu, contenu_mesure: u.mesure, quantite_min: u.quantiteMin };
  }
  const { error: e2 } = await admin.from('products').update(maj).in('id', cibles);
  if (e2) return NextResponse.json({ error: 'Modification impossible. Rien n’a été changé.' }, { status: 503 });
  return NextResponse.json({ ok: true, modifies: cibles.length, exclus: apercu.exclus.length });
}
