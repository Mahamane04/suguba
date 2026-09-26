// Protection Suguba — lot 1 « Trésorerie » (2026-09-26) : un gain de vente en
// espèces attend l'argent chez Suguba ; les paiements reçus des campagnes et
// sponsorisations forment un historique ; pas d'auto-demande payée.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function base() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['migration-reseau-v2.sql', 'A-EXECUTER-2026-09-25-caisse-livreurs.sql', 'A-EXECUTER-2026-09-26-campagnes.sql',
    'A-EXECUTER-2026-09-26-sponsorisations-paiement.sql', 'A-EXECUTER-2026-09-26-devis.sql', 'A-EXECUTER-2026-09-26-campagnes-resultat.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  // Un total déjà saisi avant l'historique, pour vérifier la reprise.
  await db.exec(`
    INSERT INTO public.profiles (id, phone, full_name, role) VALUES
      ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'),
      ('r1', '+22370000003', '[TEST] Revendeur', 'reseller'),
      ('d1', '+22370000005', '[TEST] Livreur', 'driver');
    INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, max_participants, supplier_id, budget_recu, budget_reference)
      VALUES ('c0', '[TEST] Ancienne', 'share', 1, 1000, 2, 'f1', 2000, 'OM-ANCIEN');`);
  for (const f of ['A-EXECUTER-2026-09-26-tresorerie.sql', 'A-EXECUTER-2026-09-26-tresorerie.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  const { rows: [p] } = await db.query(`SELECT id FROM public.products LIMIT 1`);
  let produit = p?.id;
  if (!produit) {
    await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_price, public_price, status)
      VALUES ('p1', '[TEST] Produit', 'test-produit', 'autre', 1000, 1500, 'approved')`);
    produit = 'p1';
  }
  await db.exec(`UPDATE public.products SET stock = 100, status = 'approved' WHERE id = '${produit}'`);
  return { db, produit };
}
const un = async (db, q) => (await db.query(q)).rows[0];

async function commande(db, produit, id, extra) {
  const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND is_nullable = 'NO' AND column_default IS NULL`);
  const v = { id: `'${id}'`, order_number: `'CMD-${id}'`, product_id: `'${produit}'`, product_name: `'[TEST]'`, customer_name: `'[TEST] Client'`,
    customer_phone: `'76000000'`, reseller_id: `'r1'`, neighborhood: `'ACI'`, city: `'Bamako'`, quantity: '1', total_amount: '10000', ...extra };
  for (const { column_name } of cols) if (!(column_name in v)) v[column_name] = '0';
  await db.exec(`INSERT INTO public.orders (${Object.keys(v).join(', ')}) VALUES (${Object.values(v).join(', ')})`);
  await db.exec(`INSERT INTO public.commissions (order_id, order_number, reseller_id, amount, status, unlock_at)
    VALUES ('${id}', 'CMD-${id}', 'r1', 500, 'locked', now() - interval '1 hour')`);
}
const statutCommission = async (db, id) => (await un(db, `SELECT status FROM public.commissions WHERE order_id = '${id}'`)).status;

test('SQL : un gain en espèces attend le versement ; Mobile Money et anciennes commandes passent', async () => {
  const { db, produit } = await base();
  await commande(db, produit, 'o-especes', { status: `'delivered'`, delivered_at: 'now()', assigned_driver_id: `'d1'`, payment_method: `'cash_on_delivery'` });
  await commande(db, produit, 'o-momo', { status: `'delivered'`, delivered_at: 'now()', assigned_driver_id: `'d1'`, payment_method: `'mobile_money'` });
  await commande(db, produit, 'o-ancienne', { status: `'delivered'`, delivered_at: `now() - interval '10 days'`, assigned_driver_id: `'d1'`, payment_method: `'cash_on_delivery'` });

  await db.query(`SELECT public.liberer_commissions_echues()`);
  assert.equal(await statutCommission(db, 'o-especes'), 'locked', 'espèces pas encore reçues');
  assert.equal(await statutCommission(db, 'o-momo'), 'available');
  assert.equal(await statutCommission(db, 'o-ancienne'), 'available', 'livrée avant la règle');

  const v = (await un(db, `SELECT public.record_driver_remittance('d1', ARRAY['o-especes'], 0, 10000, 'admin', '[TEST] Admin', NULL) AS j`)).j;
  assert.equal(v.success, true);
  await db.query(`SELECT public.liberer_commissions_echues()`);
  assert.equal(await statutCommission(db, 'o-especes'), 'available', 'fonds reçus : le gain se libère');
});

test('SQL : paiements reçus en historique, référence unique, total non modifiable à la main', async () => {
  const { db } = await base();
  const reprise = await un(db, `SELECT montant, note FROM public.paiements_recus WHERE cible_id = 'c0'`);
  assert.equal(Number(reprise.montant), 2000, 'total existant repris');
  assert.match(reprise.note, /OM-ANCIEN/);

  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, max_participants, supplier_id)
    VALUES ('c1', '[TEST] Lancement', 'share', 5, 1000, 5, 'f1')`);
  await assert.rejects(db.exec(`UPDATE public.missions SET budget_recu = 5000 WHERE id = 'c1'`), /PAIEMENT_PAR_HISTORIQUE/);

  await db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference, recu_par) VALUES ('campagne', 'c1', 3000, 'OM 123-456', 'admin')`);
  await assert.rejects(db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference) VALUES ('sponsorisation', 's1', 3000, 'om123456')`),
    /duplicate|unique/, 'même transaction utilisée deux fois');
  await db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference, recu_par) VALUES ('campagne', 'c1', 2000, 'OM-789', 'admin')`);
  assert.equal(Number((await un(db, `SELECT budget_recu FROM public.missions WHERE id = 'c1'`)).budget_recu), 5000);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'c1'`);

  const p = await un(db, `SELECT id FROM public.paiements_recus WHERE reference = 'OM-789'`);
  await assert.rejects(db.exec(`DELETE FROM public.paiements_recus WHERE id = '${p.id}'`), /PAIEMENT_NON_SUPPRIMABLE/);
  await assert.rejects(db.exec(`UPDATE public.paiements_recus SET montant = 20000 WHERE id = '${p.id}'`), /PAIEMENT_NON_MODIFIABLE/);
  await assert.rejects(db.exec(`UPDATE public.paiements_recus SET annule_le = now() WHERE id = '${p.id}'`), /PAIEMENT_NON_MODIFIABLE/, 'motif obligatoire');
  await db.exec(`UPDATE public.paiements_recus SET annule_le = now(), annule_par = 'admin', motif_annulation = 'Saisie en double' WHERE id = '${p.id}'`);
  assert.equal(Number((await un(db, `SELECT budget_recu FROM public.missions WHERE id = 'c1'`)).budget_recu), 3000, 'annulé = retiré du total');
  await assert.rejects(db.exec(`UPDATE public.paiements_recus SET motif_annulation = 'autre' WHERE id = '${p.id}'`), /PAIEMENT_NON_MODIFIABLE/);
  // La référence d'un paiement annulé peut resservir (il n'a jamais compté).
  await db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference) VALUES ('campagne', 'c1', 2000, 'OM-789')`);

  // Sponsorisation : même historique, activation toujours gardée.
  await db.exec(`INSERT INTO public.sponsorships (id, subject_type, subject_ref, budget) VALUES ('s1', 'product', 'p1', 15000)`);
  await assert.rejects(db.exec(`UPDATE public.sponsorships SET paid_amount = 15000 WHERE id = 's1'`), /PAIEMENT_PAR_HISTORIQUE/);
  await db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference) VALUES ('sponsorisation', 's1', 15000, 'OM-SP-1')`);
  await db.exec(`UPDATE public.sponsorships SET status = 'active', activated_at = now() WHERE id = 's1'`);
  assert.equal(Number((await un(db, `SELECT paid_amount FROM public.sponsorships WHERE id = 's1'`)).paid_amount), 15000);
});

test('SQL : une demande faite avec le numéro du revendeur n’est pas payée', async () => {
  const { db, produit } = await base();
  await db.exec(`INSERT INTO public.reseau_reglages (id, valeurs) VALUES (1, '{"remunerationResultat": true}')
    ON CONFLICT (id) DO UPDATE SET valeurs = EXCLUDED.valeurs`);
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id, product_id)
    VALUES ('d1', '[TEST] Demandes', 'demande_qualifiee', 10, 1000, 'f1', '${produit}')`);
  await db.exec(`INSERT INTO public.paiements_recus (cible, cible_id, montant, reference) VALUES ('campagne', 'd1', 10000, 'OM-DEM-1')`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'd1'`);
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('d1', 'r1')`);

  await db.exec(`INSERT INTO public.quote_requests (quote_number, access_key_hash, product_id, supplier_id, reseller_id, customer_name, customer_phone, besoin)
    VALUES ('DV-1', 'h1', '${produit}', 'f1', 'r1', '[TEST] Moi', '70 00 00 03', 'Test'),
           ('DV-2', 'h2', '${produit}', 'f1', 'r1', '[TEST] Client', '+223 71 22 33 44', 'Vrai besoin')`);
  await db.exec(`UPDATE public.quote_requests SET status = 'proposee'`);
  const r = await db.query(`SELECT origine FROM public.campagne_resultats`);
  assert.equal(r.rows.length, 1, 'seule la demande d’un vrai client compte');
});

test('Plafond d’espèces : bloque au plafond ou en retard grave, jamais sans dette', () => {
  const { blocageEspeces, duParCollecteur } = require('../src/lib/caisse-livreur.ts');
  const r = { plafondEspecesCollecteur: 150000, delaiVersementEspecesHeures: 24 };
  const maintenant = Date.now();
  const recent = new Date(maintenant - 3600_000).toISOString();
  const ancien = new Date(maintenant - 49 * 3600_000).toISOString();
  assert.equal(blocageEspeces(149999, recent, r, maintenant).bloque, false);
  assert.equal(blocageEspeces(150000, recent, r, maintenant).bloque, true, 'plafond atteint');
  assert.equal(blocageEspeces(5000, ancien, r, maintenant).bloque, true, 'retard grave (2 × 24 h)');
  assert.equal(blocageEspeces(0, ancien, r, maintenant).bloque, false, 'rien à verser');
  assert.equal(blocageEspeces(900000, recent, { ...r, plafondEspecesCollecteur: 0 }, maintenant).bloque, false, '0 = pas de plafond');
  assert.equal(duParCollecteur({ aVerser: 10000, ecartCumule: -2000 }), 12000, 'un manque passé s’ajoute');

  const { completerReglages } = require('../src/lib/pricing.ts');
  assert.equal(completerReglages({}).plafondEspecesCollecteur, 150000);
});
