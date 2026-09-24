// Articles au prix de gros (2026-09-24) : le fournisseur donne son prix de
// gros, le revendeur vend au prix qu'il veut, Suguba se rémunère selon le
// mode choisi par l'admin (dynamique).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

const sansCouts = (gros = {}) => P.completerReglages({
  ...P.REGLAGES_PAR_DEFAUT,
  fraisPaiementPct: 0, fraisVersementPct: 0, coutMessageParCommande: 0, provisionRefusPct: 0,
  coutsFixesMensuels: [], margeNetteMinPct: 0, remunerationLivreur: 0,
  prixDeGros: { modeGain: 'marge_revendeur', taux: 10, montantFixe: 0, margeConseilleePct: 15, ...gros },
});

test('des réglages anciens reçoivent un réglage prix de gros par défaut', () => {
  const r = P.completerReglages({});
  assert.equal(r.prixDeGros.modeGain, 'marge_revendeur');
  assert.equal(r.prixDeGros.taux, 1);
});

test('mode marge revendeur : Suguba garde son % de ce que gagne le revendeur', () => {
  const t = P.calculerTarifGros(20000, 25000, sansCouts());
  assert.equal(t.statut, 'ok');
  assert.equal(t.commissionBrute, 5000);
  assert.equal(t.prelevementSuguba, 500);  // 10 % de 5 000 F
  assert.equal(t.commission, 4500);
  assert.equal(t.margeSuguba, 25000 - 20000 - 4500);
});

test('mode ajout au prix de gros : le revendeur achète plus cher, garde tout le reste', () => {
  const r = sansCouts({ modeGain: 'ajout_prix_gros', taux: 5 });
  const t = P.calculerTarifGros(20000, 25000, r);
  assert.equal(t.prelevementSuguba, 0);
  assert.equal(t.commission, 25000 - 20000 - 1000);
  assert.equal(P.prixMinimalGros(20000, r), 21000);
});

test('mode montant fixe et mode aucun', () => {
  assert.equal(P.calculerTarifGros(20000, 25000, sansCouts({ modeGain: 'montant_fixe', montantFixe: 300 })).commission, 4700);
  assert.equal(P.calculerTarifGros(20000, 25000, sansCouts({ modeGain: 'aucun' })).commission, 5000);
});

test('sous le prix minimal, la vente est refusée (sous le plancher)', () => {
  const r = P.completerReglages({ ...P.REGLAGES_PAR_DEFAUT });
  const min = P.prixMinimalGros(20000, r);
  assert.equal(P.calculerTarifGros(20000, min - 500, r).statut, 'sous_plancher');
  const auMin = P.calculerTarifGros(20000, min, r);
  assert.equal(auMin.statut, 'ok');
  assert.ok(auMin.margeNetteSuguba >= 0, 'jamais de vente à perte');
});

test('prix conseillé : celui du fournisseur s’il couvre le minimal, sinon calculé', () => {
  const r = P.completerReglages({ ...P.REGLAGES_PAR_DEFAUT });
  const min = P.prixMinimalGros(20000, r);
  assert.equal(P.prixConseilleGros(20000, r, min + 3000), min + 3000);
  assert.ok(P.prixConseilleGros(20000, r, min - 1000) > min, 'un conseil sous le minimal est remplacé');
});

test('la commande applique le prix du revendeur seulement s’il est attribué', () => {
  const r = sansCouts();
  const produit = { prixFournisseur: 20000, prixVente: 23000, modePrix: 'gros' };
  const avecRevendeur = P.calculerCommande(produit, { quantite: 2, ville: 'Kati', revendeurAttribue: true, prixRevendeur: 26000 }, r);
  assert.equal(avecRevendeur.prixUnitaire, 26000);
  assert.equal(avecRevendeur.commissionUnitaire, 5400); // 6 000 − 10 %
  const direct = P.calculerCommande(produit, { quantite: 1, ville: 'Kati', revendeurAttribue: false, prixRevendeur: 26000 }, r);
  assert.equal(direct.prixUnitaire, 23000, 'sans revendeur : prix conseillé');
  assert.equal(direct.commissionUnitaire, 0);
});

test('un article à prix fixe ignore tout prix revendeur', () => {
  const r = sansCouts();
  const d = P.calculerCommande({ prixFournisseur: 20000, prixVente: 25000 }, { quantite: 1, ville: 'Kati', revendeurAttribue: true, prixRevendeur: 99000 }, r);
  assert.equal(d.prixUnitaire, 25000);
});
