import { NextRequest, NextResponse } from 'next/server';
import { verifyOtpChallenge } from '@/lib/otp-store';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SugubaSession, ProfileStatus } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function formatPhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00223')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('223')) return '+' + cleaned;
  return '+223' + cleaned;
}

// Un compte ne peut JAMAIS s'auto-attribuer le rôle admin à la création —
// corrige BUG-003. Les comptes admin se créent uniquement en base par un
// opérateur de confiance (service_role), jamais via cette route publique.
const SELF_SERVE_ROLES: SugubaSession['role'][] = ['reseller', 'supplier', 'driver', 'diaspora', 'customer'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = String(body.phone || '');
    const code = String(body.code || '').trim();
    const requestedRole = SELF_SERVE_ROLES.includes(body.intendedRole) ? body.intendedRole : 'reseller';

    if (!rawPhone || !code) {
      return NextResponse.json({ success: false, error: 'Numéro et code requis.' }, { status: 400 });
    }
    const phone = formatPhone(rawPhone);

    const verification = await verifyOtpChallenge(phone, code);
    if (!verification.ok) {
      return NextResponse.json({ success: false, error: verification.reason || 'Code invalide.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    let uid: string;
    let role: SugubaSession['role'] = requestedRole;
    let fullName = 'Utilisateur Suguba';
    // Le numéro est désormais prouvé (OTP vérifié), mais le dossier n'a pas
    // encore été examiné par Suguba : un revendeur/fournisseur/livreur/
    // diaspora naît "pending_approval", pas "active". Seul un rôle client
    // (achat sans compte) n'a pas besoin de validation — voir
    // /api/admin/review-profile pour la validation par un admin.
    let status: ProfileStatus = requestedRole === 'customer' ? 'active' : 'pending_approval';

    if (admin) {
      const { data: existing } = await admin.from('profiles').select('*').eq('phone', phone).maybeSingle();

      if (existing) {
        uid = existing.id;
        role = existing.role as SugubaSession['role'];
        status = (existing.status as ProfileStatus) || status;
        fullName = existing.full_name;
      } else {
        uid = crypto.randomUUID();
        // Un revendeur a besoin d'un code de parrainage dès la création :
        // c'est ce code qui relie une commande publique (checkout sans
        // compte, via /p/[slug]?ref=CODE) à ce profil — voir la résolution
        // dans /api/orders/sync et le grand-livre de commissions.
        const resellerCode = requestedRole === 'reseller' ? `SG-${phone.replace(/\D/g, '').slice(-6)}` : null;
        const { error: insertErr } = await admin.from('profiles').insert({
          id: uid,
          phone,
          full_name: fullName,
          role: requestedRole,
          status,
          city: 'Bamako',
          balance: 0,
          reseller_code: resellerCode,
        });
        if (insertErr) {
          console.error('[AUTH] Échec création profil:', insertErr);
          return NextResponse.json({ success: false, error: 'Erreur lors de la création du compte.' }, { status: 500 });
        }
        role = requestedRole;
      }
    } else {
      // Aucun Supabase configuré : session fonctionnelle mais non persistée
      // entre redémarrages du serveur — acceptable en développement local
      // uniquement. Voir docs/security pour le prérequis de mise en prod.
      uid = `local-${phone}`;
    }

    const token = await createSessionToken({ uid, phone, role, status });

    const res = NextResponse.json({ success: true, uid, role, status, fullName });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error: any) {
    console.error('[API AUTH verify-otp ERROR]', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
