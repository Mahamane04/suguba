import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireSecurite } from '@/lib/admin/securite';
import {
  TYPES_DIAGNOSTIC, diagnostiquerCommande, diagnostiquerCommission, diagnostiquerRetrait, diagnostiquerSponsorisation,
} from '@/lib/admin/pilotage';

/**
 * « Pourquoi c'est bloqué ? » (A5, 2026-09-27) : explique en français simple
 * ce qui retient une commande, un retrait, une commission ou une
 * sponsorisation, et renvoie vers le bon écran. Lecture seule : aucun
 * bouton pour ignorer un contrôle.
 */
const MOBILE = ['orange_money', 'moov'];

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions } = await permissionsDuMembre(session.uid);
  const type = req.nextUrl.searchParams.get('type') || '';
  const ref = (req.nextUrl.searchParams.get('ref') || '').trim().slice(0, 80);
  const def = TYPES_DIAGNOSTIC.find((t) => t.cle === type);
  if (!def || !ref) return NextResponse.json({ error: 'Choisissez un type et indiquez la référence.' }, { status: 400 });
  if (!permissions.includes(def.permission)) return NextResponse.json({ error: 'Votre rôle ne donne pas accès à ce type de dossier.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const introuvable = () => NextResponse.json({ error: `${def.titre} introuvable : vérifiez la référence.` }, { status: 404 });

  try {
    if (type === 'commande') {
      const { data } = await admin.from('orders').select('*').eq('order_number', ref.toUpperCase()).maybeSingle();
      if (!data) return introuvable();
      return NextResponse.json({ diagnostic: diagnostiquerCommande(data) });
    }
    if (type === 'retrait') {
      const { data } = await admin.from('payouts').select('id, status, payment_method, amount').eq('id', ref.toUpperCase()).maybeSingle();
      if (!data) return introuvable();
      const { seuilValidation } = await lireSecurite(admin);
      const { data: v } = await admin.from('validations_admin').select('statut').eq('type', 'retrait').eq('dossier', `retrait:${data.id}`)
        .in('statut', ['en_attente', 'approuvee']).maybeSingle();
      return NextResponse.json({ diagnostic: diagnostiquerRetrait({ ...data, amount: Number(data.amount) || 0 }, { seuil: seuilValidation, validation: v?.statut || null, reseauxMobile: MOBILE }) });
    }
    if (type === 'commission') {
      const { data } = await admin.from('commissions').select('*').eq('id', ref).maybeSingle();
      if (!data) return introuvable();
      let fondsRecus: boolean | null = null;
      if (data.order_id) {
        const { data: f, error } = await admin.rpc('fonds_recus', { p_order_id: data.order_id });
        if (!error) fondsRecus = f === true;
      }
      return NextResponse.json({ diagnostic: diagnostiquerCommission({ id: data.id, status: data.status, amount: Number(data.amount) || 0, unlock_at: data.unlock_at || null }, { fondsRecus }) });
    }
    const { data } = await admin.from('sponsorships').select('*').eq('id', ref).maybeSingle();
    if (!data) return introuvable();
    return NextResponse.json({ diagnostic: diagnostiquerSponsorisation({ id: data.id, label: data.label, status: data.status, budget: Number(data.budget) || 0, paid_amount: Number(data.paid_amount) || 0 }) });
  } catch {
    return NextResponse.json({ error: 'Diagnostic impossible pour le moment.' }, { status: 503 });
  }
}
