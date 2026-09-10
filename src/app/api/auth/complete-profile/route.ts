import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SugubaRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles, choisirRoleActif } from '@/lib/profile-roles';
import { attribuerSlugFournisseur } from '@/lib/shop';

// Rôles qu'une personne peut choisir elle-même en finalisant son inscription.
const ROLES_INSCRIPTION: SugubaRole[] = ['reseller', 'supplier', 'driver', 'diaspora'];

/**
 * Deuxième étape de l'inscription — nom, numéro WhatsApp et champs propres au
 * rôle (entreprise, véhicule, bénéficiaire diaspora...) sur un profil déjà
 * authentifié via Google ou email (voir /api/auth/supabase-exchange).
 *
 * Le rôle peut être CHOISI ici, mais uniquement tant que le profil n'a jamais
 * été complété (aucun numéro enregistré). Raison : jusqu'au 2026-09-10, une
 * connexion depuis /login créait un compte « revendeur » par défaut, sans que
 * la personne ait choisi — un futur fournisseur doit pouvoir corriger ça. Une
 * fois le profil complété, le rôle ne se change plus ici : un rôle
 * supplémentaire se demande depuis l'espace (/api/auth/request-role).
 *
 * Le numéro est désormais OBLIGATOIRE : c'est lui qui marque un profil comme
 * complet, et le middleware renvoie ici tout profil qui ne l'a pas.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Session invalide ou expirée. Reconnectez-vous.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fullName, city, phone, metadata, role: roleDemande } = body as {
      fullName?: string;
      city?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
      role?: SugubaRole;
    };

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Votre nom est obligatoire.' }, { status: 400 });
    }
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ error: 'Un numéro WhatsApp valide est obligatoire.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ success: true, cloud: false, role: session.role });
    }

    const { data: profil, error: lectureErr } = await admin
      .from('profiles')
      .select('phone, role, reseller_code')
      .eq('id', session.uid)
      .single();
    if (lectureErr || !profil) {
      return NextResponse.json({ error: 'Profil introuvable. Reconnectez-vous.' }, { status: 404 });
    }

    // ── Choix (ou correction) du rôle ──────────────────────────────────────
    let roleEffectif: SugubaRole = session.role;
    if (roleDemande && roleDemande !== session.role) {
      if (profil.phone) {
        return NextResponse.json(
          { error: 'Votre profil est déjà complété. Pour un autre rôle, faites la demande depuis votre espace.' },
          { status: 409 },
        );
      }
      if (session.role === 'admin' || !ROLES_INSCRIPTION.includes(roleDemande)) {
        return NextResponse.json({ error: 'Rôle non disponible à l\'inscription.' }, { status: 400 });
      }

      const majProfil: Record<string, unknown> = { role: roleDemande };
      if (roleDemande === 'reseller' && !profil.reseller_code) {
        majProfil.reseller_code = `SG-${session.uid.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      }
      const { error: roleProfilErr } = await admin.from('profiles').update(majProfil).eq('id', session.uid);
      if (roleProfilErr) {
        return NextResponse.json({ error: roleProfilErr.message }, { status: 500 });
      }

      // Le rôle attribué par défaut n'a jamais été choisi : on le retire
      // plutôt que de laisser un rôle fantôme dans le sélecteur d'espace.
      await admin.from('profile_roles').delete().eq('profile_id', session.uid).eq('role', session.role);
      const { error: ligneErr } = await admin.from('profile_roles').upsert(
        { profile_id: session.uid, role: roleDemande, status: 'active', approved_at: new Date().toISOString() },
        { onConflict: 'profile_id,role' },
      );
      if (ligneErr) {
        return NextResponse.json({ error: ligneErr.message }, { status: 500 });
      }
      roleEffectif = roleDemande;
    }

    // ── Profil commun ──────────────────────────────────────────────────────
    const update: Record<string, unknown> = { full_name: fullName.trim(), phone };
    if (city) update.city = city;
    if (metadata && typeof metadata === 'object') update.metadata = metadata;

    const { error } = await admin.from('profiles').update(update).eq('id', session.uid);
    if (error) {
      // Colonne phone UNIQUE : un numéro déjà pris ne doit pas finir en 500 muet.
      const dejaPris = /duplicate|unique/i.test(error.message);
      return NextResponse.json(
        { error: dejaPris ? 'Ce numéro est déjà utilisé par un autre compte.' : error.message },
        { status: dejaPris ? 409 : 500 },
      );
    }

    // Rôle Fournisseur : les champs métier vont dans `suppliers`, pas dans
    // profiles.metadata (voir supabase/migration-suppliers.sql).
    if (roleEffectif === 'supplier' && metadata) {
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
      } else {
        // Adresse publique de sa boutique (/s/<adresse>), attribuée une fois
        // pour toutes : la modifier casserait les liens déjà partagés.
        await attribuerSlugFournisseur(admin, session.uid, String(m.companyName || fullName || 'Fournisseur'));
      }
    }

    // Rôle Livreur : même principe, voir supabase/migration-drivers.sql.
    if (roleEffectif === 'driver' && metadata) {
      const m = metadata as Record<string, unknown>;
      const { error: driverErr } = await admin.from('drivers').upsert({
        profile_id: session.uid,
        vehicle_type: m.vehicleType ? String(m.vehicleType) : null,
        license_plate: m.licensePlate ? String(m.licensePlate) : null,
        zone: m.zone ? String(m.zone) : null,
        id_document_number: m.idDocumentNumber ? String(m.idDocumentNumber) : null,
      });
      if (driverErr) {
        console.error('[AUTH complete-profile] Échec écriture drivers:', driverErr.message);
      }
    }

    // Réémet toujours la session : avec le vrai numéro (jusqu'ici l'email en
    // tenait lieu, et c'est ce qui signale au middleware un profil incomplet)
    // et avec le rôle éventuellement choisi.
    const carteRoles = await chargerRoles(session.uid, roleEffectif, 'active');
    const actif = choisirRoleActif(carteRoles, roleEffectif);
    const token = await createSessionToken({
      uid: session.uid, phone, role: actif.role, status: actif.status, roles: carteRoles,
    });
    const res = NextResponse.json({ success: true, cloud: true, role: actif.role });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error: any) {
    console.error('[API complete-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
