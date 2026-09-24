// Provision pour refus calculée sur la course perdue (2026-09-24) plutôt que
// sur le prix du produit : un colis refusé revient au stock, Suguba perd la
// course. Au prix, 4 % d'un article à 400 000 F ajoutaient 16 000 F au client.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/pricing.ts');

const base = (surcharge = {}) => P.completerReglages({
  ...P.REGLAGES_PAR_DEFAUT, modePartSuguba: 'prelevement_revendeur', tauxPartSuguba: 1,
  // La provision ne pèse sur le prix que si les coûts y sont répercutés.
  couvrirCoutsDansLePrix: true, ...surcharge,
});

test('des réglages déjà enregistrés sans la base gardent le calcul au prix', () => {
  const anciens = { ...P.REGLAGES_PAR_DEFAUT };
  delete anciens.baseProvisionRefus;
  const r = P.completerReglages(anciens);
  assert.equal(r.baseProvisionRefus, 'prix');
  assert.equal(P.calculerTarif(100000, 120000, r).provisionRefus, 4800); // 4 % de 120 000 F
});

test('sur la course : taux × (livreur aller + retour), quel que soit le prix', () => {
  const r = base({ baseProvisionRefus: 'course', provisionRefusPct: 15, remunerationLivreur: 1000 });
  assert.equal(P.coutCourseRefusee(r), 2000);
  assert.equal(P.calculerTarif(20000, 25000, r).provisionRefus, 300);
  assert.equal(P.calculerTarif(400000, 450000, r).provisionRefus, 300);
});

test('un article cher coûte nettement moins cher au client, sans vente à perte', () => {
  const auPrix = base();
  const surCourse = base({ baseProvisionRefus: 'course', provisionRefusPct: 15 });
  const a = P.prixDepuisPartRevendeur(400000, 3000, auPrix);
  const b = P.prixDepuisPartRevendeur(400000, 3000, surCourse);
  assert.ok(b.prixVente < a.prixVente - 10000, `${b.prixVente} vs ${a.prixVente}`);
  const t = P.calculerTarif(400000, b.prixVente, surCourse, 3000);
  assert.equal(t.statut, 'ok');
  assert.ok(t.margeNetteSuguba >= 0);
});

test('le prix minimal couvre exactement les coûts dans les deux bases', () => {
  for (const baseProvisionRefus of ['prix', 'course']) {
    const r = base({ baseProvisionRefus, provisionRefusPct: 10, margeNetteMinPct: 0 });
    for (const pf of [3000, 20000, 250000]) {
      const d = P.prixDepuisPartRevendeur(pf, 1000, r);
      const t = P.calculerTarif(pf, d.prixMinimal, r, 1000);
      assert.equal(t.statut, 'ok', `${baseProvisionRefus} ${pf}`);
      assert.ok(t.margeNetteSuguba >= 0, `${baseProvisionRefus} ${pf} : ${t.margeNetteSuguba}`);
    }
  }
});
