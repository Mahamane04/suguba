// Priorité au réseau (2026-09-26, lot C) : réglages, offres des revendeurs
// pour un article au prix de gros, boutique fournisseur sans prix.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normaliserReglagesReseau, venteDirectePermise } = require('../src/lib/reseau/reglages.ts');

test('réglages : lancement protégé par défaut, fournisseur ouvert un par un', () => {
  const r = normaliserReglagesReseau({});
  assert.equal(r.annuaireFournisseurs, false);
  assert.equal(r.venteDirecteFournisseurs, false);
  assert.equal(r.protectionPrixDeGros, true);
  assert.equal(r.primeParrainageClient, 500, 'les primes gardent leurs valeurs');
  assert.equal(venteDirectePermise(r, 'f1'), false);
  const ouvert = normaliserReglagesReseau({ fournisseursVenteDirecte: ['f1', 'f1', '<x>', 3] });
  assert.deepEqual(ouvert.fournisseursVenteDirecte, ['f1']);
  assert.equal(venteDirectePermise(ouvert, 'f1'), true);
  assert.equal(venteDirectePermise(ouvert, 'f2'), false);
  assert.equal(venteDirectePermise(normaliserReglagesReseau({ venteDirecteFournisseurs: true }), 'f2'), true);
});

// ── Base simulée (lecture seule) ────────────────────────────────────────────
let tables;
const admin = {
  from(nom) {
    let lignes = [...(tables[nom] || [])];
    const q = {
      select() { return q; },
      eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
      in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
      limit() { return q; },
      maybeSingle: async () => ({ data: lignes[0] || null, error: null }),
      then(ok, ko) { return Promise.resolve({ data: lignes, error: null }).then(ok, ko); },
    };
    return q;
  },
};
const { offresRevendeurs, achatDirectBloque } = require('../src/lib/offres-revendeurs.ts');
const { appliquerPrioriteReseau } = require('../src/lib/presentation-fournisseur.ts');

const base = () => ({
  reseller_shop_items: [{ reseller_id: 'r1', product_id: 'p1' }, { reseller_id: 'r2', product_id: 'p1' }, { reseller_id: 'r3', product_id: 'p1' }],
  profile_roles: [{ profile_id: 'r1', role: 'reseller', status: 'active' }, { profile_id: 'r2', role: 'reseller', status: 'active' }, { profile_id: 'r3', role: 'reseller', status: 'suspended' }],
  profiles: [{ id: 'r1', full_name: '[TEST] Fatou Diarra', reseller_code: 'SG-111111' }, { id: 'r2', full_name: '[TEST] Awa', reseller_code: 'SG-222222' }, { id: 'r3', full_name: 'Suspendu', reseller_code: 'SG-333333' }],
  reseller_prices: [{ reseller_id: 'r1', product_id: 'p1', price: 32000 }],
});
const gros = { id: 'p1', public_price: 30000, mode_prix: 'gros' };

test('offres : revendeurs actifs seulement, leur prix (sinon le conseillé), du moins cher au plus cher', async () => {
  tables = base();
  const offres = await offresRevendeurs(admin, gros);
  assert.deepEqual(offres.map((o) => [o.code, o.prix]), [['SG-222222', 30000], ['SG-111111', 32000]]);
  assert.equal(offres[1].nom, '[TEST] D.', 'prénom et initiale seulement');
});

test('achat direct au prix conseillé : bloqué seulement si un revendeur propose l’article', async () => {
  tables = base();
  assert.equal(await achatDirectBloque(admin, gros, true), true);
  assert.equal(await achatDirectBloque(admin, gros, false), false, 'protection désactivée');
  assert.equal(await achatDirectBloque(admin, { ...gros, mode_prix: 'fixe' }, true), false, 'prix fixe : même prix partout');
  tables = { ...base(), reseller_shop_items: [] };
  assert.equal(await achatDirectBloque(admin, gros, true), false, 'aucun revendeur : personne n’est court-circuité');
});

test('boutique fournisseur : prix retirés côté serveur, revendeurs partenaires mis en avant', async () => {
  tables = base();
  const vitrine = { type: 'fournisseur', nom: 'F', produits: [{ id: 'p1', prix: 30000 }], fournisseurId: 'f1' };
  const fermee = await appliquerPrioriteReseau(admin, vitrine, 'f1', normaliserReglagesReseau({}));
  assert.equal(fermee.produits[0].prix, 0);
  assert.deepEqual(fermee.presentation.revendeurs.map((r) => r.lien).sort(), ['/r/SG-111111', '/r/SG-222222']);
  const ouverte = await appliquerPrioriteReseau(admin, vitrine, 'f1', normaliserReglagesReseau({ fournisseursVenteDirecte: ['f1'] }));
  assert.equal(ouverte.produits[0].prix, 30000);
  assert.equal(ouverte.presentation, null);
});
