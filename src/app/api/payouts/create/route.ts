import { createHash, randomUUID } from 'node:crypto';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { libererCommissionsEchues } from '@/lib/commissions';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerFraisRetrait } from '@/lib/pricing';

// Le retrait minimum vit dans les réglages de la plateforme (écran admin),
// plus en dur ici : voir src/lib/pricing.ts, `retraitMinimum`.
// Wave a disparu de cette table : SasPay ne le couvre pas au Mali, un
// retrait Wave ne pourrait donc jamais être viré (voir migration-saspay.sql).
const PROVIDER_MAP: Record<string, string> = {
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
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller' || session.status !== 'active') {
    return NextResponse.json({ error: 'Session revendeur active requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Enregistrement indisponible.' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { withdrawalCode, amount, payoutProvider, payoutPhone } = body;

    const parsedAmount = Number(amount);
    const moyen = PROVIDER_MAP[payoutProvider];
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0 || !moyen || typeof withdrawalCode !== 'string' || !/^[A-Za-z0-9-]{8,100}$/.test(withdrawalCode) || typeof payoutPhone !== 'string' || !/^\+?[0-9 ()-]{8,30}$/.test(payoutPhone)) return NextResponse.json({ definitive: true, error: 'Montant, référence, moyen ou téléphone invalide.' }, { status: 400 });
    const hash = (v: string) => createHash('sha256').update(v).digest('hex');
    const key = hash(withdrawalCode), fingerprint = hash(JSON.stringify([parsedAmount, moyen, payoutPhone]));
    const { data: previous, error: readError } = await admin.from('payouts').select('*').eq('reseller_id', session.uid).eq('request_key', key).maybeSingle();
    if (readError) return NextResponse.json({ error: 'Vérification de la demande indisponible.' }, { status: 503 });
    if (previous) {
      if (previous.request_fingerprint !== fingerprint) return NextResponse.json({ error: 'Reprenez la demande avec ses informations initiales.' }, { status: 409 });
      return NextResponse.json(payoutReceipt(previous));
    }
    const { reglages } = await chargerReglages(true);
    const minimum = reglages.retraitMinimum;
    if (parsedAmount < minimum) return NextResponse.json({ definitive: true, error: `Le montant minimum de retrait est de ${minimum} FCFA.` }, { status: 400 });
    const frais = calculerFraisRetrait(parsedAmount, moyen, reglages);
    if (frais.montantNet <= 0) {
      return NextResponse.json({ definitive: true, error: 'Montant trop faible une fois les frais déduits.' }, { status: 400 });
    }
    if (!payoutPhone || !withdrawalCode) {
      return NextResponse.json({ definitive: true, error: 'Champs requis manquants.' }, { status: 400 });
    }

    // Libère d'abord les commissions dont le délai de sécurité vient
    // d'expirer : sans cela, un revendeur dont le délai est écoulé depuis
    // quelques heures se verrait refuser un retrait pourtant légitime.
    // Inversement, la réservation ne prend que du `available` — une
    // commission encore `locked` reste hors de portée.
    await libererCommissionsEchues(admin);

    const { data: profile, error: profileError } = await admin.from('profiles').select('full_name').eq('id', session.uid).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: 'Profil indisponible.' }, { status: 503 });
    const { data: retrait, error } = await admin.rpc('create_payout_atomic', {
      p_owner: session.uid, p_key: key,
      p_fingerprint: fingerprint,
      p_row: {
        id: `WTH-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, reseller_name: profile.full_name || 'Revendeur',
        amount: frais.montantNet, payment_method: moyen, phone_number: payoutPhone,
        montant_demande: frais.montantDemande, frais_retrait: frais.fraisTotal,
        detail_frais: { saspay: frais.fraisSaspay, operateur: frais.fraisOperateur, suguba: frais.fraisSuguba },
      },
    });
    if (error || !retrait) {
      const insuffisant = error?.message === 'INSUFFICIENT_BALANCE';
      const conflit = error?.message === 'IDEMPOTENCY_CONFLICT';
      return NextResponse.json({ definitive: insuffisant, error: insuffisant ? 'Solde disponible insuffisant.' : conflit ? 'Cette référence correspond à une autre demande.' : 'Retrait non enregistré. Réessayez avec la même référence.' }, { status: insuffisant || conflit ? 409 : 503 });
    }
    return NextResponse.json(payoutReceipt(retrait));
  } catch (error: any) {
    console.error('[API payouts/create ERROR]', error);
    return NextResponse.json({ error: 'Retrait non confirmé. Réessayez avec la même référence.' }, { status: 503 });
  }
}

function payoutReceipt(retrait: any) {
  return { success: true, cloud: true, withdrawalCode: retrait.id,
    frais: { fraisSaspay: Number(retrait.detail_frais?.saspay || 0), fraisOperateur: Number(retrait.detail_frais?.operateur || 0), fraisSuguba: Number(retrait.detail_frais?.suguba || 0), montantDemande: Number(retrait.montant_demande), montantNet: Number(retrait.amount), fraisTotal: Number(retrait.frais_retrait) } };
}
