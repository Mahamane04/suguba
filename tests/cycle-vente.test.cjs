// Audit du fondateur (2026-09-27) : la vente crée les montants dus ; le paiement
// et le retrait déclenchent chacun leurs propres frais, jamais deux fois.
// Chiffres repris tels quels de l'audit : 100 000 F de gros, vendu 110 000 F.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');
const { simulerCycle, commissionExpliquee } = require('../src/lib/cycle-vente.ts');

// Commission commerciale à 0 dans l'exemple de l'audit, coûts à 0 pour isoler les frais.
const r = P.completerReglages({
  prixDeGros: { modeGain: 'aucun', taux: 0, montantFixe: 0, margeConseilleePct: 15 },
  fraisRetraitSuguba: { revendeur: { caisse: 1.5, mobile: 1.5 }, fournisseur: { caisse: 1.5, mobile: 1.5 } },
  provisionRefusPct: 0, coutsFixesMensuels: [], coutMessageParCommande: 0, remunerationLivreur: 0,
});
const exemple = { mode: 'gros', prixFournisseur: 100000, prixVenteRevendeur: 110000, paiement: 'especes', retraitFournisseur: 'cash', retraitRevendeur: 'cash' };

test('la vente crée les montants dus : 100 000 F au fournisseur, 10 000 F au revendeur, sans frais de retrait', () => {
  const c = simulerCycle(exemple, r);
  assert.equal(c.vente.prixClient, 110000);
  assert.equal(c.vente.duFournisseur, 100000);
  assert.equal(c.vente.duRevendeur, 10000);
  assert.equal(c.vente.commissionSuguba, 0);
  assert.equal(c.encaissement.fraisTotal, 0, 'espèces : aucun frais de paiement');
});

test('retrait du revendeur à la caisse à 1,5 % : 10 000 F débités, 150 F de frais, 9 850 F reçus', () => {
  const d = simulerCycle(exemple, r).retraits.revendeur;
  assert.deepEqual([d.montantDemande, d.fraisSuguba, d.fraisSaspay + d.fraisOperateur, d.montantNet], [10000, 150, 0, 9850]);
  // Retrait partiel : 5 000 F → 75 F de frais, 4 925 F reçus.
  const partiel = P.calculerFraisRetrait(5000, 'cash', r, 'revendeur');
  assert.deepEqual([partiel.fraisSuguba, partiel.montantNet], [75, 4925]);
});

test('retrait du fournisseur : caisse 98 500 F ; Mobile Money 98 500 F − le vrai virement SasPay', () => {
  assert.equal(simulerCycle(exemple, r).retraits.fournisseur.montantNet, 98500);
  const mm = simulerCycle({ ...exemple, retraitFournisseur: 'orange_money' }, r).retraits.fournisseur;
  assert.equal(mm.fraisSuguba, 1500);
  assert.equal(mm.fraisSaspay, 2100, 'SasPay Orange : 2 % + 100 F');
  assert.equal(mm.montantNet, 98500 - 2100);
});

test('un client payé en espèces n’exonère pas un retrait Mobile Money, et une caisse ne déclenche aucun frais Mobile Money', () => {
  const caisse = simulerCycle(exemple, r).retraits.fournisseur;
  assert.equal(caisse.fraisSaspay + caisse.fraisOperateur, 0);
  const mm = simulerCycle({ ...exemple, paiement: 'especes', retraitFournisseur: 'wave' }, r).retraits.fournisseur;
  assert.ok(mm.fraisSaspay > 0);
});

test('quatre taux distincts, 0 % accepté tel quel', () => {
  const r2 = P.completerReglages({ ...r, fraisRetraitSuguba: { revendeur: { caisse: 0, mobile: 2 }, fournisseur: { caisse: 0, mobile: 0.5 } } });
  assert.deepEqual(r2.fraisRetraitSuguba, { revendeur: { caisse: 0, mobile: 2 }, fournisseur: { caisse: 0, mobile: 0.5 } });
  assert.equal(P.calculerFraisRetrait(100000, 'cash', r2, 'fournisseur').montantNet, 100000);
  assert.equal(P.calculerFraisRetrait(10000, 'orange_money', r2, 'revendeur').fraisSuguba, 200);
  assert.equal(P.calculerFraisRetrait(10000, 'orange_money', r2, 'fournisseur').fraisSuguba, 50);
});

test('sans taux réglés, les quatre reprennent l’ancien taux unique', () => {
  const ancien = P.completerReglages({ fraisRetraitSugubaPct: 2 });
  assert.deepEqual(ancien.fraisRetraitSuguba, { revendeur: { caisse: 2, mobile: 2 }, fournisseur: { caisse: 2, mobile: 2 } });
});

test('les frais des retraits restent prévisionnels : jamais comptés comme déjà gagnés', () => {
  const c = simulerCycle(exemple, r);
  assert.equal(c.synthese.acquis, 0);
  assert.equal(c.synthese.previsionnel, 150 + 1500);
  assert.equal(c.synthese.resultat, 0);
  assert.equal(c.synthese.resultatAvecPrevisionnel, 1650);
});

test('paiement Mobile Money : le client paie ses frais, Suguba garde seulement son 1 %', () => {
  const c = simulerCycle({ ...exemple, paiement: 'orange_ml' }, r);
  assert.equal(c.encaissement.gainSuguba, 1100);
  assert.equal(c.encaissement.totalClient, 110000 + 1100 + Math.ceil(0.04 * 111100));
  assert.equal(c.synthese.acquis, 1100);
});

test('les coûts de Suguba sont détaillés ligne par ligne', () => {
  const avecCouts = P.completerReglages({ ...r, provisionRefusPct: 4, baseProvisionRefus: 'course', remunerationLivreur: 1000, coutMessageParCommande: 20, coutsFixesMensuels: [{ libelle: 'Hébergement', montant: 50000 }], volumeReference: 500 });
  const c = simulerCycle(exemple, avecCouts);
  assert.deepEqual(c.couts.lignes.map((l) => [l.libelle, l.montant]), [
    ['Provision pour refus à la livraison', 80],
    ['Part des coûts fixes du mois', 100],
    ['Message au client', 20],
  ]);
  assert.equal(c.synthese.resultat, -200);
});

test('la commission dit sur quoi elle est calculée et qui la paie', () => {
  assert.deepEqual(commissionExpliquee({ ...r, modePartSuguba: 'prelevement_revendeur', tauxPartSuguba: 1 }, 'fixe'),
    { base: '1 % de la part revendeur', payeur: 'le revendeur (prélevé sur sa part)' });
  assert.deepEqual(commissionExpliquee({ ...r, modePartSuguba: 'prix_vente', tauxPartSuguba: 1 }, 'fixe'),
    { base: '1 % du prix de vente', payeur: 'le client (ajouté au prix)' });
});

test('baisser un des quatre taux de retrait demande le droit dédié et un motif', () => {
  const { baissesPartSuguba } = require('../src/lib/protection.ts');
  const apres = { ...r, fraisRetraitSuguba: { ...r.fraisRetraitSuguba, fournisseur: { caisse: 0, mobile: 1.5 } } };
  assert.ok(baissesPartSuguba(r, apres).some((b) => b.cle === 'fraisRetraitSuguba.fournisseur.caisse'));
});
