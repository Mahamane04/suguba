// Caisse livreurs (2026-09-25) : espèces à remettre par le livreur, part
// gardée selon le réglage admin, et enregistrement des versements.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { calculerAVerser, remunerationRetenue, niveauRetard, estPayeEnEspeces } = require('../src/lib/caisse-livreur.ts');
const { completerReglages } = require('../src/lib/pricing.ts');

test('par défaut, le livreur garde sa rémunération', () => {
  const r = completerReglages({ remunerationLivreur: 1000 });
  assert.equal(r.livreurGardeRemuneration, true);
  assert.equal(remunerationRetenue(r), 1000);
  assert.equal(remunerationRetenue({ ...r, livreurGardeRemuneration: false }), 0);
});

test('à verser = espèces − rémunération gardée, jamais négatif', () => {
  assert.deepEqual(calculerAVerser([12500, 7500], 1000), { especes: 20000, garde: 2000, aVerser: 18000 });
  assert.deepEqual(calculerAVerser([12500, 7500], 0), { especes: 20000, garde: 0, aVerser: 20000 });
  assert.deepEqual(calculerAVerser([500], 1000), { especes: 500, garde: 500, aVerser: 0 });
});

test('seul Mobile Money est « déjà payé » (payment_collected ne compte pas)', () => {
  assert.equal(estPayeEnEspeces('mobile_money'), false);
  assert.equal(estPayeEnEspeces('cash_on_delivery'), true);
  assert.equal(estPayeEnEspeces(null), true);
});

test('alerte de retard : orange après le délai, rouge après le double', () => {
  const maintenant = Date.parse('2026-09-25T12:00:00Z');
  assert.equal(niveauRetard('2026-09-25T00:00:00Z', 24, maintenant), 'ok');
  assert.equal(niveauRetard('2026-09-24T06:00:00Z', 24, maintenant), 'retard');
  assert.equal(niveauRetard('2026-09-23T06:00:00Z', 24, maintenant), 'grave');
  assert.equal(niveauRetard(null, 24, maintenant), 'ok');
});

// ── Route admin : le montant retenu vient des réglages serveur ─────────────
let appels, reglages;
const admin = {
  from() {
    const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: { full_name: 'Caisse ACI' }, error: null }) };
    return q;
  },
  async rpc(nom, args) {
    appels.push({ nom, args });
    return { data: { success: true, id: 'v1', remittanceNumber: 'VS-TEST' }, error: null };
  },
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => admin } };
require.cache[require.resolve('../src/lib/active-session.ts')] = { exports: { verifyActiveSession: async () => ({ uid: 'admin-1', role: 'admin', status: 'active', phone: '+22370000000' }) } };
require.cache[require.resolve('../src/lib/reseau/permission-admin.ts')] = { exports: { refusSansPermissionAdmin: async () => null } };
require.cache[require.resolve('../src/lib/platform-settings.ts')] = { exports: { chargerReglages: async () => ({ reglages, confirme: true, majLe: null }) } };
const { POST } = require('../src/app/api/admin/caisse-livreurs/route.ts');
const { NextRequest } = require('next/server');
const poster = (corps) => POST(new NextRequest('http://localhost/api/admin/caisse-livreurs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
}));

test('le versement utilise la rémunération des réglages, pas une valeur envoyée', async () => {
  appels = [];
  reglages = completerReglages({ remunerationLivreur: 1500 });
  const r = await poster({ driverId: 'd1', orderIds: ['o1', 'o2'], montantRecu: 17000, remunerationParCourse: 99999 });
  assert.equal(r.status, 200);
  assert.equal(appels[0].nom, 'record_driver_remittance');
  assert.equal(appels[0].args.p_remuneration_par_course, 1500);
  assert.equal(appels[0].args.p_received_by, 'admin-1');
  assert.deepEqual(appels[0].args.p_order_ids, ['o1', 'o2']);
});

test('réglage « il verse tout » : rien n’est retenu', async () => {
  appels = [];
  reglages = completerReglages({ remunerationLivreur: 1500, livreurGardeRemuneration: false });
  await poster({ driverId: 'd1', orderIds: ['o1'], montantRecu: 10000 });
  assert.equal(appels[0].args.p_remuneration_par_course, 0);
});

test('montant reçu absent ou négatif : refusé sans appeler la base', async () => {
  appels = [];
  reglages = completerReglages({});
  assert.equal((await poster({ driverId: 'd1', orderIds: ['o1'], montantRecu: -5 })).status, 400);
  assert.equal((await poster({ driverId: 'd1', orderIds: ['o1'] })).status, 400);
  assert.equal(appels.length, 0);
});
