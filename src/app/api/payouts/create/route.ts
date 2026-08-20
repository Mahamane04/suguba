import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MIN_WITHDRAWAL = 5000;
const PROVIDER_MAP: Record<string, string> = {
  'Wave': 'wave',
  'Orange Money': 'orange_money',
  'Moov Money': 'moov',
  'Agence Suguba': 'cash',
};

/**
 * Corrige la dernière partie de BUG-006/BUG-008 : la création de retrait
 * revendeur était désactivée côté client (cloud-sync.ts) car elle écrivait
 * directement dans `payouts` avec la clé anon — bloqué depuis que les
 * policies publiques ont été retirées (voir supabase/schema.sql). Cette
 * route la remplace : session revendeur active obligatoire, écriture via
 * service_role, `reseller_id` toujours pris de la session signée (jamais du
 * corps de la requête) pour qu'un revendeur ne puisse jamais créer un
 * retrait au nom d'un autre.
 *
 * Le montant est désormais revérifié contre le vrai solde disponible côté
 * serveur (table `commissions` + RPC `reserve_commissions_for_withdrawal`,
 * verrouillage de lignes inclus pour empêcher deux retraits simultanés de
 * consommer deux fois le même solde) — un revendeur ne peut plus demander
 * plus que ce qu'il a réellement gagné, même s'il falsifie le montant
 * affiché côté client.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller' || session.status !== 'active') {
    return NextResponse.json({ error: 'Session revendeur active requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ success: true, cloud: false });
  }

  try {
    const body = await req.json();
    const { withdrawalCode, resellerName, amount, payoutProvider, payoutPhone } = body;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_WITHDRAWAL) {
      return NextResponse.json({ error: `Le montant minimum de retrait est de ${MIN_WITHDRAWAL} FCFA.` }, { status: 400 });
    }
    if (!payoutPhone || !withdrawalCode) {
      return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    const { data: reserved, error: reserveErr } = await admin.rpc('reserve_commissions_for_withdrawal', {
      p_reseller_id: session.uid,
      p_amount: parsedAmount,
      p_withdrawal_id: withdrawalCode,
    });

    if (reserveErr) {
      return NextResponse.json({ error: reserveErr.message }, { status: 500 });
    }
    if (!reserved || Number(reserved) < parsedAmount) {
      return NextResponse.json({ error: 'Solde disponible insuffisant.' }, { status: 400 });
    }

    const { error } = await admin.from('payouts').insert({
      id: withdrawalCode, // aligné sur le format WTH-xxxx déjà utilisé côté client/webhook
      reseller_id: session.uid,
      reseller_name: resellerName || session.phone,
      amount: parsedAmount,
      payment_method: PROVIDER_MAP[payoutProvider] || 'orange_money',
      phone_number: payoutPhone,
      status: 'pending',
    });

    if (error) {
      // La réservation a réussi mais l'écriture du retrait a échoué (id déjà
      // pris, etc.) — libérer tout de suite, sinon ces commissions restent
      // bloquées en 'reserved' sans aucun retrait pour les réclamer.
      await admin.rpc('release_commissions_for_withdrawal', { p_withdrawal_id: withdrawalCode });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, cloud: true });
  } catch (error: any) {
    console.error('[API payouts/create ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
