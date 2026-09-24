// Frais de retrait (2026-09-24) : payés par celui qui retire. Mobile Money :
// SasPay + opérateur + Suguba. Espèces au guichet : Suguba seulement.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

const r = P.completerReglages({
  ...P.REGLAGES_PAR_DEFAUT,
  fraisVersementPct: 1.5,
  fraisRetraitSugubaPct: 1.5,
  fraisOperateurRetraitPct: { orange_money: 1, moov: 0.5, mobi_cash: 0 },
});

test('par défaut : Suguba 1,5 % sur chaque retrait, opérateurs à 0', () => {
  const d = P.completerReglages({});
  assert.equal(d.fraisRetraitSugubaPct, 1.5);
  assert.deepEqual(d.fraisOperateurRetraitPct, { orange_money: 0, moov: 0, mobi_cash: 0 });
});

test('Orange Money : SasPay + Orange + Suguba sont déduits du montant demandé', () => {
  const f = P.calculerFraisRetrait(10000, 'orange_money', r);
  assert.equal(f.fraisSaspay, 150);
  assert.equal(f.fraisOperateur, 100);
  assert.equal(f.fraisSuguba, 150);
  assert.equal(f.fraisTotal, 400);
  assert.equal(f.montantNet, 9600);
});

test('chaque opérateur a son propre taux', () => {
  assert.equal(P.calculerFraisRetrait(10000, 'moov', r).fraisOperateur, 50);
  assert.equal(P.calculerFraisRetrait(10000, 'mobi_cash', r).fraisOperateur, 0);
});

test('espèces au guichet : seulement le % Suguba, ni SasPay ni opérateur', () => {
  const f = P.calculerFraisRetrait(10000, 'cash', r);
  assert.equal(f.fraisSaspay, 0);
  assert.equal(f.fraisOperateur, 0);
  assert.equal(f.fraisSuguba, 150);
  assert.equal(f.montantNet, 9850);
});

test('les frais ne sont plus un coût de Suguba sur la vente', () => {
  const t = P.calculerTarif(20000, 22000, { ...r, modePartSuguba: 'prelevement_revendeur' }, 2000);
  assert.equal(t.fraisVersement, 0);
});

test('des frais qui avaleraient tout le retrait sont refusés par la validation', () => {
  const erreurs = P.validerReglages({ ...r, fraisRetraitSugubaPct: 60, fraisVersementPct: 50 });
  assert.ok(erreurs.some((e) => /retrait/i.test(e)));
});
