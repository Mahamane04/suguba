import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles } from '@/lib/profile-roles';

/**
 * Deuxième étape de l'inscription — remplit les champs propres au rôle
 * (entreprise, véhicule, bénéficiaire diaspora...) sur un profil déjà
 * authentifié via Google (voir /api/auth/supabase-exchange). N'accepte jamais de
 * modifier le rôle ou le statut depuis le client : l'un vient de la session
 * signée, l'autre reste piloté par /api/admin/review-profile.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Session invalide ou expirée. Reconnectez-vous.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fullName, city, phone, metadata } = body as {
      fullName?: string;
      city?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
    };

    const admin = getSupabaseAdmin();
    if (!admin) {
      // Mode local sans Supabase : rien à persister côté serveur, le
      // formulaire retombe sur sugubaStore côté client (voir register/page.tsx).
      return NextResponse.json({ success: true, cloud: false });
    }

    const update: Record<string, unknown> = {};
    if (fullName) update.full_name = fullName;
    if (city) update.city = city;
    // Un compte créé via Google n'a jamais de numéro (Google ne le
    // connaît pas) — voir /register/complete, l'étape qui le recueille
    // juste après l'inscription. Non vérifié par OTP à ce stade : c'est
    // l'examen manuel par un admin (status pending_approval) qui filtre un
    // numéro fantaisiste, pas cette route.
    if (phone) update.phone = phone;
    if (metadata && typeof metadata === 'object') update.metadata = metadata;

    const { error } = await admin.from('profiles').update(update).eq('id', session.uid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Rôle Fournisseur : les champs métier (entreprise, entrepôt, catégorie,
    // RCCM/NIF) vont dans `suppliers`, pas dans profiles.metadata — sinon
    // l'admin (voir /api/admin/suppliers/pending) et le tableau de bord
    // fournisseur n'auraient nulle part où lire une donnée structurée.
    // `suppliers` n'a pas de statut propre : celui-ci reste dans
    // profile_roles (voir supabase/migration-suppliers.sql).
    if (session.role === 'supplier' && metadata) {
      const m = metadata as Record<string, unknown>;
      const { error: supplierErr } = await admin.from('suppliers').upsert({
        profile_id: session.uid,
        company_name: String(m.companyName || fullName || 'Fournisseur'),
        manager_name: fullName || null,
        contact_phone: phone || null,
        warehouse_address: m.warehouseAddress ? String(m.warehouseAddress) : null,
        warehouse_neighborhood: m.warehouseNeighborhood ? String(m.warehouseNeighborhood) : null,
        category: m.category ? String(m.category) : null,
        rccm_or_nif: m.rccmOrNif ? String(m.rccmOrNif) : null,
      });
      if (supplierErr) {
        console.error('[AUTH complete-profile] Échec écriture suppliers:', supplierErr.message);
      }
    }

    // Réémet la session avec le vrai numéro (jusqu'ici, un profil Google
    // portait l'email en guise de "phone" dans le jeton — voir
    // supabase-exchange) : le Header et le reste de l'app doivent
    // désormais afficher/utiliser le numéro réel. La carte des rôles doit
    // être reconduite ici aussi, sinon un compte multi-rôle perdrait son
    // sélecteur de rôle dès qu'il complète son profil.
    const res = NextResponse.json({ success: true, cloud: true });
    if (phone) {
      const carteRoles = await chargerRoles(session.uid, session.role, session.status);
      const token = await createSessionToken({
        uid: session.uid, phone, role: session.role, status: session.status, roles: carteRoles,
      });
      res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    }
    return res;
  } catch (error: any) {
    console.error('[API complete-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
