// Code de remise affiché dans l'app (2026-09-25) à la place du SMS : seul le
// détenteur de la clé du reçu le voit, et la transmission est enregistrée pour
// que verify_delivery_atomic accepte ensuite la livraison.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

let commande, rpcs, cleValide;
const admin = {
  from() {
    const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: commande ? { ...commande } : null, error: null }) };
    return q;
  },
  async rpc(nom, args) {
    rpcs.push(nom);
    if (nom === 'claim_order_sms') {
      if (commande.delivery_code_version < 1) Object.assign(commande, { delivery_otp: '7391', delivery_code_version: 1, delivery_code_sent_at: null });
      return { data: true, error: null };
    }
    if (nom === 'confirm_delivery_sms') {
      if (commande.delivery_code_version === 1 && commande.delivery_otp === args.p_code) { commande.delivery_code_sent_at = 'maintenant'; return { data: true, error: null }; }
      return { data: false, error: null };
    }
    return { data: null, error: { message: 'inconnu' } };
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => admin } };
require.cache[require.resolve('../src/lib/order-access.ts')] = { exports: { hasOrderReceiptAccess: async (_a, _n, cle) => cle === cleValide } };
const { POST } = require('../src/app/api/orders/code-livraison/route.ts');
const { NextRequest } = require('next/server');
const appel = (corps) => POST(new NextRequest('http://localhost/api/orders/code-livraison', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
}));
const reset = (surcharge = {}) => {
  cleValide = 'cle-du-recu';
  rpcs = [];
  commande = { status: 'confirmed', delivery_otp: '1111', delivery_code_version: 0, delivery_code_sent_at: null, ...surcharge };
};

test('sans la clé du reçu, le code n’est jamais renvoyé', async () => {
  reset();
  const r = await appel({ orderNumber: 'SG-TEST', accessKey: 'mauvaise' });
  assert.equal(r.status, 403);
  assert.ok(!JSON.stringify(await r.json()).includes('1111'));
  assert.deepEqual(rpcs, []);
});

test('avec la clé : code neuf (l’ancien d’avant l’audit est remplacé) et transmission enregistrée', async () => {
  reset();
  const r = await appel({ orderNumber: 'SG-TEST', accessKey: 'cle-du-recu' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { code: '7391' });
  assert.equal(commande.delivery_code_sent_at, 'maintenant');
  assert.deepEqual(rpcs, ['claim_order_sms', 'confirm_delivery_sms']);
});

test('déjà transmis : le même code est réaffiché, sans le régénérer', async () => {
  reset({ delivery_otp: '5555', delivery_code_version: 1, delivery_code_sent_at: 'hier' });
  const r = await appel({ orderNumber: 'SG-TEST', accessKey: 'cle-du-recu' });
  assert.deepEqual(await r.json(), { code: '5555' });
  assert.deepEqual(rpcs, []);
});

test('commande livrée ou annulée : plus de code', async () => {
  reset({ status: 'delivered' });
  assert.equal((await appel({ orderNumber: 'SG-TEST', accessKey: 'cle-du-recu' })).status, 409);
});
