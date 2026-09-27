// Unité de vente et ajout direct au panier (V2 vue client, 2026-09-27),
// élargie aux habitudes des marchés de Bamako (tissus, construction…).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const u = require('../src/lib/unite-vente.ts');

test('unité : saisie contrôlée, rien d’inventé', () => {
  assert.deepEqual(u.normaliserUniteVente(''), { ok: true, unite: null, contenu: null, mesure: null, quantiteMin: null });
  assert.deepEqual(u.normaliserUniteVente('lot', '4'), { ok: true, unite: 'lot', contenu: 4, mesure: 'piece', quantiteMin: null });
  assert.equal(u.normaliserUniteVente('lot', '').ok, false, 'un lot dit combien il contient');
  assert.equal(u.normaliserUniteVente('lot', '2,5').ok, false, 'pas de demi-article');
  assert.deepEqual(u.normaliserUniteVente('sac', '50'), { ok: true, unite: 'sac', contenu: 50, mesure: 'kg', quantiteMin: null });
  assert.deepEqual(u.normaliserUniteVente('carton', '1,44', 'm2'), { ok: true, unite: 'carton', contenu: 1.44, mesure: 'm2', quantiteMin: null });
  assert.equal(u.normaliserUniteVente('sac', '50', 'l').ok, false, 'un sac se mesure en kg');
  assert.deepEqual(u.normaliserUniteVente('metre', '3', null, '2'), { ok: true, unite: 'metre', contenu: null, mesure: null, quantiteMin: 2 }, 'pas de contenu au mètre');
  assert.equal(u.normaliserUniteVente('metre', null, null, '1,5').ok, false, 'minimum entier');
  assert.equal(u.normaliserUniteVente('metre', null, null, '1').quantiteMin, null, 'minimum 1 = pas de minimum');
  assert.equal(u.normaliserUniteVente('tonneau').ok, false);
});

test('unité : texte à côté du prix et minimum', () => {
  assert.equal(u.suffixeUnite(null), '');
  assert.equal(u.suffixeUnite('unite'), '/ unité');
  assert.equal(u.suffixeUnite('lot', 4, 'piece'), '/ lot de 4');
  assert.equal(u.suffixeUnite('sac', 50, 'kg'), '/ sac de 50 kg');
  assert.equal(u.suffixeUnite('carton', 1.44, 'm2'), '/ carton de 1,44 m²');
  assert.equal(u.suffixeUnite('pagne', 6, 'yard'), '/ pagne de 6 yards');
  assert.equal(u.suffixeUnite('metre'), '/ m');
  assert.equal(u.suffixeUnite('m2'), '/ m²');
  assert.equal(u.texteMinimum('metre', 2), 'Minimum : 2 m');
  assert.equal(u.texteMinimum('sac', 3), 'Minimum : 3 sacs');
  assert.equal(u.texteMinimum('sac', null), '');
  assert.equal(u.lireUniteVente('pagne'), 'pagne');
  assert.equal(u.lireMesure('m3'), 'm3');
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

test('SQL : mêmes règles que le code, lots v1 repris, relançable', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-unite-vente.sql'));
  await db.exec(`INSERT INTO public.products (id, name, slug, category, unite_vente, contenu_lot) VALUES ('v1', '[TEST] v1', 'test-v1', 'Test', 'lot', 4)`);
  await db.exec(sql('A-EXECUTER-2026-09-27-unite-vente-v2.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-unite-vente-v2.sql'));
  const repris = (await db.query(`SELECT contenu_valeur::float AS v, contenu_mesure AS m, contenu_lot FROM public.products WHERE id = 'v1'`)).rows[0];
  assert.deepEqual(repris, { v: 4, m: 'piece', contenu_lot: null }, 'lot de 4 repris');

  let n = 0;
  const ins = (unite, v, m, mini) => db.exec(`INSERT INTO public.products (id, name, slug, category, unite_vente, contenu_valeur, contenu_mesure, quantite_min)
    VALUES ('p${++n}', '[TEST] ${n}', 'test-${n}', 'Test', ${unite ? `'${unite}'` : 'NULL'}, ${v ?? 'NULL'}, ${m ? `'${m}'` : 'NULL'}, ${mini ?? 'NULL'})`);
  await ins(null, null, null, null);
  await ins('sac', 50, 'kg', null);
  await ins('carton', 1.44, 'm2', 5);
  await ins('metre', null, null, 2);
  await ins('pagne', 6, 'yard', null);
  await ins('voyage', 6, 'm3', null);
  await assert.rejects(ins('lot', null, null, null), 'lot sans contenu');
  await assert.rejects(ins('lot', 2.5, 'piece', null), 'demi-article');
  await assert.rejects(ins('sac', 50, 'l', null), 'sac en litres');
  await assert.rejects(ins('metre', 3, 'm', null), 'contenu au mètre');
  await assert.rejects(ins('tonneau', null, null, null), 'unité inconnue');
  await assert.rejects(ins('metre', null, null, 1), 'minimum 1 : NULL attendu');
  await assert.rejects(ins(null, 4, 'piece', null), 'contenu sans unité');

  // Mêmes verdicts côté code.
  const cas = [['sac', '50', 'kg', null, true], ['sac', '50', 'l', null, false], ['lot', '', null, null, false], ['metre', '', null, '2', true]];
  for (const [un, v, m, mi, attendu] of cas) assert.equal(u.normaliserUniteVente(un, v, m, mi).ok, attendu, `${un} ${v} ${m}`);
});

test('catalogue : unité, minimum et variantes servis à tous, pas le prix fournisseur', () => {
  const { produitPourLecteur } = require('../src/lib/catalogue.ts');
  const vue = produitPourLecteur({ id: 'p1', name: 'Ciment', unite_vente: 'sac', contenu_valeur: 50, contenu_mesure: 'kg', quantite_min: 5, variant_group: 'g1', supplier_price: 1000 }, { role: 'public' });
  assert.equal(vue.unite_vente, 'sac');
  assert.equal(vue.contenu_valeur, 50);
  assert.equal(vue.contenu_mesure, 'kg');
  assert.equal(vue.quantite_min, 5);
  assert.equal(vue.variant_group, 'g1');
  assert.ok(!('supplier_price' in vue));
});

test('serveur : la quantité minimale est imposée à la commande', () => {
  const { readFileSync } = require('node:fs');
  for (const f of ['../src/lib/order-create.ts', '../src/lib/cart-create.ts']) {
    assert.match(readFileSync(require.resolve(f), 'utf8'), /quantite_min/, f);
  }
});
