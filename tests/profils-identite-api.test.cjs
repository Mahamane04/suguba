require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
let droit = true, modification, depot, seed;
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = { exports: { exigerDroitFournisseur: async () => droit ? { ok: true, contexte: { fournisseurId: 'proprietaire' } } : { ok: false, erreur: 'Refusé', statut: 403 } } };
require.cache[require.resolve('../src/lib/reseau/boutiques.ts')] = { exports: {
  boutiqueDuProprietaire: async () => null,
  obtenirOuCreerBoutique: async (p) => { seed = p; return { id: 'boutique' }; },
  majBoutique: async (...args) => { modification = args; return { ok: true }; },
} };
require.cache[require.resolve('../src/lib/shop.ts')] = { exports: { attribuerSlugFournisseur: async () => null } };
const db = { from(table) { assert.equal(table, 'suppliers'); const q = {
  select() { return q; }, eq(k,v) { assert.equal(k, 'profile_id'); assert.equal(v, 'proprietaire'); return q; },
  update(v) { depot = v; return q; },
  async maybeSingle() { return { data: { company_name: 'Entreprise', logo_url: 'https://exemple.test/logo.png', contact_phone: 'privé' } }; },
  then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
}; return q; } };
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => db } };
const { PATCH } = require('../src/app/api/supplier/me/route.ts');
const req = (body) => new NextRequest('http://localhost/api/supplier/me', { method: 'PATCH', body: JSON.stringify(body) });
test('TEST-UX-PROFILS-IDENTITE-API : ancien client écrit l’identité canonique, coordonnées privées séparées, slug conservé', async () => {
  modification = depot = seed = undefined;
  assert.equal((await PATCH(req({ shopDisplayName: 'Nouvelle boutique', logoUrl: null, contactPhone: 'contact interne', slug: 'injection' }))).status, 200);
  assert.deepEqual(modification, ['boutique', 'proprietaire', { nom: 'Nouvelle boutique', logo: null }]);
  assert.deepEqual(depot, { contact_phone: 'contact interne' });
  assert.equal('contact_phone' in seed, false); assert.equal('slug' in seed, false);
});
test('TEST-UX-PROFILS-IDENTITE-API : accès refusé et coordonnées invalides n’écrivent pas l’identité', async () => {
  modification = undefined; droit = false;
  assert.equal((await PATCH(req({ shopDisplayName: 'Interdit' }))).status, 403); assert.equal(modification, undefined);
  droit = true;
  assert.equal((await PATCH(req({ shopDisplayName: 'Non enregistré', contactEmail: 'invalide' }))).status, 400); assert.equal(modification, undefined);
});
