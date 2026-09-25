// Remise par le fournisseur, de bout en bout dans un PostgreSQL LOCAL en
// mémoire (PGlite, aucune base distante) : les SQL « caisse livreurs » puis
// « offres & remise » tels que le fondateur les exécutera.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { database, sql } = require('./helpers/audit-db.cjs');

async function base() {
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-25-caisse-livreurs.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-offres-remise.sql'));
  await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_id, stock, status, mode_remise, type_offre)
    VALUES ('p1', '[TEST] Kit solaire', 'test-kit', 'Solaire', 'f1', 5, 'approved', 'fournisseur', 'produit_service'),
           ('p2', '[TEST] Téléphone', 'test-tel', 'Téléphones', 'f1', 5, 'approved', 'livreur', 'produit')`);
  const commande = (id, produit, mode) => db.exec(`INSERT INTO public.orders
    (id, order_number, product_id, product_name, customer_name, customer_phone, total_amount, delivery_otp, pricing_snapshot)
    VALUES ('${id}', 'SG-${id}', '${produit}', '[TEST]', '[TEST] Client', '+22370000000', 50000, '4821', '{"remise":{"mode":"${mode}","frais":0}}');
    UPDATE public.orders SET status = 'confirmed', delivery_code_version = 1, delivery_code_sent_at = now() WHERE id = '${id}';`);
  await commande('o1', 'p1', 'fournisseur');
  await commande('o2', 'p2', 'livreur');
  return db;
}
const appel = async (db, q) => (await db.query(q)).rows[0];

test('SQL : colonnes d’offre avec des valeurs contrôlées', async () => {
  const db = await base();
  await assert.rejects(db.exec(`UPDATE public.products SET mode_remise = 'drone' WHERE id = 'p1'`));
  await assert.rejects(db.exec(`UPDATE public.products SET frais_remise = -5 WHERE id = 'p1'`));
  const p = await appel(db, `SELECT type_offre, mode_remise, frais_remise FROM public.products WHERE id = 'p2'`);
  assert.deepEqual({ ...p, frais_remise: Number(p.frais_remise) }, { type_offre: 'produit', mode_remise: 'livreur', frais_remise: 0 });
});

test('SQL : « Organiser la remise » réservé au bon fournisseur et aux offres remises par lui', async () => {
  const db = await base();
  const autre = await appel(db, `SELECT public.prendre_en_charge_remise('o1', 'f2', 'Autre') AS r`);
  assert.equal(autre.r.http, 403);
  const livreur = await appel(db, `SELECT public.prendre_en_charge_remise('o2', 'f1', 'F1') AS r`);
  assert.equal(livreur.r.http, 409, 'une commande livrée par Suguba ne se prend pas');
  const ok = await appel(db, `SELECT public.prendre_en_charge_remise('o1', 'f1', '[TEST] SARL') AS r`);
  assert.equal(ok.r.success, true);
  const o = await appel(db, `SELECT status, assigned_driver_id, assigned_driver_name, picked_up_at FROM public.orders WHERE id = 'o1'`);
  assert.equal(o.status, 'in_transit');
  assert.equal(o.assigned_driver_id, 'f1');
  assert.ok(o.picked_up_at);
  const encore = await appel(db, `SELECT public.prendre_en_charge_remise('o1', 'f1', '[TEST] SARL') AS r`);
  assert.equal(encore.r.success, true, 'idempotent');
});

test('SQL : remise confirmée par le code du client, puis espèces versées sans part « livreur »', async () => {
  const db = await base();
  await db.query(`SELECT public.prendre_en_charge_remise('o1', 'f1', '[TEST] SARL')`);
  const faux = await appel(db, `SELECT public.verify_delivery_atomic('o1', 'f1', '0000') AS r`);
  assert.equal(faux.r.http, 400);
  const bon = await appel(db, `SELECT public.verify_delivery_atomic('o1', 'f1', '4821') AS r`);
  assert.equal(bon.r.success, true);
  assert.equal((await appel(db, `SELECT status FROM public.orders WHERE id = 'o1'`)).status, 'delivered');

  const v = await appel(db, `SELECT public.record_driver_remittance('f1', ARRAY['o1'], 1000, 50000, 'admin-1', '[TEST] Caisse', NULL) AS r`);
  assert.equal(v.r.success, true);
  const ligne = await appel(db, `SELECT remuneration_retained, amount_due, difference FROM public.driver_remittances`);
  assert.equal(Number(ligne.remuneration_retained), 0, 'le fournisseur ne garde pas de rémunération de livreur');
  assert.equal(Number(ligne.amount_due), 50000);
  assert.equal(Number(ligne.difference), 0);
});
