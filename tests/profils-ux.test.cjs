require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { pourcentageVerifie, VERIFICATIONS } = require('../src/lib/reseau/badges.ts');
test('TEST-UX-PROFILS-VERIFICATION : un revendeur peut terminer sa checklist sans entreprise', () => {
  const etapes = VERIFICATIONS.filter(v => v.valeur !== 'business');
  const etats = Object.fromEntries(etapes.map(v => [v.valeur, 'approved']));
  assert.equal(pourcentageVerifie(etats, etapes), 100);
  assert.equal(pourcentageVerifie(etats), 95);
  assert.equal(pourcentageVerifie({ identity: 'pending', selfie: 'pending' }, etapes), 0);
});
let session, order, fault, inserts, filters;
require.cache[require.resolve('../src/lib/reseau/route-session.ts')] = { exports: { sessionAvecRole: async () => session } };
const db = { from(table) {
  const q = { select() { return q; }, eq(k,v) { filters.push([table,k,v]); return q; }, like() { return q; }, async limit() { return { data: [], error: null }; }, async maybeSingle() { return { data: order, error: null }; }, async insert(row) { inserts.push(row); return { error: fault ? {} : null }; } }; return q;
} };
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };
const { POST } = require('../src/app/api/driver/incident/route.ts');
const request = (extra = {}) => new NextRequest('http://localhost/api/driver/incident', { method: 'POST', body: JSON.stringify({ orderId: 'fictif', motif: 'Client absent', ...extra }) });
function reset() { session = { uid: 'livreur-fictif', role: 'driver' }; order = { id: 'fictif', status: 'in_transit', order_number: 'SG-FICTIF' }; fault = false; inserts = []; filters = []; }
test('TEST-UX-PROFILS-INCIDENT : session et attribution requises, aucun mouvement financier', async () => {
  reset(); session = null; assert.equal((await POST(request())).status, 401); assert.equal(inserts.length, 0);
  reset(); order = null; assert.equal((await POST(request())).status, 403); assert.equal(inserts.length, 0);
  assert.ok(filters.some(f => f[0] === 'orders' && f[1] === 'assigned_driver_id' && f[2] === 'livreur-fictif'));
  reset(); order.status = 'delivered'; assert.equal((await POST(request())).status, 403); assert.equal(inserts.length, 0);
});
test('TEST-UX-PROFILS-INCIDENT : succès uniquement après écriture SAV, erreur réessayable', async () => {
  reset(); assert.equal((await POST(request({ amount: 999999 }))).status, 200);
  assert.equal(inserts.length, 1); assert.equal(inserts[0].status, 'open'); assert.equal(inserts[0].order_id, 'fictif'); assert.equal(inserts[0].amount, undefined);
  assert.match(inserts[0].issue_description, /Incident de course/);
  reset(); fault = true; assert.equal((await POST(request())).status, 503);
});
