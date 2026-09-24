// Modèle Suguba (2026-09-24) : le client paie prix fournisseur + part
// revendeur, rien de plus. Suguba se rémunère DANS la part revendeur (ou dans
// la marge du revendeur au prix de gros) et paie ses coûts sur sa propre part.
// Avant, les coûts relevaient le prix : 5 000 F + 500 F finissaient à 7 000 F.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

// Coûts réels de la base au 2026-09-24 : ils ne doivent plus toucher au prix.
const reglages = (surcharge = {}) => P.completerReglages({
  ...P.REGLAGES_PAR_DEFAUT,
  modePartSuguba: 'prelevement_revendeur', tauxPartSuguba: 1, minimumPartSuguba: 0, margeNetteMinPct: 0,
  coutsFixesMensuels: [{ libelle: 'Estimation provisoire', montant: 300000 }], volumeReference: 500,
  ...surcharge,
});

test('par défaut, les coûts ne sont pas ajoutés au prix client', () => {
  assert.equal(P.completerReglages({}).couvrirCoutsDansLePrix, false);
  const anciens = { ...P.REGLAGES_PAR_DEFAUT };
  delete anciens.couvrirCoutsDansLePrix;
  assert.equal(P.completerReglages(anciens).couvrirCoutsDansLePrix, false);
});

test('prix client = prix fournisseur + part revendeur, au franc près', () => {
  const r = reglages();
  for (const [pf, c] of [[5000, 500], [30000, 3000], [155000, 15000], [5250, 500]]) {
    const d = P.prixDepuisPartRevendeur(pf, c, r);
    assert.equal(d.prixVente, pf + c, `${pf} + ${c}`);
    assert.equal(d.releveAuPlancher, false);
    const t = P.calculerTarif(pf, d.prixVente, r, c);
    assert.equal(t.statut, 'ok');
    assert.equal(t.prelevementSuguba, Math.ceil(c / 100)); // 1 % de la part revendeur
    assert.equal(t.commission, c - t.prelevementSuguba);
    assert.equal(t.margeSuguba, t.prelevementSuguba);       // Suguba ne gagne que son prélèvement
  }
});

test('les coûts de Suguba sont pris sur sa part : la marge nette peut être négative', () => {
  const t = P.calculerTarif(5000, 5500, reglages(), 500);
  assert.equal(t.statut, 'ok');
  assert.ok(t.coutParCommande > 0);
  assert.equal(t.margeNetteSuguba, t.margeSuguba - t.coutParCommande - t.fraisVersement);
  assert.ok(t.margeNetteSuguba < 0);
});

test('sous prix fournisseur + part revendeur, la vente est refusée', () => {
  const t = P.calculerTarif(5000, 5400, reglages(), 500);
  assert.equal(t.statut, 'sous_plancher');
  assert.equal(t.prixMinimal, 5500);
});

test('prix de gros : toute la marge au-dessus du prix de gros est au revendeur, moins le % Suguba', () => {
  const r = reglages();
  assert.equal(P.prixMinimalGros(20000, r), 20000);
  const t = P.calculerTarifGros(20000, 25000, r);
  assert.equal(t.statut, 'ok');
  assert.equal(t.commissionBrute, 5000);
  assert.equal(t.prelevementSuguba, 50);  // 1 % de 5 000 F
  assert.equal(t.commission, 4950);
  assert.equal(P.calculerTarifGros(20000, 19500, r).statut, 'sous_plancher');
});
