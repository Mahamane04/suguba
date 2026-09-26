// Sponsorisations (2026-09-26) : pas d'activation sans le prix du pack réglé.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('SQL : activation refusée tant que le pack n’est pas réglé en entier', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('migration-reseau-v1.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-sponsorisations-paiement.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-sponsorisations-paiement.sql')); // relançable
  await db.exec(`INSERT INTO public.sponsorships (id, subject_type, subject_ref, budget) VALUES ('s1', 'product', 'p1', 15000)`);
  await assert.rejects(db.exec(`UPDATE public.sponsorships SET status = 'active' WHERE id = 's1'`), /SPONSORISATION_NON_REGLEE/);
  await db.exec(`UPDATE public.sponsorships SET paid_amount = 10000, payment_reference = 'OM-TEST' WHERE id = 's1'`);
  await assert.rejects(db.exec(`UPDATE public.sponsorships SET status = 'active' WHERE id = 's1'`), /SPONSORISATION_NON_REGLEE/, '10 000 sur 15 000');
  await db.exec(`UPDATE public.sponsorships SET paid_amount = 15000 WHERE id = 's1'`);
  await db.exec(`UPDATE public.sponsorships SET status = 'active', activated_at = now() WHERE id = 's1'`);
  assert.equal((await db.query(`SELECT status FROM public.sponsorships WHERE id = 's1'`)).rows[0].status, 'active');
  await assert.rejects(db.exec(`UPDATE public.sponsorships SET paid_amount = -5 WHERE id = 's1'`));
});
