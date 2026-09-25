// Prestations à étapes (2026-09-26, lot 1c) : le fournisseur déclare avec une
// preuve, le client valide depuis son reçu, la réception finale attend que
// tout soit validé (vérifié par l'application ET par la base).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const offre = require('../src/lib/offre.ts');

test('offre : étapes normalisées, jamais pour une livraison Suguba', () => {
  assert.deepEqual(offre.normaliserEtapes(['installation', 'visite', 'visite', 'inconnue']), ['visite', 'installation']);
  assert.deepEqual(offre.normaliserEtapes('visite'), []);
  assert.deepEqual(offre.remiseDuProduit({ mode_remise: 'fournisseur', frais_remise: 0, etapes: ['installation'] }).etapes, ['installation']);
  assert.equal(offre.remiseDuProduit({ mode_remise: 'livreur', etapes: ['installation'] }).etapes, undefined);
  assert.deepEqual(offre.etapesCommande({ remise: { mode: 'retrait', etapes: ['prise_en_main'] } }), ['prise_en_main']);
  assert.deepEqual(offre.etapesCommande({ remise: { mode: 'livreur', etapes: ['visite'] } }), []);
});

// ── Base simulée ───────────────────────────────────────────────────────────
let tables;
function requete(nom) {
  tables[nom] ||= [];
  let lignes = tables[nom];
  let maj = null;
  const appliquer = () => { if (maj) lignes.forEach((l) => Object.assign(l, maj)); };
  const q = {
    select() { return q; },
    eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
    in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
    order() { return q; },
    limit() { return q; },
    update(v) { maj = v; return q; },
    maybeSingle: async () => { appliquer(); return { data: lignes[0] ? { ...lignes[0] } : null, error: null }; },
    then(ok, ko) { appliquer(); return Promise.resolve({ data: lignes.map((l) => ({ ...l })), error: null }).then(ok, ko); },
    upsert: async (rows) => {
      for (const r of rows) {
        if (!tables[nom].some((l) => l.order_id === r.order_id && l.position === r.position)) tables[nom].push({ statut: 'a_faire', photos: 0, ...r });
      }
      return { error: null };
    },
  };
  return q;
}
const admin = { from: (nom) => requete(nom) };
const avis = [];
require.cache[require.resolve('../src/lib/reseau/notifications.ts')] = { exports: { notifier: async (ids, c) => { avis.push({ ids, ...c }); } } };
const etapes = require('../src/lib/etapes.ts');

const commande = (x = {}) => ({
  id: 'o1', order_number: 'SG-TESTET', status: 'in_transit', assigned_driver_id: 'f1', product_name: '[TEST] Kit solaire posé',
  pricing_snapshot: { remise: { mode: 'fournisseur', frais: 0, etapes: ['rendez_vous', 'installation'] } }, ...x,
});

test('parcours : ordre imposé, preuve exigée, le fournisseur ne valide jamais', async () => {
  tables = { orders: [commande()], order_steps: [] };
  avis.length = 0;
  const o = tables.orders[0];

  await assert.rejects(etapes.declarerEtape(admin, 'autre', { orderId: 'o1', position: 1, datePrevue: new Date().toISOString() }), /pas assignée/);
  await assert.rejects(etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 2, note: 'Panneaux posés' }), /étape précédente/);
  await assert.rejects(etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 1 }), /date et l’heure/);
  assert.equal(await etapes.etapesNonValidees(admin, o), 2);

  const rdv = new Date(Date.now() + 86_400_000).toISOString();
  const e1 = await etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 1, datePrevue: rdv });
  assert.equal(e1.statut, 'declaree');
  await assert.rejects(etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 1, datePrevue: rdv }), /le client doit la valider/);

  await assert.rejects(etapes.repondreEtape(admin, 'SG-TESTET', { position: 1, decision: 'contester', motif: '' }), /Expliquez/);
  assert.equal((await etapes.repondreEtape(admin, 'SG-TESTET', { position: 1, decision: 'valider' })).statut, 'validee');
  await assert.rejects(etapes.repondreEtape(admin, 'SG-TESTET', { position: 1, decision: 'valider' }), /n’attend pas/);

  await assert.rejects(etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 2, note: '' }), /photo ou décrivez/);
  await etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 2, note: '4 panneaux posés, test OK' });
  const contest = await etapes.repondreEtape(admin, 'SG-TESTET', { position: 2, decision: 'contester', motif: 'La batterie ne charge pas' });
  assert.equal(contest.statut, 'contestee');
  assert.equal(await etapes.etapesNonValidees(admin, o), 1, 'réception finale encore bloquée');

  // Suguba tranche, toujours avec une raison.
  await assert.rejects(etapes.trancherEtape(admin, { orderId: 'o1', position: 2, action: 'valider', note: '' }), /raison/);
  await etapes.trancherEtape(admin, { orderId: 'o1', position: 2, action: 'rouvrir', note: 'Reprendre le câblage jeudi' });
  await etapes.declarerEtape(admin, 'f1', { orderId: 'o1', position: 2, note: 'Câblage repris, batterie OK' });
  await etapes.repondreEtape(admin, 'SG-TESTET', { position: 2, decision: 'valider' });
  assert.equal(await etapes.etapesNonValidees(admin, o), 0, 'réception finale possible');

  assert.ok(avis.every((a) => a.ids === 'f1'), 'avis au fournisseur seulement');
  assert.ok(avis.some((a) => /contestée/.test(a.titre)));
});

test('commande sans étapes : réception finale directe, rien créé', async () => {
  tables = { orders: [commande({ pricing_snapshot: { remise: { mode: 'fournisseur', frais: 0 } } })], order_steps: [] };
  assert.equal(await etapes.etapesNonValidees(admin, tables.orders[0]), 0);
  assert.equal(tables.order_steps.length, 0);
});

// ── SQL réel (PostgreSQL local en mémoire, aucune base distante) ───────────
test('SQL : la base refuse la réception finale tant qu’une étape n’est pas validée', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-prestations-etapes.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-prestations-etapes.sql')); // idempotent
  await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_id, stock, status, supplier_price, public_price, etapes)
    VALUES ('p1', '[TEST] Kit', 'test-kit', 'Solaire', 'f1', 3, 'approved', 100000, 130000, '["installation"]')`);
  await assert.rejects(db.exec(`UPDATE public.products SET etapes = '"installation"' WHERE id = 'p1'`));
  await db.exec(`INSERT INTO public.orders (id, order_number, product_id, product_name, quantity, unit_price, total_product_amount, delivery_fee, total_amount, customer_name, customer_phone, city, status)
    VALUES ('o1', 'SG-TESTET', 'p1', '[TEST] Kit', 1, 130000, 130000, 0, 130000, '[TEST]', '+22370000001', 'Bamako', 'in_transit')`);
  await db.exec(`INSERT INTO public.order_steps (order_id, position, cle) VALUES ('o1', 1, 'installation')`);
  await assert.rejects(db.exec(`INSERT INTO public.order_steps (order_id, position, cle) VALUES ('o1', 2, 'peinture')`));

  await assert.rejects(db.exec(`UPDATE public.orders SET status = 'delivered' WHERE id = 'o1'`), /ETAPES_NON_VALIDEES/);
  await db.exec(`UPDATE public.order_steps SET statut = 'validee', validated_by = 'client' WHERE order_id = 'o1'`);
  await db.exec(`UPDATE public.orders SET status = 'delivered' WHERE id = 'o1'`);
  const o = (await db.query(`SELECT status FROM public.orders WHERE id = 'o1'`)).rows[0];
  assert.equal(o.status, 'delivered');
});
