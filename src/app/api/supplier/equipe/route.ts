import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { estRoleCollaborateur, ROLES_COLLABORATEUR, MAX_COLLABORATEURS } from '@/lib/reseau/equipe-fournisseur';
import { confirmerCollaborateur, inviter, listerEquipe, quitterEquipe, retirer } from '@/lib/reseau/equipe-fournisseur-db';

/**
 * Équipe du fournisseur. Lecture : le propriétaire voit tout, un
 * collaborateur voit seulement son propre rôle (et peut quitter l'équipe).
 * Invitation et retrait : propriétaire seul (droit « equipe »).
 */

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, null);
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const { contexte } = acces;

  if (!contexte.droits.includes('equipe')) {
    return NextResponse.json({ monRole: contexte.role, membres: [], roles: ROLES_COLLABORATEUR, gestion: false });
  }
  const membres = await listerEquipe(contexte.fournisseurId);
  return NextResponse.json({
    monRole: contexte.role,
    disponible: membres !== null,
    membres: membres || [],
    roles: ROLES_COLLABORATEUR,
    max: MAX_COLLABORATEURS,
    gestion: true,
  });
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, null);
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const { contexte } = acces;
  const corps = await req.json().catch(() => ({}));

  if (corps.action === 'quitter') {
    if (contexte.role === 'proprietaire') return NextResponse.json({ error: 'Le propriétaire ne peut pas quitter sa propre équipe.' }, { status: 400 });
    const r = await quitterEquipe(contexte.personneId);
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  if (!contexte.droits.includes('equipe')) {
    return NextResponse.json({ error: 'Seul le propriétaire gère l’équipe.' }, { status: 403 });
  }

  if (corps.action === 'confirmer') {
    if (typeof corps.id !== 'string') return NextResponse.json({ error: 'Collaborateur requis.' }, { status: 400 });
    const r = await confirmerCollaborateur(contexte.fournisseurId, corps.id);
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  if (corps.action === 'retirer') {
    if (typeof corps.id !== 'string') return NextResponse.json({ error: 'Collaborateur requis.' }, { status: 400 });
    const r = await retirer(contexte.fournisseurId, corps.id);
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  if (typeof corps.telephone !== 'string' || !estRoleCollaborateur(corps.role)) {
    return NextResponse.json({ error: 'Numéro et rôle requis.' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: fiche } = (await admin?.from('suppliers').select('company_name, shop_display_name').eq('profile_id', contexte.fournisseurId).maybeSingle()) || { data: null };
  const r = await inviter({
    fournisseurId: contexte.fournisseurId,
    telephone: corps.telephone,
    role: corps.role,
    invitePar: contexte.personneId,
    nomFournisseur: fiche?.shop_display_name || fiche?.company_name || 'Un fournisseur',
  });
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
}
