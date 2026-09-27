// Lot C — solde et retraits des fournisseurs (2026-09-27) : crédit à la
// livraison, délai de sécurité, argent reçu, demande de retrait réservée,
// paiement ou refus par l'admin, retour de commande.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function base() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['migration-reseau-v2.sql', 'A-EXECUTER-2026-09-25-caisse-livreurs.sql', 'A-EXECUTER-2026-09-26-campagnes.sql',
    'A-EXECUTER-2026-09-26-sponsorisations-paiement.sql', 'A-EXECUTER-2026-09-26-devis.sql', 'A-EXECUTER-2026-09-26-campagnes-resultat.sql',
    'A-EXECUTER-2026-09-26-tresorerie.sql',
    // Deux fois : le SQL du lot C doit pouvoir être relancé sans erreur.
    'A-EXECUTER-2026-09-27-retraits-fournisseurs.sql', 'A-EXECUTER-2026-09-27-retraits-fournisseurs.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  await db.exec(`
    INSERT INTO public.profiles (id, phone, full_name, role) VALUES
      ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'),
      ('r1', '+22370000003', '[TEST] Revendeur', 'reseller'),
      ('d1', '+22370000005', '[TEST] Livreur', 'driver');
    INSERT INTO public.products (id, name, slug, category, supplier_price, public_price, status, stock, supplier_id)
      VALUES ('pf1', '[TEST] Produit', 'test-produit-f1', 'autre', 9000, 12000, 'approved', 100, 'f1');
    INSERT INTO public.platform_settings (id, valeurs) VALUES (1, '{"delaiGainFournisseurJours": 3}')
      ON CONFLICT (id) DO UPDATE SET valeurs = EXCLUDED.valeurs;`);
  return db;
}
const un = async (db, q) => (await db.query(q)).rows[0];

/** Commande en route, puis livrée : c'est le passage à « delivered » qui crédite. */
async function livrer(db, id, { snapshot = null, quantite = 1, frais = 0, especes = false } = {}) {
  const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND is_nullable = 'NO' AND column_default IS NULL`);
  const v = { id: `'${id}'`, order_number: `'CMD-${id}'`, product_id: `'pf1'`, product_name: `'[TEST]'`, customer_name: `'[TEST] Client'`,
    customer_phone: `'76000000'`, neighborhood: `'ACI'`, city: `'Bamako'`, quantity: String(quantite), total_amount: '20000',
    delivery_fee: String(frais), status: `'in_transit'`, assigned_driver_id: `'d1'`,
    payment_method: especes ? `'cash_on_delivery'` : `'mobile_money'`,
    pricing_snapshot: snapshot ? `'${JSON.stringify(snapshot)}'::jsonb` : 'NULL' };
  for (const { column_name } of cols) if (!(column_name in v)) v[column_name] = '0';
  await db.exec(`INSERT INTO public.orders (${Object.keys(v).join(', ')}) VALUES (${Object.values(v).join(', ')})`);
  await db.exec(`UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = '${id}'`);
}
const gain = (db, id) => un(db, `SELECT amount, status, unlock_at, supplier_id FROM public.gains_fournisseurs WHERE order_id = '${id}' AND split_from IS NULL`);
const echu = (db) => db.exec(`UPDATE public.gains_fournisseurs SET unlock_at = now() - interval '1 minute' WHERE status = 'locked'`);
const solde = async (db, statut) => Number((await un(db, `SELECT coalesce(sum(amount), 0) AS s FROM public.gains_fournisseurs WHERE supplier_id = 'f1' AND status = '${statut}'`)).s);

function ligne(id, montant, frais = 0, moyen = 'orange_money') {
  return JSON.stringify({ id, reseller_name: '[TEST] Fournisseur', amount: montant - frais, payment_method: moyen,
    phone_number: '+22370000002', montant_demande: montant, frais_retrait: frais, detail_frais: { suguba: frais } });
}
const demander = (db, id, montant, frais = 0, cle = id, empreinte = 'e-' + id, moyen = 'orange_money') =>
  un(db, `SELECT public.creer_retrait_fournisseur('f1', '${cle}', '${empreinte}', '${ligne(id, montant, frais, moyen)}'::jsonb) AS r`);

test('SQL : la livraison crédite le prix fournisseur figé × quantité, bloqué pendant le délai réglé', async () => {
  const db = await base();
  await livrer(db, 'o1', { snapshot: { devis: { tarif: { prixFournisseur: 8000 } } }, quantite: 2 });
  const g = await gain(db, 'o1');
  assert.equal(Number(g.amount), 16000, 'prix du devis de la commande, pas celui du catalogue');
  assert.equal(g.status, 'locked');
  assert.equal(g.supplier_id, 'f1');
  const jours = (Date.parse(g.unlock_at) - Date.now()) / 86_400_000;
  assert.ok(jours > 2.9 && jours < 3.1, `délai réglé à 3 jours (${jours})`);

  // Sans devis enregistré : prix du catalogue.
  await livrer(db, 'o2');
  assert.equal(Number((await gain(db, 'o2')).amount), 9000);

  // Remise par le fournisseur : il reverse tout à la caisse, ses frais de remise lui reviennent.
  await livrer(db, 'o3', { snapshot: { devis: { tarif: { prixFournisseur: 9000 } }, remise: { mode: 'fournisseur', frais: 1500 } }, frais: 1500 });
  assert.equal(Number((await gain(db, 'o3')).amount), 10500);
  // Livraison Suguba : les frais de livraison ne sont pas au fournisseur.
  await livrer(db, 'o4', { snapshot: { devis: { tarif: { prixFournisseur: 9000 } }, remise: { mode: 'livreur' } }, frais: 1500 });
  assert.equal(Number((await gain(db, 'o4')).amount), 9000);
});

test('SQL : retirable après le délai, et seulement une fois les espèces chez Suguba', async () => {
  const db = await base();
  await livrer(db, 'm1');
  await livrer(db, 'c1', { especes: true });
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);
  assert.equal((await gain(db, 'm1')).status, 'locked', 'délai pas encore écoulé');

  await echu(db);
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);
  assert.equal((await gain(db, 'm1')).status, 'available', 'Mobile Money : argent déjà reçu');
  assert.equal((await gain(db, 'c1')).status, 'locked', 'espèces pas encore versées à la caisse');

  const v = (await un(db, `SELECT public.record_driver_remittance('d1', ARRAY['c1'], 0, 20000, 'admin', '[TEST] Admin', NULL) AS j`)).j;
  assert.equal(v.success, true);
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);
  assert.equal((await gain(db, 'c1')).status, 'available');
});

test('SQL : demande de retrait — réserve exacte, idempotente, jamais au-delà du solde', async () => {
  const db = await base();
  await livrer(db, 'a1');
  await livrer(db, 'a2');
  await echu(db);
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);
  assert.equal(await solde(db, 'available'), 18000);

  const r = (await demander(db, 'WTH-F1', 10000, 300)).r;
  assert.equal(r.beneficiaire, 'fournisseur');
  assert.equal(Number(r.amount), 9700);
  assert.equal(await solde(db, 'reserved'), 10000);
  assert.equal(await solde(db, 'available'), 8000, 'le reste d’un gain entamé reste disponible');

  // Même clé, même demande : le même retrait, rien de réservé en plus.
  assert.equal((await demander(db, 'WTH-F1-BIS', 10000, 300, 'WTH-F1', 'e-WTH-F1')).r.id, 'WTH-F1');
  assert.equal(await solde(db, 'reserved'), 10000);
  await assert.rejects(demander(db, 'WTH-F1-TER', 5000, 0, 'WTH-F1', 'autre'), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(demander(db, 'WTH-F2', 9000), /INSUFFICIENT_BALANCE/);
  assert.equal(Number((await un(db, `SELECT count(*) AS n FROM public.payouts WHERE id = 'WTH-F2'`)).n), 0, 'demande refusée = rien d’écrit');
  await assert.rejects(demander(db, 'WTH-F3', 1000, 1000), /INVALID_AMOUNT/, 'rien à recevoir');
});

test('SQL : virement confirmé = payé ; refus ou échec = rendu au solde', async () => {
  const db = await base();
  await livrer(db, 'b1');
  await livrer(db, 'b2');
  await echu(db);
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);

  await demander(db, 'WTH-OK', 12000, 400);
  const debut = (await un(db, `SELECT public.begin_payout_transfer('WTH-OK') AS p`)).p;
  assert.equal(debut.status, 'processing');
  await un(db, `SELECT public.finalize_payout_atomic('WTH-OK', 'completed', 'SASPAY-1') AS p`);
  assert.equal(await solde(db, 'paid'), 12000);
  assert.equal(await solde(db, 'reserved'), 0);

  await demander(db, 'WTH-KO', 6000, 0, 'WTH-KO', 'e-KO', 'cash');
  await assert.rejects(db.query(`SELECT public.begin_payout_transfer('WTH-KO')`), /STATUS_CONFLICT/, 'espèces : pas de virement');
  await un(db, `SELECT public.finalize_payout_atomic('WTH-KO', 'rejected', NULL, 'pending') AS p`);
  assert.equal(await solde(db, 'available'), 6000, 'refus : le fournisseur retrouve son solde');
  assert.equal(await solde(db, 'reserved'), 0);
  assert.equal((await un(db, `SELECT status FROM public.payouts WHERE id = 'WTH-KO'`)).status, 'rejected');
});

test('SQL : commande retournée — gain annulé, sauf s’il est déjà retiré', async () => {
  const db = await base();
  await livrer(db, 'x1');
  await db.exec(`UPDATE public.orders SET status = 'returned' WHERE id = 'x1'`);
  assert.equal((await gain(db, 'x1')).status, 'reversed');

  await livrer(db, 'x2');
  await echu(db);
  await db.query(`SELECT public.liberer_gains_fournisseurs_echus()`);
  await demander(db, 'WTH-X2', 9000);
  await assert.rejects(db.exec(`UPDATE public.orders SET status = 'returned' WHERE id = 'x2'`), /LEDGER_RECONCILIATION_REQUIRED/);
});

test('SQL : les retraits des revendeurs passent toujours par leurs commissions', async () => {
  const db = await base();
  await db.exec(`INSERT INTO public.commissions (reseller_id, amount, status) VALUES ('r1', 7000, 'available')`);
  const p = (await un(db, `SELECT public.create_payout_atomic('r1', 'k-r1', 'e-r1', '${JSON.stringify({
    id: 'WTH-R1', reseller_name: '[TEST] Revendeur', amount: 6800, payment_method: 'orange_money', phone_number: '+22370000003',
    montant_demande: 7000, frais_retrait: 200, detail_frais: {} })}'::jsonb) AS p`)).p;
  assert.equal(p.beneficiaire, 'revendeur', 'valeur par défaut');
  await un(db, `SELECT public.begin_payout_transfer('WTH-R1') AS p`);
  await un(db, `SELECT public.finalize_payout_atomic('WTH-R1', 'completed', 'SASPAY-R') AS p`);
  assert.equal((await un(db, `SELECT status FROM public.commissions WHERE reseller_id = 'r1'`)).status, 'paid');

  // Refus d'un retrait revendeur : sa commission redevient disponible, comme avant le lot C.
  await db.exec(`INSERT INTO public.commissions (reseller_id, amount, status) VALUES ('r1', 5000, 'available')`);
  await un(db, `SELECT public.create_payout_atomic('r1', 'k-r2', 'e-r2', '${JSON.stringify({
    id: 'WTH-R2', reseller_name: '[TEST] Revendeur', amount: 5000, payment_method: 'cash', phone_number: '+22370000003',
    montant_demande: 5000, frais_retrait: 0, detail_frais: {} })}'::jsonb) AS p`);
  assert.equal((await un(db, `SELECT count(*) AS n FROM public.commissions WHERE reseller_id = 'r1' AND status = 'reserved'`)).n, 1);
  await un(db, `SELECT public.finalize_payout_atomic('WTH-R2', 'rejected', NULL, 'pending') AS p`);
  assert.equal(Number((await un(db, `SELECT coalesce(sum(amount), 0) AS s FROM public.commissions WHERE reseller_id = 'r1' AND status = 'available'`)).s), 5000);
});

test('SQL : fonctions et grand-livre réservés au serveur', async () => {
  const db = await base();
  for (const f of ['public.creer_retrait_fournisseur(text,text,text,jsonb)', 'public.liberer_gains_fournisseurs_echus()', 'public.finalize_payout_atomic(text,text,text,text)']) {
    assert.equal((await un(db, `SELECT has_function_privilege('anon', '${f}', 'EXECUTE') AS ok`)).ok, false, f);
    assert.equal((await un(db, `SELECT has_function_privilege('service_role', '${f}', 'EXECUTE') AS ok`)).ok, true, f);
  }
  assert.equal((await un(db, `SELECT has_table_privilege('anon', 'public.gains_fournisseurs', 'SELECT') AS ok`)).ok, false);
});

// ── Logique pure : même règle que la base, résumé du solde, réglage du délai ──
const G = require('../src/lib/gains-fournisseur.ts');
const P = require('../src/lib/pricing.ts');

test('montant dû : même règle que la base (prix figé, catalogue, remise par le fournisseur)', () => {
  assert.equal(G.montantDuFournisseur({ pricing_snapshot: { devis: { tarif: { prixFournisseur: 8000 } } }, quantity: 2 }, 9000), 16000);
  assert.equal(G.montantDuFournisseur({ pricing_snapshot: null, quantity: 1 }, 9000), 9000);
  assert.equal(G.montantDuFournisseur({ pricing_snapshot: { devis: { tarif: { prixFournisseur: 9000 } }, remise: { mode: 'fournisseur' } }, quantity: 1, delivery_fee: 1500 }, 0), 10500);
  assert.equal(G.montantDuFournisseur({ pricing_snapshot: { devis: { tarif: { prixFournisseur: 9000 } }, remise: { mode: 'livreur' } }, quantity: 1, delivery_fee: 1500 }, 0), 9000);
  assert.equal(G.montantDuFournisseur({ quantity: 0 }, 5000), 5000, 'quantité absente ou nulle = 1, comme la base');
});

test('solde : disponible, en attente, attente des espèces, en retrait, versé', () => {
  const maintenant = Date.parse('2026-10-10T12:00:00Z');
  const s = G.resumerSoldeFournisseur([
    { amount: 9000, status: 'available' },
    { amount: '4000', status: 'locked', unlock_at: '2026-10-12T12:00:00Z' },
    { amount: 2000, status: 'locked', unlock_at: '2026-10-11T08:00:00Z' },
    { amount: 3000, status: 'locked', unlock_at: '2026-10-09T12:00:00Z' },
    { amount: 5000, status: 'reserved' },
    { amount: 7000, status: 'paid' },
    { amount: 1000, status: 'reversed' },
  ], maintenant);
  assert.deepEqual(s, { disponible: 9000, enAttente: 6000, attenteFonds: 3000, enRetrait: 5000, verse: 7000, prochainDeblocage: '2026-10-11T08:00:00.000Z' });
  assert.equal(G.etatGain({ amount: 3000, status: 'locked', unlock_at: '2026-10-09T12:00:00Z' }, maintenant).code, 'attente_fonds');
  assert.match(G.etatGain({ amount: 4000, status: 'locked', unlock_at: '2026-10-12T12:00:00Z' }, maintenant).libelle, /^Disponible le/);
  assert.equal(G.etatGain({ amount: 1, status: 'reversed' }).code, 'annule');
});

test('délai des fournisseurs : 7 jours par défaut, borné à 0–60, réglable', () => {
  assert.equal(P.completerReglages({}).delaiGainFournisseurJours, 7);
  assert.equal(P.completerReglages({ delaiGainFournisseurJours: 0 }).delaiGainFournisseurJours, 0, '0 reste 0');
  assert.equal(P.completerReglages({ delaiGainFournisseurJours: 90 }).delaiGainFournisseurJours, 60);
  assert.equal(P.completerReglages({ delaiGainFournisseurJours: '' }).delaiGainFournisseurJours, 7, 'champ vidé = valeur par défaut');
  assert.equal(P.completerReglages({ delaiGainFournisseurJours: 3.4 }).delaiGainFournisseurJours, 3);
  const r = P.completerReglages({});
  assert.ok(P.validerReglages({ ...r, delaiGainFournisseurJours: 2.5 }).some((e) => /Délai avant retrait/.test(e)));
  assert.equal(P.validerReglages(r).some((e) => /Délai avant retrait/.test(e)), false);
});

test('seul le propriétaire du compte fournisseur voit et retire l’argent', () => {
  const equipe = require('../src/lib/reseau/equipe-fournisseur.ts');
  assert.ok(equipe.droitsDuRole('proprietaire').includes('retraits'));
  for (const r of equipe.ROLES_COLLABORATEUR) assert.ok(!equipe.droitsDuRole(r.valeur).includes('retraits'), r.valeur);
});

// ── Routes fournisseur, sur une fausse base et un faux contexte ──────────────
let etat = {}; let appels = []; let rpcErreur = null; let lectureErreur = null;
const faux = {
  from(table) {
    const filtres = []; let un = false;
    const q = {
      select() { return q; }, eq(k, v) { filtres.push((r) => r[k] === v); return q; }, in() { return q; },
      order() { return q; }, limit() { return q; }, maybeSingle() { un = true; return q; },
      then(ok, ko) {
        appels.push({ table });
        if (lectureErreur && lectureErreur.table === table) return Promise.resolve({ data: null, error: lectureErreur.error }).then(ok, ko);
        const lignes = (etat[table] || []).filter((r) => filtres.every((f) => f(r)));
        return Promise.resolve({ data: un ? (lignes[0] || null) : lignes, error: null }).then(ok, ko);
      },
    };
    return q;
  },
  async rpc(nom, args) {
    appels.push({ rpc: nom, args });
    if (nom === 'creer_retrait_fournisseur') {
      if (rpcErreur) return { data: null, error: rpcErreur };
      return { data: { ...args.p_ligne, beneficiaire: 'fournisseur', status: 'pending' }, error: null };
    }
    return { data: 0, error: null };
  },
};
let acces = null;
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => faux } };
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = { exports: { exigerDroitFournisseur: async (_req, droit) => {
  assert.equal(droit, 'retraits', 'les routes d’argent exigent le droit « retraits »');
  return acces;
} } };
const { NextRequest } = require('next/server');
const proprietaire = { ok: true, contexte: { fournisseurId: 'f1', personneId: 'f1', role: 'proprietaire', droits: ['retraits'] }, session: { uid: 'f1', role: 'supplier', status: 'active' } };
const demande = (corps) => new NextRequest('http://localhost/api/supplier/retraits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
const corps = { withdrawalCode: 'cle-retrait-0001', amount: 10000, payoutProvider: 'Orange Money', payoutPhone: '+22370000002', fournisseurId: 'autre-fournisseur' };

test('route : un retrait fournisseur, à SES taux, pour le fournisseur de la session', async () => {
  etat = {
    platform_settings: [{ id: 1, valeurs: { fraisRetraitSuguba: { revendeur: { caisse: 1, mobile: 1.5 }, fournisseur: { caisse: 0.5, mobile: 2 } } } }],
    suppliers: [{ profile_id: 'f1', company_name: '[TEST] Fournisseur' }],
    payouts: [],
  };
  appels = []; rpcErreur = null; lectureErreur = null; acces = proprietaire;
  const { POST } = require('../src/app/api/supplier/retraits/route.ts');
  const res = await POST(demande(corps));
  assert.equal(res.status, 200);
  const appel = appels.find((a) => a.rpc === 'creer_retrait_fournisseur');
  assert.equal(appel.args.p_fournisseur, 'f1', 'jamais le fournisseur du corps de la requête');
  assert.equal(appel.args.p_ligne.detail_frais.suguba, 200, 'taux fournisseur Mobile Money : 2 %');
  assert.equal(appel.args.p_ligne.detail_frais.saspay, 300, 'vrai tarif SasPay Orange : 2 % + 100 F');
  assert.equal(appel.args.p_ligne.amount, 9500);
  assert.equal(appel.args.p_ligne.montant_demande, 10000);
  assert.equal(appel.args.p_ligne.reseller_name, '[TEST] Fournisseur');
  assert.ok(appels.some((a) => a.rpc === 'liberer_gains_fournisseurs_echus'), 'délais échus libérés avant la réserve');
  assert.equal((await res.json()).frais.montantNet, 9500);
});

test('route : collaborateur, compte non validé, solde insuffisant, SQL absent', async () => {
  const { POST } = require('../src/app/api/supplier/retraits/route.ts');
  const { GET } = require('../src/app/api/supplier/gains/route.ts');
  etat = { platform_settings: [{ id: 1, valeurs: {} }], suppliers: [], payouts: [] };

  acces = { ok: false, statut: 403, erreur: 'Votre rôle dans l’équipe ne permet pas cette action.' };
  assert.equal((await POST(demande(corps))).status, 403);
  assert.equal((await GET(new NextRequest('http://localhost/api/supplier/gains'))).status, 403);

  acces = { ...proprietaire, session: { ...proprietaire.session, status: 'pending' } };
  assert.equal((await POST(demande(corps))).status, 403, 'compte en attente de validation');

  acces = proprietaire; rpcErreur = { message: 'INSUFFICIENT_BALANCE' };
  const insuffisant = await POST(demande(corps));
  assert.equal(insuffisant.status, 409);
  assert.equal((await insuffisant.json()).definitive, true);

  rpcErreur = null; lectureErreur = { table: 'payouts', error: { code: '42703', message: 'column payouts.beneficiaire does not exist' } };
  const absent = await POST(demande(corps));
  assert.equal(absent.status, 503);
  assert.match((await absent.json()).error, /pas encore ouverts/);

  lectureErreur = { table: 'gains_fournisseurs', error: { code: 'PGRST205', message: 'Could not find the table public.gains_fournisseurs' } };
  const solde = await GET(new NextRequest('http://localhost/api/supplier/gains'));
  assert.equal(solde.status, 200);
  assert.equal((await solde.json()).actif, false, 'avant le SQL : aucun solde, sans erreur');
  lectureErreur = null;
});

test('route : le solde affiché vient du grand-livre, avec le délai réglé', async () => {
  const { GET } = require('../src/app/api/supplier/gains/route.ts');
  const plusTard = new Date(Date.now() + 3 * 86_400_000).toISOString();
  etat = {
    platform_settings: [{ id: 1, valeurs: { delaiGainFournisseurJours: 5 } }],
    suppliers: [{ profile_id: 'f1', contact_phone: '+22370000002' }],
    gains_fournisseurs: [
      { id: 'g1', supplier_id: 'f1', order_id: 'o1', order_number: 'CMD-1', amount: 9000, status: 'available' },
      { id: 'g2', supplier_id: 'f1', order_id: 'o2', order_number: 'CMD-2', amount: 4000, status: 'locked', unlock_at: plusTard },
    ],
    orders: [{ id: 'o1', product_name: '[TEST] Produit', quantity: 1, delivered_at: '2026-10-01T10:00:00Z' }],
    payouts: [{ id: 'WTH-1', reseller_id: 'f1', beneficiaire: 'fournisseur', amount: 5000, payment_method: 'cash', status: 'completed', created_at: '2026-10-02T10:00:00Z' },
      { id: 'WTH-R', reseller_id: 'f1', beneficiaire: 'revendeur', amount: 800, payment_method: 'cash', status: 'completed', created_at: '2026-10-02T10:00:00Z' }],
  };
  acces = proprietaire;
  const json = await (await GET(new NextRequest('http://localhost/api/supplier/gains'))).json();
  assert.equal(json.actif, true);
  assert.equal(json.soldes.disponible, 9000);
  assert.equal(json.soldes.enAttente, 4000);
  assert.equal(json.delaiJours, 5);
  assert.equal(json.telephone, '+22370000002');
  assert.equal(json.gains.find((g) => g.id === 'g1').produit, '[TEST] Produit');
  assert.deepEqual(json.retraits.map((r) => r.id), ['WTH-1'], 'ses retraits de revendeur n’apparaissent pas ici');
});
