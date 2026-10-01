// TEST-FIN-INT-001..004 (audit intégral du 2026-10-01) : livraison forcée, versement
// incomplet, paiement Mobile Money tardif ou incomplet, double « Argent remis ».
// Base PostgreSQL embarquée (PGlite) avec le SQL réel de supabase/.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function base() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['migration-reseau-v2.sql', 'A-EXECUTER-2026-09-25-caisse-livreurs.sql', 'A-EXECUTER-2026-09-26-offres-remise.sql',
    'A-EXECUTER-2026-09-26-campagnes.sql', 'A-EXECUTER-2026-09-26-sponsorisations-paiement.sql', 'A-EXECUTER-2026-09-26-devis.sql',
    'A-EXECUTER-2026-09-26-campagnes-resultat.sql', 'A-EXECUTER-2026-09-26-tresorerie.sql', 'A-EXECUTER-2026-09-27-frais-paiement.sql',
    'A-EXECUTER-2026-09-27-retraits-fournisseurs.sql',
    // Deux fois : rejouable sans erreur.
    'A-EXECUTER-2026-10-01-integrite-argent.sql', 'A-EXECUTER-2026-10-01-integrite-argent.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  await db.exec(`
    INSERT INTO public.profiles (id, phone, full_name, role) VALUES
      ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'), ('r1', '+22370000003', '[TEST] Revendeur', 'reseller'),
      ('d1', '+22370000005', '[TEST] Livreur', 'driver'), ('d2', '+22370000006', '[TEST] Livreur 2', 'driver');
    INSERT INTO public.products (id, name, slug, category, supplier_price, public_price, status, stock, supplier_id)
      VALUES ('pf1', '[TEST] Produit', 'test-produit-f1', 'autre', 9000, 12000, 'approved', 100, 'f1');`);
  return db;
}
const un = async (db, q, p) => (await db.query(q, p)).rows[0];

async function commande(db, id, { statut = 'in_transit', total = 10000, especes = true, livreur = 'd1' } = {}) {
  const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND is_nullable = 'NO' AND column_default IS NULL`);
  const v = { id: `'${id}'`, order_number: `'CMD-${id}'`, product_id: `'pf1'`, product_name: `'[TEST]'`, customer_name: `'[TEST] Client'`,
    customer_phone: `'76000000'`, neighborhood: `'ACI'`, city: `'Bamako'`, quantity: '1', total_amount: String(total), reseller_id: `'r1'`,
    status: `'${statut}'`, assigned_driver_id: livreur ? `'${livreur}'` : 'NULL', payment_method: especes ? `'cash_on_delivery'` : `'mobile_money'` };
  for (const { column_name } of cols) if (!(column_name in v)) v[column_name] = '0';
  await db.exec(`INSERT INTO public.orders (${Object.keys(v).join(', ')}) VALUES (${Object.values(v).join(', ')})`);
  await db.exec(`INSERT INTO public.commissions (order_id, order_number, reseller_id, amount, status) VALUES ('${id}', 'CMD-${id}', 'r1', 1000, 'pending')`);
}
const livrer = (db, id) => db.exec(`UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = '${id}'`);
const recus = async (db, id) => (await un(db, `SELECT public.fonds_recus($1) AS r`, [id])).r;
const verser = async (db, ids, recu) => (await un(db, `SELECT public.record_driver_remittance('d1', $1::text[], 0, $2, 'admin', '[TEST] Admin', NULL) AS j`, [ids, recu])).j;

test('FIN-02 : une livraison forcée sans date n’est jamais « argent reçu », et son livreur est figé', async () => {
  const db = await base();
  await commande(db, 'o1');
  // Ce que faisait /api/orders/sync : statut forcé, sans date de livraison.
  await db.exec(`UPDATE public.orders SET status = 'delivered', payment_collected = true WHERE id = 'o1'`);
  assert.ok((await un(db, `SELECT delivered_at FROM public.orders WHERE id = 'o1'`)).delivered_at, 'date posée automatiquement');
  assert.equal(await recus(db, 'o1'), false, 'le livreur détient encore les espèces');
  // Commande en route, pas encore livrée (date absente) : jamais « argent reçu ».
  await commande(db, 'o2');
  assert.equal(await recus(db, 'o2'), false, 'date de livraison absente : pas reçu');
  await db.exec(`UPDATE public.commissions SET unlock_at = now() - interval '1 minute' WHERE order_id = 'o1'`);
  await db.query(`SELECT public.liberer_commissions_echues()`);
  assert.equal((await un(db, `SELECT status FROM public.commissions WHERE order_id = 'o1'`)).status, 'locked', 'commission non libérée');
  await assert.rejects(db.exec(`UPDATE public.orders SET assigned_driver_id = NULL WHERE id = 'o1'`), /LIVREUR_FIGE/);
  await assert.rejects(db.exec(`UPDATE public.orders SET assigned_driver_id = 'd2' WHERE id = 'o1'`), /LIVREUR_FIGE/);
});

test('FIN-03 : un versement ne couvre que l’argent réellement reçu, les plus anciennes d’abord', async () => {
  const db = await base();
  for (const id of ['a1', 'a2', 'a3']) { await commande(db, id); await livrer(db, id); }
  const v0 = await verser(db, ['a1'], 0);
  assert.equal(v0.success, true);
  assert.equal(await recus(db, 'a1'), false, 'versement de 0 F : rien de couvert');
  const v1 = await verser(db, ['a2', 'a3'], 10000);
  assert.equal(v1.success, true);
  // 10 000 F reçus couvrent d'abord la plus ancienne dette (a1), pas a2 ni a3.
  assert.equal(await recus(db, 'a1'), true);
  assert.equal(await recus(db, 'a2'), false);
  assert.equal(await recus(db, 'a3'), false);
  const reg = await verser(db, [], 20000);
  assert.equal(reg.success, true, 'régularisation sans commande');
  assert.equal(await recus(db, 'a2'), true);
  assert.equal(await recus(db, 'a3'), true);
  const ecart = Number((await un(db, `SELECT sum(difference) AS s FROM public.driver_remittances WHERE driver_id = 'd1'`)).s);
  assert.equal(ecart, 0, 'la dette du livreur est soldée');
});

test('FIN-04 : paiement Mobile Money confirmé — état et montant vérifiés', async () => {
  const db = await base();
  const tentative = (id, tx, montant) => db.exec(`INSERT INTO public.payment_attempts (id, order_number, network, phone, status, transaction_id, amount_requested)
    VALUES ('${tx}', 'CMD-${id}', 'orange_ml', '76000000', 'PENDING', '${tx}', ${montant})`);
  const appliquer = (id, tx, montant) => db.query(`SELECT public.apply_verified_payment($1, $2, 'SUCCESS', $3)`, [`CMD-${id}`, tx, montant]);
  const etat = async (id, tx) => ({ ...(await un(db, `SELECT payment_collected, payment_method FROM public.orders WHERE id = $1`, [id])), ...(await un(db, `SELECT status AS tentative, anomalie FROM public.payment_attempts WHERE transaction_id = $1`, [tx])) });

  await commande(db, 'p1', { statut: 'confirmed', livreur: null });
  await db.exec(`UPDATE public.orders SET status = 'cancelled' WHERE id = 'p1'`);
  await tentative('p1', 'tx1', 10100); await appliquer('p1', 'tx1', 10100);
  let e = await etat('p1', 'tx1');
  assert.equal(e.payment_collected, false, 'commande annulée : pas marquée payée');
  assert.match(e.anomalie, /remboursement_du/);

  await commande(db, 'p2', { statut: 'in_transit' }); await livrer(db, 'p2');
  await tentative('p2', 'tx2', 10100); await appliquer('p2', 'tx2', 10100);
  e = await etat('p2', 'tx2');
  assert.equal(e.payment_method, 'cash_on_delivery', 'déjà payée en espèces : reste dans la caisse du livreur');
  assert.match(e.anomalie, /déjà payée en espèces/);

  await commande(db, 'p3', { statut: 'confirmed', livreur: null });
  await tentative('p3', 'tx3', 10100); await appliquer('p3', 'tx3', 5000);
  e = await etat('p3', 'tx3');
  assert.equal(e.payment_collected, false, 'montant insuffisant');
  assert.match(e.anomalie, /montant_insuffisant/);

  await commande(db, 'p4', { statut: 'pending_call', livreur: null });
  await tentative('p4', 'tx4', 10100); await appliquer('p4', 'tx4', 10100);
  e = await etat('p4', 'tx4');
  assert.equal(e.payment_collected, true); assert.equal(e.payment_method, 'mobile_money'); assert.equal(e.anomalie, null);
  await appliquer('p4', 'tx4', 10100);
  assert.equal((await un(db, `SELECT status FROM public.orders WHERE id = 'p4'`)).status, 'confirmed', 'rejeu sans effet');
  // Sans montant fourni (ancien appelant) : comportement inchangé.
  await commande(db, 'p5', { statut: 'confirmed', livreur: null });
  await tentative('p5', 'tx5', 10100); await db.query(`SELECT public.apply_verified_payment('CMD-p5', 'tx5', 'SUCCESS')`);
  assert.equal((await etat('p5', 'tx5')).payment_collected, true);
});

test('FIN-19 : deux « Argent remis » simultanés — le second est refusé', async () => {
  const db = await base();
  await db.exec(`INSERT INTO public.commissions (reseller_id, amount, status) VALUES ('r1', 6000, 'available')`);
  await un(db, `SELECT public.create_payout_atomic('r1', 'k1', 'e1', '${JSON.stringify({ id: 'WTH-D', reseller_name: '[TEST]', amount: 6000, payment_method: 'cash', phone_number: '+22370000003', montant_demande: 6000, frais_retrait: 0, detail_frais: {} })}'::jsonb) AS p`);
  await un(db, `SELECT public.finalize_payout_atomic('WTH-D', 'completed', 'GUICHET a', 'pending') AS p`);
  await assert.rejects(db.query(`SELECT public.finalize_payout_atomic('WTH-D', 'completed', 'GUICHET b', 'pending')`), /STATUS_CONFLICT/);
  // Le webhook (sans état attendu) reste idempotent.
  assert.equal((await un(db, `SELECT public.finalize_payout_atomic('WTH-D', 'completed', 'X') AS p`)).p.status, 'completed');
});
