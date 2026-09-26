// Rémunération au résultat (2026-09-26, lot 3) : interrupteur, budget payé
// d'avance, un visiteur / un client une seule fois, 80 % au revendeur en
// attente 7 jours, contestation 48 h, annulation qui rend le budget.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function base() {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['migration-reseau-v2.sql', 'A-EXECUTER-2026-09-26-campagnes.sql', 'A-EXECUTER-2026-09-26-devis.sql',
    'A-EXECUTER-2026-09-26-campagnes-resultat.sql', 'A-EXECUTER-2026-09-26-campagnes-resultat.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  await db.exec(`
    INSERT INTO public.profiles (id, phone, full_name, role) VALUES
      ('f1', '+22370000002', '[TEST] Fournisseur', 'supplier'),
      ('r1', '+22370000003', '[TEST] Revendeur', 'reseller'),
      ('r2', '+22370000004', '[TEST] Revendeur 2', 'reseller');
    INSERT INTO public.reseau_reglages (id, valeurs) VALUES (1, '{"remunerationResultat": true}')
      ON CONFLICT (id) DO UPDATE SET valeurs = EXCLUDED.valeurs;`);
  const { rows: [p] } = await db.query(`SELECT id FROM public.products LIMIT 1`);
  let produit = p?.id;
  if (!produit) {
    await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_price, public_price, status)
      VALUES ('p1', '[TEST] Produit', 'test-produit', 'autre', 1000, 1500, 'approved')`);
    produit = 'p1';
  }
  return { db, produit };
}
const un = async (db, q) => (await db.query(q)).rows[0];
const resultat = async (db, m, r, genre, cle, reseau = null) =>
  (await un(db, `SELECT public.enregistrer_resultat_campagne('${m}', '${r}', '${genre}', '${cle}', NULL, ${reseau ? `'${reseau}'` : 'NULL'}) AS j`)).j;

test('SQL : visites payées une fois, budget consommé puis pause, 80 % en attente 7 jours', async () => {
  const { db, produit } = await base();
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id, product_id)
    VALUES ('v1', '[TEST] Visites', 'visite_qualifiee', 3, 100, 'f1', '${produit}')`);
  await assert.rejects(db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'v1'`), /BUDGET_NON_REGLE/);
  await db.exec(`UPDATE public.missions SET budget_recu = 300 WHERE id = 'v1'`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'v1'`);

  assert.equal((await resultat(db, 'v1', 'r1', 'visite', 'visiteur:a')).raison, 'participation', 'il faut rejoindre');
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('v1', 'r1'), ('v1', 'r2')`);
  assert.equal((await resultat(db, 'v1', 'r1', 'demande', 'client:x')).raison, 'mission', 'mauvais genre');

  const a = await resultat(db, 'v1', 'r1', 'visite', 'visiteur:a');
  assert.equal(a.compte, true);
  assert.equal(a.statut, 'retenu');
  assert.equal((await resultat(db, 'v1', 'r2', 'visite', 'visiteur:a')).raison, 'deja', 'un visiteur, une fois par campagne');

  const c = await un(db, `SELECT amount, status, unlock_at > now() + interval '6 days' AS attente FROM public.commissions WHERE source = 'campagne' AND source_ref = '${a.id}'`);
  assert.equal(Number(c.amount), 80, '80 % au revendeur');
  assert.equal(c.status, 'locked');
  assert.equal(c.attente, true);

  await resultat(db, 'v1', 'r1', 'visite', 'visiteur:b');
  await resultat(db, 'v1', 'r2', 'visite', 'visiteur:c');
  const m = await un(db, `SELECT status, budget_consomme FROM public.missions WHERE id = 'v1'`);
  assert.equal(Number(m.budget_consomme), 300);
  assert.equal(m.status, 'paused', 'budget épuisé : pause automatique');
  assert.equal((await resultat(db, 'v1', 'r1', 'visite', 'visiteur:d')).raison, 'mission');
  await assert.rejects(db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'v1'`), /BUDGET_NON_REGLE/);

  // Annulation : gain annulé, prix rendu au budget, réactivation possible.
  assert.equal((await un(db, `SELECT public.decider_resultat_campagne('${a.id}', 'annuler', 'admin', 'Fraude') AS s`)).s, 'annule');
  assert.equal((await un(db, `SELECT status FROM public.commissions WHERE source_ref = '${a.id}'`)).status, 'reversed');
  assert.equal(Number((await un(db, `SELECT budget_consomme FROM public.missions WHERE id = 'v1'`)).budget_consomme), 200);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'v1'`);
  await assert.rejects(db.query(`SELECT public.decider_resultat_campagne('${a.id}', 'annuler', 'admin', NULL)`), /DEJA_TRAITE/);
});

test('SQL : interrupteur coupé = rien payé ; réseau suspect = à vérifier ; contestation 48 h', async () => {
  const { db, produit } = await base();
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id, product_id, budget_recu)
    VALUES ('v2', '[TEST] Visites', 'visite_qualifiee', 100, 50, 'f1', '${produit}', 5000)`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'v2'`);
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('v2', 'r1')`);

  await db.exec(`UPDATE public.reseau_reglages SET valeurs = '{"remunerationResultat": false}' WHERE id = 1`);
  assert.equal((await resultat(db, 'v2', 'r1', 'visite', 'visiteur:z')).raison, 'desactive');
  await db.exec(`UPDATE public.reseau_reglages SET valeurs = '{"remunerationResultat": true}' WHERE id = 1`);

  const statuts = [];
  for (let i = 0; i < 6; i++) statuts.push((await resultat(db, 'v2', 'r1', 'visite', `visiteur:${i}`, 'net1')).statut);
  assert.deepEqual(statuts, ['retenu', 'retenu', 'retenu', 'retenu', 'retenu', 'a_verifier']);
  const suspect = await un(db, `SELECT r.id, c.status FROM public.campagne_resultats r JOIN public.commissions c ON c.source_ref = r.id::text WHERE r.statut = 'a_verifier'`);
  assert.equal(suspect.status, 'pending', 'gain gelé tant que l’admin n’a pas vérifié');
  assert.equal((await un(db, `SELECT public.decider_resultat_campagne('${suspect.id}', 'valider', 'admin', NULL) AS s`)).s, 'retenu');
  assert.equal((await un(db, `SELECT status FROM public.commissions WHERE source_ref = '${suspect.id}'`)).status, 'locked');

  const premier = await un(db, `SELECT id FROM public.campagne_resultats WHERE cle = 'visiteur:0'`);
  assert.equal((await un(db, `SELECT public.decider_resultat_campagne('${premier.id}', 'contester', 'f1', 'Visites de robots') AS s`)).s, 'conteste');
  assert.equal((await un(db, `SELECT status FROM public.commissions WHERE source_ref = '${premier.id}'`)).status, 'pending');

  const vieux = await un(db, `SELECT id FROM public.campagne_resultats WHERE cle = 'visiteur:1'`);
  await db.exec(`UPDATE public.campagne_resultats SET created_at = now() - interval '3 days' WHERE id = '${vieux.id}'`);
  await assert.rejects(db.query(`SELECT public.decider_resultat_campagne('${vieux.id}', 'contester', 'f1', 'Trop tard')`), /DELAI_DEPASSE/);

  // Gain déjà retirable : plus d'annulation possible.
  await db.exec(`UPDATE public.commissions SET status = 'available' WHERE source_ref = '${vieux.id}'`);
  await assert.rejects(db.query(`SELECT public.decider_resultat_campagne('${vieux.id}', 'annuler', 'admin', NULL)`), /DEJA_VERSE/);

  // Plafond de 50 visites par jour et par revendeur.
  for (let i = 6; i < 51; i++) await resultat(db, 'v2', 'r1', 'visite', `visiteur:${i}`);
  assert.equal((await resultat(db, 'v2', 'r1', 'visite', 'visiteur:x')).raison, 'plafond');
});

test('SQL : demande qualifiée = devis proposé ou commande confirmée, un client une fois', async () => {
  const { db, produit } = await base();
  await db.exec(`INSERT INTO public.missions (id, title, mission_type, objective, reward_amount, supplier_id, product_id, budget_recu)
    VALUES ('d1', '[TEST] Demandes', 'demande_qualifiee', 10, 1000, 'f1', '${produit}', 10000)`);
  await db.exec(`UPDATE public.missions SET status = 'active' WHERE id = 'd1'`);
  await db.exec(`INSERT INTO public.mission_participants (mission_id, reseller_id) VALUES ('d1', 'r1')`);

  await db.exec(`INSERT INTO public.quote_requests (quote_number, access_key_hash, product_id, supplier_id, reseller_id, customer_name, customer_phone, besoin)
    VALUES ('DV-1', 'h1', '${produit}', 'f1', 'r1', '[TEST] Client', '+223 70 11 22 33', 'Kit solaire')`);
  assert.equal(Number((await un(db, `SELECT count(*) n FROM public.campagne_resultats`)).n), 0, 'pas encore de réponse');
  await db.exec(`UPDATE public.quote_requests SET status = 'proposee' WHERE quote_number = 'DV-1'`);
  const r = await un(db, `SELECT genre, origine, prix, part_revendeur FROM public.campagne_resultats`);
  assert.equal(r.genre, 'demande');
  assert.match(r.origine, /^devis:/);
  assert.equal(Number(r.part_revendeur), 800);

  // Le même client commande ensuite : pas payé deux fois.
  const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND is_nullable = 'NO' AND column_default IS NULL`);
  const valeurs = { id: `'o1'`, order_number: `'CMD-T1'`, product_id: `'${produit}'`, product_name: `'[TEST]'`, customer_name: `'[TEST] Client'`,
    customer_phone: `'70112233'`, reseller_id: `'r1'`, neighborhood: `'ACI'`, city: `'Bamako'`, status: `'pending_call'` };
  for (const { column_name } of cols) if (!(column_name in valeurs)) valeurs[column_name] = '0';
  await db.exec(`UPDATE public.products SET stock = 10, status = 'approved' WHERE id = '${produit}'`);
  valeurs.quantity = '1';
  await db.exec(`INSERT INTO public.orders (${Object.keys(valeurs).join(', ')}) VALUES (${Object.values(valeurs).join(', ')})`);
  await db.exec(`UPDATE public.orders SET status = 'confirmed' WHERE id = 'o1'`);
  assert.equal(Number((await un(db, `SELECT count(*) n FROM public.campagne_resultats`)).n), 1);
  assert.equal((await un(db, `SELECT status FROM public.orders WHERE id = 'o1'`)).status, 'confirmed', 'la commande passe toujours');

  // Un autre client qui commande : une nouvelle demande payée.
  Object.assign(valeurs, { id: `'o2'`, order_number: `'CMD-T2'`, customer_phone: `'+22376543210'` });
  await db.exec(`INSERT INTO public.orders (${Object.keys(valeurs).join(', ')}) VALUES (${Object.values(valeurs).join(', ')})`);
  await db.exec(`UPDATE public.orders SET status = 'confirmed' WHERE id = 'o2'`);
  const o = await un(db, `SELECT count(*) n, max(origine) o FROM public.campagne_resultats`);
  assert.equal(Number(o.n), 2);
  assert.equal(Number((await un(db, `SELECT count(*) n FROM public.campagne_resultats WHERE origine = 'commande:o2'`)).n), 1);
});

test('Règles : prix minimum, part du revendeur, jeton de visite, empreinte réseau', () => {
  const r = require('../src/lib/reseau/resultats.ts');
  assert.equal(r.prixResultat('visite_qualifiee', 20), null, 'sous le minimum de 25 F');
  assert.equal(r.prixResultat('visite_qualifiee', 52), 50);
  assert.equal(r.prixResultat('demande_qualifiee', 490), null);
  assert.equal(r.prixResultat('demande_qualifiee', 1000), 1000);
  assert.equal(r.partRevendeur(50), 40);
  assert.equal(r.partRevendeur(1000), 800);

  const t0 = Date.now();
  const jeton = r.signerJeton({ produit: 'p1', code: 'SG-AB12', visiteur: 'v1', t: t0 }, 'secret');
  assert.equal(r.lireJeton(jeton, 'secret', 'v1', t0 + 5_000).raison, 'trop_tot');
  assert.equal(r.lireJeton(jeton, 'secret', 'v1', t0 + 21_000).ok, true);
  assert.equal(r.lireJeton(jeton, 'secret', 'v2', t0 + 21_000).raison, 'invalide', 'autre appareil');
  assert.equal(r.lireJeton(jeton, 'autre', 'v1', t0 + 21_000).raison, 'invalide', 'signature');
  assert.equal(r.lireJeton(jeton.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 'secret', 'v1', t0 + 21_000).ok, false);
  assert.equal(r.lireJeton(jeton, 'secret', 'v1', t0 + 3 * 3600_000).raison, 'expire');

  assert.equal(r.empreinteReseau('41.73.10.5', 's'), r.empreinteReseau('41.73.10.200', 's'), 'même /24');
  assert.notEqual(r.empreinteReseau('41.73.10.5', 's'), r.empreinteReseau('41.73.11.5', 's'));
  assert.equal(r.empreinteReseau('', 's'), null);

  assert.equal(r.contestable('retenu', new Date(Date.now() - 3600_000).toISOString()), true);
  assert.equal(r.contestable('retenu', new Date(Date.now() - 49 * 3600_000).toISOString()), false);
  assert.equal(r.contestable('annule', new Date().toISOString()), false);

  const { normaliserReglagesReseau } = require('../src/lib/reseau/reglages.ts');
  assert.equal(normaliserReglagesReseau({}).remunerationResultat, false, 'désactivé par défaut');
});
