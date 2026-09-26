// Campagnes encadrées (2026-09-26, lot 2b) : une campagne fournisseur ne
// s'active qu'avec son budget reçu en entier ; canal choisi avant de payer.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('SQL : activation refusée tant que le budget n’est pas réglé en entier', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-campagnes.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-campagnes.sql')); // relançable
  await db.exec(`INSERT INTO public.profiles (id, phone, full_name, role) VALUES ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier')`);
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, max_participants, supplier_id, canal)
    VALUES ('c1', '[TEST] Lancement', 'share', 5, 1000, 5, 'f1', 'whatsapp_statut')`);

  await assert.rejects(db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'c1'`), /BUDGET_NON_REGLE/);
  await db.exec(`UPDATE public.missions SET budget_recu = 4000, budget_reference = 'OM-TEST' WHERE id = 'c1'`);
  await assert.rejects(db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'c1'`), /BUDGET_NON_REGLE/, '4 000 sur 5 000');
  await db.exec(`UPDATE public.missions SET budget_recu = 5000 WHERE id = 'c1'`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'c1'`);
  assert.equal((await db.query(`SELECT status FROM public.missions WHERE id = 'c1'`)).rows[0].status, 'active');

  // Mission Suguba (sans fournisseur) : pas de budget à encaisser.
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount) VALUES ('m1', '[TEST] Interne', 'sale', 1, 500)`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'm1'`);

  await assert.rejects(db.exec(`UPDATE public.missions SET canal = 'sms' WHERE id = 'c1'`), 'canal inconnu refusé');
  await assert.rejects(db.exec(`UPDATE public.missions SET budget_recu = -1 WHERE id = 'c1'`));
});
