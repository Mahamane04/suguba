import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  rolesDeLaSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  type SugubaRole,
} from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles } from '@/lib/profile-roles';
import { attribuerSlugFournisseur } from '@/lib/shop';

/**
 * Demande d'un rôle supplémentaire sur un compte existant.
 *
 * C'est ce qui rend le multi-rôle utilisable : un revendeur qui possède une
 * moto demande le rôle livreur sans créer de second compte, un fournisseur
 * achète pour lui-même, etc. Le rôle naît ACTIF — pour un livreur, c'est
 * `drivers.active_status` qui commande le dispatch, pas ce statut. Ancien texte :
 * le rôle naissait en `pending_approval` et attendait la
 * validation d'un admin, exactement comme une inscription.
 *
 * `admin` est volontairement absent des rôles demandables : il ne s'attribue
 * qu'en base par un opérateur de confiance (voir scripts/create-admin.js).
 */
const ROLES_DEMANDABLES: SugubaRole[] = ['reseller', 'supplier', 'driver', 'diaspora'];

export async function POST(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value, true);
  if (!session) {
    return NextResponse.json({ error: 'Connectez-vous pour ajouter un rôle.' }, { status: 401 });
  }

  try {
    const { role, fiche, phone: phoneFourni } = await req.json().catch(() => ({}));
    if (!ROLES_DEMANDABLES.includes(role)) {
      return NextResponse.json({ error: 'Rôle non disponible à la demande.' }, { status: 400 });
    }

    const dejaDetenus = rolesDeLaSession(session);
    if (dejaDetenus[role as SugubaRole]) {
      return NextResponse.json(
        { error: 'Vous avez déjà ce rôle.', statut: dejaDetenus[role as SugubaRole] },
        { status: 409 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    // Compte sans numéro réel (créé par script, ou jamais complété) : le
    // nouveau rôle ne serait pas admin, et le middleware renverrait aussitôt
    // vers /register/complete (numéro requis pour tout rôle non-admin) — une
    // seconde saisie de tout le formulaire, en double de celle faite ici.
    // On l'exige donc MAINTENANT, avant de créer quoi que ce soit.
    const { data: profilAvant, error: lectureAvantErr } = await admin
      .from('profiles').select('phone').eq('id', session.uid).maybeSingle();
    if (lectureAvantErr || !profilAvant) {
      return NextResponse.json({ error: 'Profil introuvable. Reconnectez-vous.' }, { status: 404 });
    }
    let numeroReel = profilAvant.phone as string | null;
    if (!numeroReel) {
      const chiffres = typeof phoneFourni === 'string' ? phoneFourni.replace(/\D/g, '') : '';
      if (chiffres.length < 8) {
        return NextResponse.json({ error: 'Indiquez votre numéro WhatsApp pour continuer.', numeroRequis: true }, { status: 400 });
      }
      numeroReel = typeof phoneFourni === 'string' && phoneFourni.trim().startsWith('+')
        ? phoneFourni.trim() : `+223${chiffres}`;
      const { error: dejaPrisErr } = await admin.from('profiles').update({ phone: numeroReel }).eq('id', session.uid);
      if (dejaPrisErr) {
        const dejaPris = /duplicate|unique/i.test(dejaPrisErr.message);
        return NextResponse.json(
          { error: dejaPris ? 'Ce numéro est déjà utilisé par un compte existant. Connectez-vous plutôt avec ce compte.' : dejaPrisErr.message, dejaCompte: dejaPris },
          { status: dejaPris ? 409 : 500 },
        );
      }
    }

    // Fiche métier du nouveau profil (2026-09-24, page « Mes profils ») :
    // sans elle, un revendeur devenu fournisseur arrivait dans un espace
    // fournisseur vide, sans nom de boutique ni quartier de dépôt.
    const f = (fiche && typeof fiche === 'object' ? fiche : {}) as Record<string, unknown>;
    const texte = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    if (role === 'supplier' && !texte(f.companyName)) {
      return NextResponse.json({ error: 'Indiquez le nom de votre entreprise ou boutique.' }, { status: 400 });
    }

    const { error } = await admin.from('profile_roles').insert({
      profile_id: session.uid,
      role,
      status: 'active',
      approved_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[ROLES] Ajout impossible:', error);
      return NextResponse.json({ error: 'Impossible d\'ajouter ce rôle.' }, { status: 500 });
    }

    const { data: profil } = await admin.from('profiles')
      .select('full_name, phone, reseller_code').eq('id', session.uid).maybeSingle();
    if (role === 'reseller' && profil && !profil.reseller_code) {
      await admin.from('profiles')
        .update({ reseller_code: `SG-${session.uid.replace(/-/g, '').slice(0, 6).toUpperCase()}` })
        .eq('id', session.uid);
    }
    if (role === 'supplier') {
      const nom = texte(f.companyName) as string;
      const { error: ficheErr } = await admin.from('suppliers').upsert({
        profile_id: session.uid,
        company_name: nom,
        manager_name: profil?.full_name || null,
        contact_phone: profil?.phone || null,
        warehouse_address: texte(f.warehouseAddress, 200),
        warehouse_neighborhood: texte(f.warehouseNeighborhood, 80),
        category: texte(f.category, 80),
      });
      if (ficheErr) console.error('[ROLES] Fiche fournisseur non écrite:', ficheErr.message);
      else await attribuerSlugFournisseur(admin, session.uid, nom);
    }
    if (role === 'driver') {
      const { error: ficheErr } = await admin.from('drivers').upsert({
        profile_id: session.uid,
        vehicle_type: texte(f.vehicleType, 40),
        license_plate: texte(f.licensePlate, 20),
        zone: texte(f.zone, 80),
      });
      if (ficheErr) console.error('[ROLES] Fiche livreur non écrite:', ficheErr.message);
    }

    // La session doit refléter le nouveau rôle immédiatement, sinon
    // l'utilisateur devrait se déconnecter pour le voir apparaître. Le rôle
    // naît actif : on bascule directement dessus, pour que la
    // personne arrive dans son nouvel espace sans se reconnecter.
    const carte = await chargerRoles(session.uid, role, 'active');
    const token = await createSessionToken({
      uid: session.uid,
      phone: numeroReel || session.phone,
      role,
      status: 'active',
      roles: carte,
    });

    const res = NextResponse.json({ success: true, role, statut: 'active', roles: carte });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error: any) {
    console.error('[API request-role ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
