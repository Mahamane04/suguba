require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { identiteFournisseur } = require('../src/lib/identite-fournisseur.ts');
test('TEST-UX-PROFILS-IDENTITE : anciennes adresses utilisent l’identité principale sans ressusciter un logo supprimé', () => {
  const ancien = { company_name: 'Ancien', logo_url: 'ancien.png', shop_description: 'Ancienne présentation', contact_phone: 'privé', warehouse_address: 'privé' };
  assert.deepEqual(identiteFournisseur(ancien, { name: 'Nouveau', logo_url: null, description: null }), { nom: 'Nouveau', logo: null, description: null, couverture: null });
  const fallback = identiteFournisseur(ancien, null);
  assert.equal(fallback.nom, 'Ancien'); assert.equal(fallback.logo, 'ancien.png');
  assert.equal('contact_phone' in fallback, false); assert.equal('warehouse_address' in fallback, false);
});
let session = { uid: 'revendeur-fictif' }, row, fault, writes, filters;
require.cache[require.resolve('../src/lib/reseau/route-session.ts')] = { exports: { sessionAvecRole: async () => session } };
const db = { from() { const q = {
  update(v) { writes.push(v); return q; }, insert(v) { writes.push(v); return q; },
  eq(k,v) { filters.push([k,v]); return q; }, select() { return q; },
  async maybeSingle() { return { data: row, error: fault }; },
}; return q; } };
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };
const { POST } = require('../src/app/api/reseller/calendrier/route.ts');
const req = (body) => new NextRequest('http://localhost/api/reseller/calendrier', { method: 'POST', body: JSON.stringify(body) });
function reset() { row = { id: 'rappel-fictif' }; fault = null; writes = []; filters = []; session = { uid: 'revendeur-fictif' }; }
test('TEST-UX-PROFILS-CALENDRIER : pas de faux succès pour une publication absente ou appartenant à autrui', async () => {
  reset(); row = null; assert.equal((await POST(req({ id: 'inaccessible', statut: 'published' }))).status, 404);
  assert.ok(filters.some(([k,v]) => k === 'reseller_id' && v === session.uid));
  reset(); fault = { message: 'écriture refusée' }; assert.equal((await POST(req({ id: row.id, statut: 'published' }))).status, 400);
  reset(); assert.equal((await POST(req({ id: row.id, statut: 'published' }))).status, 200);
  reset(); session = null; assert.equal((await POST(req({ id: 'rappel', statut: 'published' }))).status, 401); assert.equal(writes.length, 0);
});
test('TEST-UX-PROFILS-CALENDRIER : dates impossibles refusées, création confirmée par la base', async () => {
  for (const date of ['2026-02-30', '2026-13-01', 'invalide']) { reset(); assert.equal((await POST(req({ titre: 'Publication', date }))).status, 400); assert.equal(writes.length, 0); }
  reset(); assert.equal((await POST(req({ titre: 'Publication', date: '2028-02-29' }))).status, 200);
  reset(); row = null; assert.equal((await POST(req({ titre: 'Publication', date: '2026-09-30' }))).status, 503);
});
