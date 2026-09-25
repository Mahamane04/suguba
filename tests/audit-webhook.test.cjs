// Vraie vérification HMAC, aucun appel à un prestataire ou à une base distante.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { NextRequest } = require('next/server');
process.env.SASPAY_WEBHOOK_SECRET = 'fictitious-local-webhook-secret';
global.fetch = async () => { throw Error('External network forbidden'); };
let verification, fault, calls;
const realProvider = require('../src/lib/saspay.ts');
require.cache[require.resolve('../src/lib/saspay.ts')].exports = {
  ...realProvider,
  verifierPayin: async () => { calls.push('verify'); return verification; },
};
const db = {
  from(table) {
    const q = { select() { return q; }, eq() { return q; }, async maybeSingle() {
      return { error: null, data: table === 'payment_attempts' ? { order_number: 'SG-FICTIF' }
        : table === 'orders' ? { order_number: 'SG-FICTIF', status: 'confirmed', payment_collected: false } : null };
    } }; return q;
  },
  async rpc(name, args) { calls.push({ name, args }); return { data: {}, error: fault ? { code: 'LOCAL_FAILURE' } : null }; },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };
const { POST } = require('../src/app/api/webhooks/saspay/route.ts');
function request({ age = 0, valid = true } = {}) {
  const body = JSON.stringify({ event: 'transaction.success', data: { id: 'fictional-transaction' } });
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = createHmac('sha256', process.env.SASPAY_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  return new NextRequest('http://localhost/api/webhooks/saspay', { method: 'POST', body,
    headers: { 'x-webhook-signature': valid ? signature : 'invalid', 'x-webhook-timestamp': timestamp } });
}
function reset() { calls = []; fault = false; verification = { ok: true, statut: 'SUCCESS' }; }
test('TEST-AUD-WEBHOOK : signatures invalide et périmée refusées sans mouvement', async () => {
  reset(); assert.equal((await POST(request({ valid: false }))).status, 403);
  assert.equal((await POST(request({ age: 600 }))).status, 403); assert.deepEqual(calls, []);
});
test('TEST-AUD-WEBHOOK : événement signé ne remplace pas la vérification prestataire', async () => {
  reset(); verification = { ok: true, statut: 'PENDING' };
  assert.equal((await POST(request())).status, 200); assert.deepEqual(calls, ['verify']);
  verification = { ok: false }; assert.equal((await POST(request())).status, 503);
  assert.equal(calls.filter(c => typeof c === 'object').length, 0);
});
test('TEST-AUD-WEBHOOK : paiement confirmé rapproché atomiquement, panne réessayable', async () => {
  reset(); assert.equal((await POST(request())).status, 200);
  assert.deepEqual(calls[1], { name: 'apply_verified_payment', args: {
    p_order_number: 'SG-FICTIF', p_transaction: 'fictional-transaction', p_status: 'SUCCESS',
  } });
  fault = true; assert.equal((await POST(request())).status, 503);
});
