// Mode « prélevé sur le revendeur » (2026-09-23) : le fournisseur fixe la
// part du revendeur, Suguba en garde un pourcentage réglé par l'admin.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

const reglages = (surcharge = {}) => ({
  ...P.REGLAGES_PAR_DEFAUT, modePartSuguba: 'prelevement_revendeur', tauxPartSuguba: 1, ...surcharge,
});

test('le revendeur reçoit sa part moins le prélèvement, au franc près', () => {
  const r = reglages();
  const { prixVente } = P.prixDepuisPartRevendeur(20000, 2000, r);
  const t = P.calculerTarif(20000, prixVente, r, 2000);
  assert.equal(t.statut, 'ok');
  assert.equal(t.commissionBrute, 2000);
  assert.equal(t.prelevementSuguba, 20);   // 1 % de 2 000 F
  assert.equal(t.commission, 1980);        // pas arrondi au pas de 250 F
  // Le prélèvement revient à Suguba : prix − fournisseur − ce que reçoit le revendeur.
  assert.equal(t.margeSuguba, prixVente - 20000 - 1980);
});

test('rien n’est ajouté au prix client pour Suguba, hors plancher de coûts', () => {
  const sansCouts = reglages({
    fraisPaiementPct: 0, fraisVersementPct: 0, coutMessageParCommande: 0, provisionRefusPct: 0,
    coutsFixesMensuels: [], margeNetteMinPct: 0, remunerationLivreur: 0,
  });
  const d = P.prixDepuisPartRevendeur(20000, 2000, sansCouts);
  assert.equal(d.prixVente, 22000);        // prix fournisseur + part revendeur
  assert.equal(d.releveAuPlancher, false);
});

test('le plancher protège toujours Suguba : aucune vente à perte', () => {
  const r = reglages();
  const d = P.prixDepuisPartRevendeur(20000, 500, r);
  const t = P.calculerTarif(20000, d.prixVente, r, 500);
  assert.ok(d.prixVente >= d.prixMinimal);
  assert.ok(t.margeNetteSuguba >= 0);
});

test('le taux est réglable par l’admin, et 0 % ne prélève rien', () => {
  const dix = P.calculerTarif(20000, 30000, reglages({ tauxPartSuguba: 10 }), 2000);
  assert.equal(dix.prelevementSuguba, 200);
  assert.equal(dix.commission, 1800);
  const zero = P.calculerTarif(20000, 30000, reglages({ tauxPartSuguba: 0 }), 2000);
  assert.equal(zero.prelevementSuguba, 0);
  assert.equal(zero.commission, 2000);
});

test('les autres modes ne prélèvent rien sur le revendeur', () => {
  for (const mode of ['prix_vente', 'part_revendeur', 'auto']) {
    const r = { ...P.REGLAGES_PAR_DEFAUT, modePartSuguba: mode, tauxPartSuguba: 10 };
    const t = P.calculerTarif(20000, 30000, r, 2000);
    assert.equal(t.prelevementSuguba, 0, mode);
    assert.equal(t.commission, t.commissionBrute, mode);
  }
});

test('la commande enregistre la part NETTE du revendeur', () => {
  const r = reglages();
  const { prixVente } = P.prixDepuisPartRevendeur(20000, 2000, r);
  const devis = P.calculerCommande(
    { prixFournisseur: 20000, prixVente, commissionProposee: 2000 },
    { quantite: 3, ville: 'Bamako', revendeurAttribue: true }, r,
  );
  assert.equal(devis.commissionUnitaire, 1980);
  assert.equal(devis.commissionTotale, 5940);
  assert.equal(devis.margeSuguba, (prixVente - 20000 - 1980) * 3);
});

test('le réglage est accepté par la validation, plafonné à 100 %', () => {
  assert.deepEqual(P.validerReglages(reglages()), []);
  assert.ok(P.validerReglages(reglages({ tauxPartSuguba: 150 })).some((e) => /100 %/.test(e)));
});
