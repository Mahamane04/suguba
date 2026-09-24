import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { attribuerSlugFournisseur } from '@/lib/shop';
import { creerBoutiqueSupplementaire, deciderFormule, plansPourAdmin, type TypeCompteBoutique } from '@/lib/reseau/boutiques-multiples';

/**
 * Toutes les boutiques (§ page 44) : lecture et modération (masquer, suspendre).
 *
 * Ajouts du 2026-09-24 :
 * - formules Pro : demandes en attente et formules actives, activation après
 *   paiement Mobile Money (30 jours) ou refus ;
 * - créer une boutique pour un revendeur ou un fournisseur existant (l'admin
 *   peut dépasser la limite de sa formule) ;
 * - créer le compte ET la boutique d'une personne qui n'en a pas : elle se
 *   connecte ensuite avec l'e-mail saisi (la connexion relie un compte
 *   existant par son e-mail, voir /api/auth/supabase-exchange).
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.lire'))) return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux boutiques.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ boutiques: [] });

  // Recherche d'un compte pour « Créer une boutique pour… » : nom, e-mail ou téléphone.
  const recherche = (req.nextUrl.searchParams.get('compte') || '').trim();
  if (recherche.length >= 2) {
    const motif = `%${recherche.replace(/[%_,()]/g, '')}%`;
    const { data: profils } = await admin.from('profiles').select('id, full_name, email, phone, role')
      .or(`full_name.ilike.${motif},email.ilike.${motif},phone.ilike.${motif}`).limit(10);
    const ids = (profils || []).map((p: any) => p.id);
    const { data: roles } = ids.length ? await admin.from('profile_roles').select('profile_id, role, status').in('profile_id', ids) : { data: [] as any[] };
    return NextResponse.json({
      comptes: (profils || []).map((p: any) => ({
        id: p.id, nom: p.full_name, email: p.email || null, telephone: p.phone || null,
        roles: (roles || []).filter((r: any) => r.profile_id === p.id && r.status === 'active').map((r: any) => r.role),
      })),
    });
  }

  const { data, error } = await admin.from('stores')
    .select('*')
    .order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ boutiques: [], disponible: false });
  return NextResponse.json({
    disponible: true,
    boutiques: (data || []).map((b: any) => ({
      id: b.id, slug: b.slug, nom: b.name, type: b.owner_type, statut: b.status,
      abonnes: Number(b.followers_count) || 0, recrute: Boolean(b.is_recruiting), logo: b.logo_url, creeLe: b.created_at,
      principale: b.principale !== false,
    })),
    plans: await plansPourAdmin(),
  });
}

async function creerCompteEtBoutique(corps: Record<string, any>): Promise<NextResponse> {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const type: TypeCompteBoutique | null = corps.type === 'supplier' ? 'supplier' : corps.type === 'reseller' ? 'reseller' : null;
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  const email = typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
  const telephone = typeof corps.telephone === 'string' ? corps.telephone.replace(/[\s().-]/g, '') : '';
  const nomBoutique = typeof corps.nomBoutique === 'string' && corps.nomBoutique.trim() ? corps.nomBoutique.trim() : nom;
  if (!type) return NextResponse.json({ error: 'Choisissez revendeur ou fournisseur.' }, { status: 400 });
  if (nom.length < 2) return NextResponse.json({ error: 'Indiquez le nom de la personne.' }, { status: 400 });
  // Sans e-mail, la personne ne pourrait jamais se connecter (pas de SMS).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Un e-mail valide est obligatoire : c’est avec lui que la personne se connectera.' }, { status: 400 });
  if (!/^\+?\d{8,15}$/.test(telephone)) return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });

  const uid = randomUUID();
  const { error: profilErr } = await admin.from('profiles').insert({
    id: uid, full_name: nom, email, phone: telephone, role: type, status: 'active', city: 'Bamako', balance: 0, metadata: {},
    reseller_code: type === 'reseller' ? `SG-${uid.replace(/-/g, '').slice(0, 6).toUpperCase()}` : null,
  });
  if (profilErr) {
    return NextResponse.json({
      error: profilErr.code === '23505' ? 'Cet e-mail ou ce numéro a déjà un compte : cherchez-le plutôt dans « Compte existant ».' : 'Création du compte impossible.',
    }, { status: profilErr.code === '23505' ? 409 : 500 });
  }
  await admin.from('profile_roles').insert({ profile_id: uid, role: type, status: 'active', approved_at: new Date().toISOString() });
  if (type === 'supplier') {
    await admin.from('suppliers').upsert({
      profile_id: uid, company_name: nomBoutique, manager_name: nom, contact_phone: telephone,
      warehouse_neighborhood: typeof corps.quartier === 'string' && corps.quartier ? corps.quartier : null,
    });
    await attribuerSlugFournisseur(admin, uid, nomBoutique);
  }
  const r = await creerBoutiqueSupplementaire({ type, proprietaireId: uid, nom: nomBoutique, quartier: corps.quartier || null, forcer: true });
  if (!r.ok) return NextResponse.json({ error: `Compte créé, mais boutique non créée : ${r.erreur}` }, { status: r.statut });
  return NextResponse.json({ success: true, boutique: r.boutique, compte: { id: uid, email } });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de modérer une boutique.' }, { status: 403 });
  const corps = await req.json().catch(() => ({}));

  if (corps.action === 'formule') {
    if (typeof corps.planId !== 'string' || !['activer', 'refuser'].includes(corps.decision)) {
      return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    }
    const r = await deciderFormule(corps.planId, corps.decision, session.uid);
    return r.ok ? NextResponse.json({ success: true, plan: r.plan }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  if (corps.action === 'creer') {
    const type: TypeCompteBoutique | null = corps.type === 'supplier' ? 'supplier' : corps.type === 'reseller' ? 'reseller' : null;
    if (!type || typeof corps.proprietaireId !== 'string') return NextResponse.json({ error: 'Choisissez le compte et le type de boutique.' }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: role } = (await admin?.from('profile_roles').select('status').eq('profile_id', corps.proprietaireId).eq('role', type).maybeSingle()) || { data: null };
    if (!role || role.status !== 'active') {
      return NextResponse.json({ error: `Ce compte n’a pas le profil ${type === 'supplier' ? 'fournisseur' : 'revendeur'}.` }, { status: 400 });
    }
    const r = await creerBoutiqueSupplementaire({
      type, proprietaireId: corps.proprietaireId, nom: String(corps.nom || ''), quartier: corps.quartier || null, forcer: true,
    });
    return r.ok ? NextResponse.json({ success: true, boutique: r.boutique }) : NextResponse.json({ error: r.erreur }, { status: r.statut });
  }

  if (corps.action === 'creer_compte') return creerCompteEtBoutique(corps);

  const { id, statut } = corps;
  if (typeof id !== 'string' || !['active', 'hidden', 'suspended'].includes(statut)) return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = (await admin?.from('stores').update({ status: statut, updated_at: new Date().toISOString() }).eq('id', id)) || { error: { message: 'Base indisponible.' } };
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
