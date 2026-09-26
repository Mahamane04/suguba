// Compte client — C1 (2026-09-26) : la commande suit le compte de l'ACHETEUR,
// une ancienne commande ne se rattache qu'avec la clé de son reçu, et le
// propriétaire du compte ouvre ses reçus sur un autre téléphone.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const compte = require('../src/lib/compte-client.ts');
const { hasOrderReceiptAccess } = require('../src/lib/order-access.ts');

const h = (cle) => createHash('sha256').update(cle.toLowerCase()).digest('hex');

// ── Base simulée minimale (filtres eq / is / in, update, insert) ────────────
function base(tables) {
  return {
    from(nom) {
      tables[nom] ||= [];
      let lignes = tables[nom];
      let maj = null;
      const q = {
        select() { return q; },
        eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
        is(c, v) { lignes = lignes.filter((l) => (l[c] ?? null) === v); return q; },
        in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
        order() { return q; },
        limit() { return q; },
        update(v) { maj = v; return q; },
        insert: async (ligne) => {
          if (nom === 'acces_cles' && tables[nom].some((l) => l.key_hash === ligne.key_hash)) return { error: { code: '23505' } };
          tables[nom].push({ ...ligne }); return { error: null };
        },
        maybeSingle: async () => { if (maj) lignes.forEach((l) => Object.assign(l, maj)); return { data: lignes[0] ? { ...lignes[0] } : null, error: null }; },
        then(ok, ko) { if (maj) lignes.forEach((l) => Object.assign(l, maj)); return Promise.resolve({ data: lignes.map((l) => ({ ...l })), error: null }).then(ok, ko); },
      };
      return q;
    },
  };
}

test('la commande suit l’acheteur, jamais l’admin ni le revendeur qui saisit la vente', async () => {
  assert.equal(compte.estAcheteur({ uid: 'c1', role: 'customer' }, null), true);
  assert.equal(compte.estAcheteur({ uid: 'r1', role: 'reseller' }, 'r1'), false, 'revendeur qui vend à son client');
  assert.equal(compte.estAcheteur({ uid: 'r1', role: 'reseller' }, 'r2'), true, 'revendeur qui achète pour lui chez un autre');
  assert.equal(compte.estAcheteur({ uid: 'a1', role: 'admin' }, null), false);
  assert.equal(compte.estAcheteur({ uid: 'd1', role: 'driver' }, null), false);
  assert.equal(compte.estAcheteur(null, null), false);

  const t = { orders: [{ id: 'o1', order_number: 'SG-1', customer_profile_id: null }, { id: 'o2', order_number: 'SG-2', customer_profile_id: 'autre' }] };
  await compte.rattacherCommandes(base(t), { uid: 'c1', role: 'customer' }, [{ id: 'o1' }, { id: 'o2' }]);
  assert.equal(t.orders[0].customer_profile_id, 'c1');
  assert.equal(t.orders[1].customer_profile_id, 'autre', 'jamais déplacée d’un compte à un autre');
});

test('ancienne commande : rattachée seulement avec la clé de son reçu', async () => {
  const cle = randomUUID();
  const t = {
    orders: [{ id: 'o1', order_number: 'SG-1', customer_profile_id: null }, { id: 'o2', order_number: 'SG-2', customer_profile_id: null }],
    order_creation_requests: [{ key_hash: h(cle), receipt: { order_number: 'SG-1' } }],
    cart_creation_requests: [], acces_cles: [],
  };
  const r = await compte.rattacherAnciens(base(t), 'c1', { commandes: [{ numero: 'SG-1', cle }, { numero: 'SG-2', cle }, { numero: 'SG-2', cle: randomUUID() }] });
  assert.equal(r.ajoutes, 1);
  assert.equal(t.orders[0].customer_profile_id, 'c1');
  assert.equal(t.orders[1].customer_profile_id, null, 'mauvaise clé : pas de rattachement');
});

test('autre téléphone : le propriétaire reçoit une nouvelle clé qui ouvre SON reçu, et seulement le sien', async () => {
  const t = {
    orders: [{ id: 'o1', order_number: 'SG-1', customer_profile_id: 'c1' }, { id: 'o2', order_number: 'SG-2', customer_profile_id: 'c2' }],
    order_creation_requests: [], cart_creation_requests: [], acces_cles: [],
  };
  const { cle } = await compte.delivrerCle(base(t), 'c1', 'commande', 'SG-1');
  assert.equal(t.acces_cles.length, 1);
  assert.notEqual(t.acces_cles[0].key_hash, cle, 'seul le hash est gardé');
  assert.equal(await hasOrderReceiptAccess(base(t), 'SG-1', cle), true);
  assert.equal(await hasOrderReceiptAccess(base(t), 'SG-2', cle), false, 'la clé n’ouvre que ce reçu');
  await assert.rejects(compte.delivrerCle(base(t), 'c1', 'commande', 'SG-2'), /pas dans votre compte/);
  await assert.rejects(compte.delivrerCle(base(t), 'c1', 'autre', 'SG-1'), /invalide/);
});

test('SQL : colonnes du compte et table des clés, rejouable', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['A-EXECUTER-2026-09-26-devis.sql', 'A-EXECUTER-2026-09-26-compte-client.sql', 'A-EXECUTER-2026-09-26-compte-client.sql']) {
    try { await db.exec(sql(f)); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  const cols = (await db.query(`SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'customer_profile_id'`)).rows.map((r) => r.table_name).sort();
  assert.deepEqual(cols, ['orders', 'quote_requests']);
  await db.exec(`INSERT INTO public.acces_cles (key_hash, type, ref, profile_id) VALUES ('h1', 'commande', 'SG-1', 'c1')`);
  await assert.rejects(db.exec(`INSERT INTO public.acces_cles (key_hash, type, ref, profile_id) VALUES ('h1', 'devis', 'DV-1', 'c1')`));
  await assert.rejects(db.exec(`INSERT INTO public.acces_cles (key_hash, type, ref, profile_id) VALUES ('h2', 'autre', 'X', 'c1')`));
});
