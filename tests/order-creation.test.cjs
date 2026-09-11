require('../scripts/test-typescript.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
const { creerCommande } = require('../src/lib/order-create.ts');
const { soumettreCommande, OrderCheckout, OrderSubmissionError } = require('../src/lib/order-submit.ts');
const { normaliserCommande } = require('../src/lib/order-input.ts');
const { calculerCommande, REGLAGES_PAR_DEFAUT } = require('../src/lib/pricing.ts');

const db = new PGlite({ extensions: { uuid_ossp } });
const sql = (file) => readFileSync(new URL('../supabase/' + file, 'file://' + __filename), 'utf8');
const input = {
  productId: 'test-product', quantity: 2, customerName: '[TEST] Client',
  customerPhone: '+223 70 12 34 56', city: 'Bamako', neighborhood: 'ACI',
  landmark: '[TEST] Pharmacie', resellerCode: 'TESTREV',
};
let failTable = null;
let failRpc = false;
const adapter = {
  from(table) {
    assert.match(table, /^[a-z_]+$/);
    let columns, field, value;
    return {
      select(names) { columns = names; assert.match(columns, /^[a-z_, ]+$/); return this; },
      eq(name, v) { field = name; value = v; assert.match(field, /^[a-z_]+$/); return this; },
      async maybeSingle() {
        if (failTable === table) return { data: null, error: { code: 'TEST_FAILURE' } };
        try {
          const { rows } = await db.query(`SELECT ${columns} FROM public.${table} WHERE ${field} = $1`, [value]);
          return { data: rows[0] || null, error: null };
        } catch (error) { return { data: null, error }; }
      },
    };
  },
  async rpc(name, args) {
    assert.equal(name, 'create_order_with_commission');
    if (failRpc) return { data: null, error: { code: 'TEST_FAILURE' } };
    try {
      const { rows } = await db.query(
        'SELECT public.create_order_with_commission($1, $2, $3::jsonb, $4::jsonb) AS result',
        [args.p_key_hash, args.p_fingerprint, JSON.stringify(args.p_order), JSON.stringify(args.p_product)]);
      return { data: rows[0].result, error: null };
    } catch (error) { return { data: null, error }; }
  },
};
const counts = async () => (await db.query(`SELECT
  (SELECT count(*)::int FROM orders) AS orders,
  (SELECT count(*)::int FROM commissions) AS commissions,
  (SELECT count(*)::int FROM order_creation_requests) AS requests`)).rows[0];
let actualAdmin = adapter;
// Seul le transport Supabase est remplacé, par un PostgreSQL local réel.
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = {
  exports: { getSupabaseAdmin: () => actualAdmin },
};
require.cache[require.resolve('../src/lib/cloud-sync.ts')] = { exports: { cloudSyncService: {} } };
const { POST } = require('../src/app/api/orders/create/route.ts');
const { POST: quote } = require('../src/app/api/orders/quote/route.ts');
const { POST: updateOrder } = require('../src/app/api/orders/sync/route.ts');
const { sugubaStore } = require('../src/lib/store.ts');
const { NextRequest } = require('next/server');
const request = (body, key = randomUUID()) => new NextRequest('http://localhost/api/orders/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
let originalFetch;
before(async () => {
  // Exécute le schéma et les migrations du dépôt, sans copier les tables.
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(sql('schema.sql').split('-- 7. ACTIVATION WEBSOCKETS')[0]);
  for (const file of ['migration-tarification.sql', 'migration-part-revendeur.sql', 'migration-commission-safety-window.sql', 'migration-order-creation.sql']) {
    await db.exec(sql(file));
  }
  await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;');
  await db.query(`INSERT INTO products (id, name, slug, category, supplier_price, public_price, commission_proposee, status)
    VALUES ('test-product', '[TEST] Article', 'test-article', 'test', 20000, 40000, 3500, 'approved')`);
  await db.query(`INSERT INTO profiles(id, full_name, reseller_code, status) VALUES ('test-reseller', '[TEST] Revendeur', 'TESTREV', 'active')`);
  originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Réseau externe interdit dans ces tests'); };
});
after(async () => { global.fetch = originalFetch; await db.close(); });

test('TEST-013 : commande et commission confirmées avec le vrai moteur de prix', async () => {
  const key = randomUUID();
  const { order, created } = await creerCommande(adapter, { ...input, resellerCode: ' testrev ',
    totalAmount: 1, resellerCommission: 999999, status: 'delivered', deliveryOtp: '0000',
    id: 'forged', createdAt: '2000-01-01', resellerId: 'forged' }, key);
  assert.equal(created, true);
  const expected = calculerCommande({ prixFournisseur: 20000, prixVente: 40000, commissionProposee: 3500 },
    { quantite: 2, ville: 'Bamako', revendeurAttribue: true }, REGLAGES_PAR_DEFAUT);
  assert.equal(order.totalAmount, expected.total);
  assert.equal(order.resellerCommission, expected.commissionTotale);
  assert.equal(order.resellerId, 'test-reseller');
  assert.equal(order.customerPhone, '+22370123456');
  assert.equal(order.status, 'pending_call');
  assert.equal(order.paymentCollected, false);
  assert.notEqual(order.id, 'forged');
  assert.match(order.deliveryOtp, /^[1-9]\d{3}$/);
  assert.ok(!JSON.stringify(order).includes('pricing_snapshot'));
  assert.ok(!JSON.stringify(order).includes('supplier_price'));
  const { rows } = await db.query('SELECT * FROM commissions WHERE order_id = $1', [order.id]);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].amount), order.resellerCommission);
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].unlock_at, null);
});

test('TEST-014 : deux envois concurrents retournent le même reçu', async () => {
  const initial = await counts(), key = randomUUID();
  const [a, b] = await Promise.all([creerCommande(adapter, input, key), creerCommande(adapter, input, key)]);
  assert.deepEqual(a.order, b.order);
  assert.equal(Number(a.created) + Number(b.created), 1);
  assert.deepEqual(await counts(), { orders: initial.orders + 1, commissions: initial.commissions + 1, requests: initial.requests + 1 });
});

test('TEST-014 : réponse perdue, puis prix changé : le reçu initial est retrouvé', async () => {
  const key = randomUUID(), original = await creerCommande(adapter, input, key);
  await db.exec("UPDATE products SET public_price = 0, status = 'archived' WHERE id = 'test-product'");
  try {
    const retry = await creerCommande(adapter, input, key);
    assert.equal(retry.created, false);
    assert.deepEqual(retry.order, original.order);
    await assert.rejects(creerCommande(adapter, { ...input, quantity: 3 }, key), { status: 409 });
  } finally { await db.exec("UPDATE products SET public_price = 40000, status = 'approved' WHERE id = 'test-product'"); }
});

test('TEST-015 : échec de commission = aucune commande orpheline, puis reprise possible', async () => {
  const initial = await counts(), key = randomUUID();
  await db.exec(`CREATE FUNCTION test_reject_commission() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'TEST commission failure'; END; $$;
    CREATE TRIGGER test_reject BEFORE INSERT ON commissions FOR EACH ROW EXECUTE FUNCTION test_reject_commission();`);
  try {
    await assert.rejects(creerCommande(adapter, input, key), { status: 503 });
    assert.deepEqual(await counts(), initial);
  } finally { await db.exec('DROP TRIGGER test_reject ON commissions; DROP FUNCTION test_reject_commission();'); }
  const result = await creerCommande(adapter, input, key);
  assert.equal(result.created, true);
  assert.deepEqual(await counts(), { orders: initial.orders + 1, commissions: initial.commissions + 1, requests: initial.requests + 1 });
});

test('TEST-015 : vente directe sans commission et reprise après panne de base', async () => {
  const initial = await counts();
  const { order } = await creerCommande(adapter, { ...input, resellerCode: undefined }, randomUUID());
  assert.equal(order.resellerCommission, 0);
  assert.equal(order.resellerId, undefined);
  assert.equal((await counts()).commissions, initial.commissions);
  await assert.rejects(creerCommande(null, input, randomUUID()), { status: 503 });
  for (const table of ['products', 'profiles', 'platform_settings', 'order_creation_requests']) {
    failTable = table;
    try { await assert.rejects(creerCommande(adapter, input, randomUUID()), { status: 503 }); }
    finally { failTable = null; }
  }
  failRpc = true;
  try { await assert.rejects(creerCommande(adapter, input, randomUUID()), { status: 503 }); }
  finally { failRpc = false; }
});

test('TEST-016 : validation serveur des champs, quantités et codes revendeur', async () => {
  for (const quantity of [0, -1, 1.5, 51, '2', null]) {
    await assert.rejects(creerCommande(adapter, { ...input, quantity }, randomUUID()), { status: 400 });
  }
  for (const fields of [{ customerName: ' ' }, { customerPhone: 'abcd' }, { landmark: '' }, { resellerCode: 'INCONNU' }]) {
    await assert.rejects(creerCommande(adapter, { ...input, ...fields }, randomUUID()), { status: 400 });
  }
  await assert.rejects(creerCommande(adapter, input, 'id-public'), { status: 400 });
  await db.exec("UPDATE products SET public_price = 0 WHERE id = 'test-product'");
  try { await assert.rejects(creerCommande(adapter, input, randomUUID()), { status: 400 }); }
  finally { await db.exec("UPDATE products SET public_price = 40000 WHERE id = 'test-product'"); }
});

test('TEST-017 : droits PostgreSQL : création RPC et reçus interdits au public', async () => {
  const signature = 'public.create_order_with_commission(text,text,jsonb,jsonb)';
  for (const role of ['anon', 'authenticated']) {
    const rights = await db.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`, [role, signature]);
    assert.equal(rights.rows[0].allowed, false);
    await db.exec(`SET ROLE ${role}`);
    try { await assert.rejects(db.query('SELECT * FROM public.order_creation_requests'), { code: '42501' }); }
    finally { await db.exec('RESET ROLE'); }
  }
  // Simule les privilèges de table par défaut de Supabase : RLS doit bloquer.
  await db.exec('GRANT INSERT ON public.orders TO anon; SET ROLE anon;');
  try {
    await assert.rejects(db.query(`INSERT INTO orders(id, order_number, product_name, customer_name, customer_phone)
      VALUES ('forged', 'forged', 'x', 'x', '12345678')`), { code: '42501' });
  } finally { await db.exec('RESET ROLE'); }
  await db.exec('SET ROLE service_role');
  try { assert.equal((await creerCommande(adapter, input, randomUUID())).created, true); }
  finally { await db.exec('RESET ROLE'); }
});

test('TEST-017 : migration réexécutable et vérification du produit dans la transaction', async () => {
  await db.exec(sql('migration-order-creation.sql'));
  const { rows } = await db.query('SELECT receipt FROM order_creation_requests LIMIT 1');
  const row = { ...rows[0].receipt, id: randomUUID(), order_number: 'SG-TESTCHNG' };
  const initial = await counts();
  await assert.rejects(db.query('SELECT create_order_with_commission($1,$2,$3,$4)', [
    createHash('sha256').update(randomUUID()).digest('hex'), 'a'.repeat(64), JSON.stringify(row),
    JSON.stringify({ supplier_price: 1, public_price: 2, commission_proposee: 3 }),
  ]), { code: '40001' });
  assert.deepEqual(await counts(), initial);
});

test('TEST-018 : route HTTP, erreurs JSON, indisponibilité et reçu sans cache', async () => {
  const key = randomUUID();
  const first = await POST(request(input, key));
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const retry = await POST(request(input, key));
  assert.equal(retry.status, 200);
  assert.deepEqual((await first.json()).order, (await retry.json()).order);
  assert.equal((await POST(request('{'))).status, 400);
  actualAdmin = null;
  try { assert.equal((await POST(request(input))).status, 503); }
  finally { actualAdmin = adapter; }
  const legacy = await updateOrder(request({ order: { id: 'not-recorded', orderNumber: 'SG-LEGACY' } }));
  assert.equal(legacy.status, 401);
});

test('TEST-018 : navigateur : aucune commande avant réponse, erreur visible et reçu serveur conservé', async () => {
  const key = randomUUID(), initial = sugubaStore.getState().orders.length;
  let resolveFetch;
  global.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
  const pending = sugubaStore.createOrder(input, key);
  assert.equal(sugubaStore.getState().orders.length, initial);
  resolveFetch(Response.json({ error: 'Base indisponible' }, { status: 503 }));
  await assert.rejects(pending, /Base indisponible/);
  assert.equal(sugubaStore.getState().orders.length, initial);
  global.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), JSON.parse(JSON.stringify(normaliserCommande(input))));
    assert.equal(options.headers['Idempotency-Key'], key);
    return POST(request(JSON.parse(options.body), key));
  };
  const a = await sugubaStore.createOrder(input, key);
  const b = await sugubaStore.createOrder(input, key);
  assert.deepEqual(a, b);
  assert.equal(sugubaStore.getState().orders.length, initial + 1);
  assert.equal(sugubaStore.getState().orders[0].totalAmount, a.totalAmount);
});

test('TEST-018 : navigateur : réponse perdue récupérable avec la même clé', async () => {
  const attempt = { key: randomUUID(), input }, initial = await counts();
  global.fetch = async (_url, options) => {
    await POST(request(JSON.parse(options.body), options.headers['Idempotency-Key']));
    throw new Error('TEST réponse perdue');
  };
  await assert.rejects(soumettreCommande(attempt), { definitive: false });
  global.fetch = (_url, options) => POST(request(JSON.parse(options.body), options.headers['Idempotency-Key']));
  const order = await soumettreCommande(attempt);
  assert.ok(order.orderNumber);
  assert.deepEqual(await counts(), { orders: initial.orders + 1, commissions: initial.commissions + 1, requests: initial.requests + 1 });
});

test('TEST-018 : un HTTP 200 sans reçu valide ne vaut jamais confirmation', async () => {
  for (const body of [{ success: true, cloud: false }, { success: false }, {}]) {
    global.fetch = async () => Response.json(body);
    await assert.rejects(soumettreCommande({ key: randomUUID(), input }), { definitive: false });
  }
});

test('TEST-018 : refus intermédiaire du proxy : la clé de reprise doit être conservée', async () => {
  for (const status of [400, 403, 429]) {
    global.fetch = async () => new Response('Proxy indisponible', { status });
    await assert.rejects(soumettreCommande({ key: randomUUID(), input }), { definitive: false });
  }
  global.fetch = async () => Response.json({ error: 'Quantité invalide', definitive: true }, { status: 400 });
  await assert.rejects(soumettreCommande({ key: randomUUID(), input }), { definitive: true });
});

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('TEST-019 : double clic = une seule soumission du formulaire', async () => {
  let calls = 0, resolve;
  const storage = memoryStorage();
  const checkout = new OrderCheckout('form', storage, () => {
    calls++;
    return new Promise(done => { resolve = done; });
  });
  const a = checkout.submit(input), b = checkout.submit(input);
  assert.equal(a, b);
  assert.equal(calls, 1);
  resolve({ id: 'confirmed' });
  await a;
  assert.ok(storage.getItem('form'));
  checkout.reset();
  assert.equal(storage.getItem('form'), null);
});

test('TEST-019 : rechargement après coupure, reprise explicite des données initiales', async () => {
  const storage = memoryStorage();
  let originalKey;
  const first = new OrderCheckout('form', storage, async (_input, key) => {
    originalKey = key;
    throw new OrderSubmissionError('TEST connexion perdue', false);
  });
  await assert.rejects(first.submit(input));
  let calls = 0;
  const reloaded = new OrderCheckout('form', storage, async (data, key) => {
    calls++;
    assert.equal(key, originalKey);
    assert.deepEqual(data, normaliserCommande(input));
    return { id: 'same-order' };
  });
  assert.equal(reloaded.restore().key, originalKey);
  await assert.rejects(reloaded.submit({ ...input, customerName: 'Autre client' }), /Reprendre ma commande/);
  assert.equal(calls, 0);
  assert.equal((await reloaded.submit()).id, 'same-order');
  assert.equal(calls, 1);
});

test('TEST-019 : refus définitif, stockage corrompu ou bloqué', async () => {
  const storage = memoryStorage();
  storage.setItem('form', '{invalide');
  const controller = new OrderCheckout('form', storage, async () => { throw new OrderSubmissionError('Champ invalide', true); });
  assert.equal(controller.restore(), null);
  await assert.rejects(controller.submit(input));
  assert.equal(controller.restore(), null);
  const keys = [];
  const blocked = new OrderCheckout('blocked', {
    getItem() { throw Error('storage blocked'); }, setItem() { throw Error('storage blocked'); }, removeItem() { throw Error('storage blocked'); },
  }, async (_data, key) => { keys.push(key); throw new OrderSubmissionError('TEST réseau', false); });
  await assert.rejects(blocked.submit(input));
  await assert.rejects(blocked.submit());
  assert.equal(keys[0], keys[1]);
});

test('TEST-020 : la confirmation ne remplace jamais un reçu absent par une autre commande', async () => {
  require.cache[require.resolve('../src/components/common/Header.tsx')] = { exports: { __esModule: true, default: () => null } };
  const React = require('react');
  const { renderToPipeableStream } = require('react-dom/server');
  const { PassThrough } = require('node:stream');
  const Page = require('../src/app/order-success/[orderNumber]/page.tsx').default;
  assert.ok(sugubaStore.getState().orders.length > 0);
  const html = await new Promise((resolve, reject) => {
    const chunks = [], target = new PassThrough();
    target.on('data', chunk => chunks.push(chunk));
    target.on('end', () => resolve(Buffer.concat(chunks).toString()));
    const stream = renderToPipeableStream(React.createElement(Page, { params: Promise.resolve({ orderNumber: 'SG-INCONNU' }) }), {
      onAllReady() { stream.pipe(target); }, onError: reject,
    });
  });
  assert.match(html, /Retrouvez votre commande/);
  assert.doesNotMatch(html, /Merci pour votre commande/);
  assert.doesNotMatch(html, new RegExp(sugubaStore.getState().orders[0].orderNumber));
});

test('TEST-021 : devis et reçu identiques avec promo, ville et code revendeur en minuscules', async () => {
  const settings = { ...REGLAGES_PAR_DEFAUT, codesPromo: [{ code: 'TESTPROMO', remise: 5000, actif: true }] };
  await db.query('INSERT INTO platform_settings(id, valeurs) VALUES(1, $1)', [JSON.stringify(settings)]);
  try {
    const data = { ...input, city: 'Sikasso', resellerCode: ' testrev ', promoCode: 'testpromo' };
    const response = await quote(request(data));
    assert.equal(response.status, 200);
    const { devis } = await response.json();
    const { order } = await creerCommande(adapter, data, randomUUID());
    assert.equal(devis.total, order.totalAmount);
    assert.equal(devis.fraisLivraison, order.deliveryFee);
    assert.equal(devis.remise, order.discountAmount);
    assert.equal(devis.quantite, order.quantity);
    assert.equal(devis.commissionTotale, undefined);
    assert.equal(devis.margeSuguba, undefined);
  } finally { await db.exec('DELETE FROM platform_settings WHERE id = 1'); }
});

test('TEST-021 : le devis refuse les erreurs de données plutôt que des prix de repli', async () => {
  for (const fields of [{ quantity: 0 }, { quantity: 1.5 }, { resellerCode: 'INCONNU' }]) {
    assert.equal((await quote(request({ ...input, ...fields }))).status, 400);
  }
  for (const table of ['products', 'profiles', 'platform_settings']) {
    failTable = table;
    try { assert.equal((await quote(request(input))).status, 503); }
    finally { failTable = null; }
  }
});
