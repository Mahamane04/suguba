// Formules boutiques (2026-09-24) : gratuit = 1 boutique, Pro 1 500 F = 2,
// Pro+ 5 000 F = 5 par défaut ; l'admin peut les modifier.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

test('formules par défaut : gratuit 1, Pro 2 à 1 500 F, Pro+ 5 à 5 000 F', () => {
  const f = P.completerReglages({}).formulesBoutiques;
  assert.deepEqual(f.map((x) => [x.prixMensuel, x.boutiques]), [[0, 1], [1500, 2], [5000, 5]]);
});

test('des formules saisies par l’admin sont nettoyées, jamais vidées', () => {
  const f = P.completerReglages({ formulesBoutiques: [{ id: 'gratuit', nom: 'Gratuit', prixMensuel: -5, boutiques: 0 }, { id: '', nom: 'x' }] }).formulesBoutiques;
  assert.equal(f.length, 1);
  assert.equal(f[0].prixMensuel, 0);
  assert.equal(f[0].boutiques, 1, 'au moins une boutique');
  assert.ok(P.completerReglages({ formulesBoutiques: [] }).formulesBoutiques.length >= 3, 'liste vide : formules par défaut');
});
