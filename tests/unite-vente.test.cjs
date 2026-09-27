// Unité de vente et ajout direct au panier (V2 vue client, 2026-09-27).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const u = require('../src/lib/unite-vente.ts');

test('unité : saisie contrôlée, rien d’inventé', () => {
  assert.deepEqual(u.normaliserUniteVente('', 4), { ok: true, unite: null, contenu: null });
  assert.deepEqual(u.normaliserUniteVente('lot', '4'), { ok: true, unite: 'lot', contenu: 4 });
  assert.equal(u.normaliserUniteVente('lot', '').ok, false, 'un lot dit combien il contient');
  assert.equal(u.normaliserUniteVente('lot', 1).ok, false);
  assert.deepEqual(u.normaliserUniteVente('carton', ''), { ok: true, unite: 'carton', contenu: null });
  assert.deepEqual(u.normaliserUniteVente('kg', 5), { ok: true, unite: 'kg', contenu: null }, 'pas de contenu au kilo');
  assert.equal(u.normaliserUniteVente('tonne', null).ok, false);
});

test('unité : texte à côté du prix', () => {
  assert.equal(u.suffixeUnite(null), '');
  assert.equal(u.suffixeUnite('unite'), '/ unité');
  assert.equal(u.suffixeUnite('lot', 4), '/ lot de 4');
  assert.equal(u.suffixeUnite('carton'), '/ carton');
  assert.equal(u.suffixeUnite('metre'), '/ mètre');
  assert.equal(u.lireUniteVente('kg'), 'kg');
  assert.equal(u.lireUniteVente('n’importe quoi'), null);
});

test('ajout direct au panier : seulement pour une offre simple', () => {
  const simple = { enStock: true, modeCommande: 'achat', modePrix: 'fixe', variantes: false, modeRemise: 'livreur' };
  assert.equal(u.ajoutDirectPossible(simple), true);
  assert.equal(u.ajoutDirectPossible({ ...simple, enStock: false }), false, 'rupture');
  assert.equal(u.ajoutDirectPossible({ ...simple, modeCommande: 'devis' }), false, 'sur devis');
  assert.equal(u.ajoutDirectPossible({ ...simple, modePrix: 'gros' }), false, 'prix de gros : offre d’un revendeur');
  assert.equal(u.ajoutDirectPossible({ ...simple, variantes: true }), false, 'variante à choisir');
  assert.equal(u.ajoutDirectPossible({ ...simple, modeRemise: 'fournisseur' }), false, 'remis par le vendeur');
});

test('SQL : unité et contenu cohérents, relançable', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-unite-vente.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-unite-vente.sql'));
  const ins = (id, unite, contenu) => db.exec(`INSERT INTO public.products (id, name, slug, category, unite_vente, contenu_lot)
    VALUES ('${id}', '[TEST] ${id}', 'test-${id}', 'Test', ${unite === null ? 'NULL' : `'${unite}'`}, ${contenu === null ? 'NULL' : contenu})`);
  await ins('a', null, null);
  await ins('b', 'lot', 4);
  await ins('c', 'carton', null);
  await ins('d', 'kg', null);
  await assert.rejects(ins('e', 'lot', null), 'lot sans contenu');
  await assert.rejects(ins('f', 'kg', 3), 'contenu au kilo');
  await assert.rejects(ins('g', 'tonne', null), 'unité inconnue');
  await assert.rejects(ins('h', null, 4), 'contenu sans unité');
});

test('catalogue : l’unité et les variantes sont servies à tous, pas le prix fournisseur', () => {
  const { produitPourLecteur } = require('../src/lib/catalogue.ts');
  const vue = produitPourLecteur({ id: 'p1', name: 'Encre', unite_vente: 'lot', contenu_lot: 4, variant_group: 'g1', supplier_price: 1000 }, { role: 'public' });
  assert.equal(vue.unite_vente, 'lot');
  assert.equal(vue.contenu_lot, 4);
  assert.equal(vue.variant_group, 'g1');
  assert.ok(!('supplier_price' in vue));
});
