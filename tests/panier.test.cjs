require('../scripts/test-typescript.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
const { creerPanier } = require('../src/lib/cart-create.ts');
const { normaliserPanier } = require('../src/lib/cart-input.ts');
const { calculerCommande, REGLAGES_PAR_DEFAUT } = require('../src/lib/pricing.ts');

/**
 * Panier multi-articles contre un VRAI PostgreSQL (PGlite, en mémoire) avec
 * les migrations du dépôt : seule la couche de transport Supabase est simulée.
 */

const db = new PGlite({ extensions: { uuid_ossp } });
const sql = (file) => readFileSync(new URL('../supabase/' + file, 'file://' + __filename), 'utf8');

const adapter = {
  from(table) {
    let columns, field, value;
    return {
      select(names) { columns = names; return this; },
      eq(name, v) { field = name; value = v; return this; },
      // Lecture groupée des dépôts fournisseurs (src/lib/depot-fournisseur.ts,
      // 2026-09-24) : `await admin.from(t).select('*').in(col, ids)`.
      in(name, valeurs) {
        const requete = async () => {
          try {
            const { rows } = await db.query(`SELECT ${columns} FROM public.${table} WHERE ${name} = ANY($1)`, [valeurs]);
            return { data: rows, error: null };
          } catch (error) { return { data: null, error }; }
        };
        return { then: (ok, ko) => requete().then(ok, ko) };
      },
      async maybeSingle() {
        try {
          const { rows } = await db.query(`SELECT ${columns} FROM public.${table} WHERE ${field} = $1`, [value]);
          return { data: rows[0] || null, error: null };
        } catch (error) { return { data: null, error }; }
      },
    };
  },
  async rpc(name, args) {
    assert.equal(name, 'create_cart_with_commissions');
    try {
      const { rows } = await db.query(
        'SELECT public.create_cart_with_commissions($1, $2, $3, $4::jsonb) AS result',
        [args.p_key_hash, args.p_fingerprint, args.p_cart_id, JSON.stringify(args.p_items)]);
      return { data: rows[0].result, error: null };
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  },
};

const client = {
  customerName: '[TEST] Client', customerPhone: '+223 70 12 34 56',
  city: 'Bamako', neighborhood: 'Djélibougou', landmark: '[TEST] Pharmacie',
};
const compter = async () => (await db.query(`SELECT
  (SELECT count(*)::int FROM orders) AS orders,
  (SELECT count(*)::int FROM commissions) AS commissions`)).rows[0];

before(async () => {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(sql('schema.sql').split('-- 7. ACTIVATION WEBSOCKETS')[0]);
  for (const f of ['migration-suppliers.sql', 'migration-tarification.sql', 'migration-part-revendeur.sql',
    'migration-commission-safety-window.sql', 'migration-order-creation.sql', 'migration-panier.sql']) {
    await db.exec(sql(f));
  }
  const { rows: obligatoires } = await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_name = 'suppliers' AND is_nullable = 'NO' AND column_default IS NULL`);
  console.log('# suppliers obligatoires :', obligatoires.map((r) => r.column_name).join(', '));
});
after(async () => { await db.close(); });

async function semer() {
  await db.query(`INSERT INTO profiles (id, full_name, role, status) VALUES
    ('f1', '[TEST] Fournisseur 1', 'supplier', 'active'), ('f2', '[TEST] Fournisseur 2', 'supplier', 'active'),
    ('rv', '[TEST] Revendeur', 'reseller', 'active') ON CONFLICT DO NOTHING`);
  await db.query(`UPDATE profiles SET reseller_code = 'TESTREV' WHERE id = 'rv'`);
  await db.query(`INSERT INTO products (id, name, slug, category, supplier_price, public_price, commission_proposee, status, supplier_id) VALUES
    ('pa', '[TEST] A', 'test-a', 't', 20000, 40000, 3500, 'approved', 'f1'),
    ('pb', '[TEST] B', 'test-b', 't', 5000, 10000, 1000, 'approved', 'f1'),
    ('pc', '[TEST] C', 'test-c', 't', 8000, 15000, 1500, 'approved', 'f2') ON CONFLICT DO NOTHING`);
}

test('normalisation : lignes fusionnées, panier vide refusé, trop de lignes refusé', () => {
  const p = normaliserPanier({ ...client, lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pa', quantity: 2 }] });
  assert.deepEqual(p.lignes, [{ productId: 'pa', quantity: 3 }]);
  assert.throws(() => normaliserPanier({ ...client, lignes: [] }), /vide/);
  assert.throws(() => normaliserPanier({ ...client, lignes: Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, quantity: 1 })) }), /au plus/);
  assert.throws(() => normaliserPanier({ ...client, lignes: [{ productId: 'pa', quantity: 0 }] }), /Quantité/);
  assert.throws(() => normaliserPanier({ ...client, customerPhone: 'abc', lignes: [{ productId: 'pa', quantity: 1 }] }), /téléphone/);
});

test('un panier de 3 articles chez 2 fournisseurs : 3 commandes, 2 livraisons, 2 codes', async () => {
  await semer();
  const avant = await compter();
  const r = await creerPanier(adapter, {
    ...client, resellerCode: 'testrev',
    lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pb', quantity: 2 }, { productId: 'pc', quantity: 1 }],
  }, randomUUID());

  assert.equal(r.created, true);
  assert.equal(r.orders.length, 3);
  const apres = await compter();
  assert.equal(apres.orders, avant.orders + 3);
  assert.equal(apres.commissions, avant.commissions + 3, 'chaque article garde sa commission');

  const [a, b, c] = r.orders;
  assert.ok(a.deliveryFee > 0, 'premier article du fournisseur 1 : porte la livraison');
  assert.equal(b.deliveryFee, 0, 'même fournisseur : pas de seconde livraison');
  assert.ok(c.deliveryFee > 0, 'fournisseur 2 : sa propre livraison');
  assert.equal(a.deliveryOtp, b.deliveryOtp, 'un seul code pour le lot du fournisseur 1');
  assert.notEqual(a.deliveryOtp, c.deliveryOtp);

  const devisB = calculerCommande({ prixFournisseur: 5000, prixVente: 10000, commissionProposee: 1000 },
    { quantite: 2, ville: 'Bamako', revendeurAttribue: true }, REGLAGES_PAR_DEFAUT);
  assert.equal(b.totalAmount, devisB.montantArticles);
  assert.equal(r.total, a.totalAmount + b.totalAmount + c.totalAmount);

  const { rows } = await db.query('SELECT DISTINCT cart_id FROM orders WHERE id = ANY($1)', [r.orders.map((o) => o.id)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cart_id, r.cartId);
});

test('un article devenu indisponible : AUCUNE commande du panier n’est créée', async () => {
  await semer();
  const avant = await compter();
  await db.exec("UPDATE products SET status = 'archived' WHERE id = 'pc'");
  try {
    await assert.rejects(
      creerPanier(adapter, { ...client, lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pc', quantity: 1 }] }, randomUUID()),
      (e) => e.status === 400 && /C/.test(e.message),
    );
    assert.deepEqual(await compter(), avant);
  } finally { await db.exec("UPDATE products SET status = 'approved' WHERE id = 'pc'"); }
});

test('échec au milieu de la transaction : le premier article est annulé aussi', async () => {
  await semer();
  const avant = await compter();
  await db.exec(`CREATE FUNCTION test_refus() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.amount = 2000 THEN RAISE EXCEPTION 'TEST'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER test_refus BEFORE INSERT ON commissions FOR EACH ROW EXECUTE FUNCTION test_refus();`);
  try {
    await assert.rejects(creerPanier(adapter, {
      ...client, resellerCode: 'TESTREV',
      lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pb', quantity: 2 }],
    }, randomUUID()), { status: 503 });
    assert.deepEqual(await compter(), avant, 'aucune commande orpheline');
  } finally { await db.exec('DROP TRIGGER test_refus ON commissions; DROP FUNCTION test_refus();'); }
});

test('réponse perdue : renvoyer le même panier restitue les mêmes commandes, sans doublon', async () => {
  await semer();
  const cle = randomUUID();
  const panier = { ...client, lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pc', quantity: 1 }] };
  const premier = await creerPanier(adapter, panier, cle);
  const avant = await compter();
  const second = await creerPanier(adapter, panier, cle);
  assert.equal(second.created, false);
  assert.deepEqual(second.orders.map((o) => o.id), premier.orders.map((o) => o.id));
  assert.deepEqual(await compter(), avant);
  await assert.rejects(creerPanier(adapter, { ...panier, lignes: [{ productId: 'pa', quantity: 2 }] }, cle), { status: 409 });
});

test('le code promo ne s’applique qu’une fois par panier', async () => {
  await semer();
  await db.query(`INSERT INTO platform_settings (id, valeurs) VALUES (1, $1::jsonb)
    ON CONFLICT (id) DO UPDATE SET valeurs = EXCLUDED.valeurs`,
    [JSON.stringify({ codesPromo: [{ code: 'TEST500', remise: 500, actif: true }] })]);
  try {
    const r = await creerPanier(adapter, {
      ...client, promoCode: 'TEST500',
      lignes: [{ productId: 'pa', quantity: 1 }, { productId: 'pb', quantity: 1 }, { productId: 'pc', quantity: 1 }],
    }, randomUUID());
    const remises = r.orders.map((o) => o.discountAmount);
    assert.equal(remises.filter((x) => x > 0).length, 1, 'une seule ligne porte la remise');
    assert.equal(remises[0], 500);
  } finally { await db.exec('DELETE FROM platform_settings WHERE id = 1'); }
});
