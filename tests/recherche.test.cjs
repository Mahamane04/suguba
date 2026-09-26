// Recherche R1 (2026-09-26) : une seule recherche produits, côté serveur,
// insensible aux accents, tolérante aux fautes, avec synonymes.
require('../scripts/test-typescript.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

let db;
async function chercher(q, n = 60) {
  const r = await db.query('SELECT product_id FROM public.rechercher_produits($1, $2)', [q, n]);
  return r.rows.map((x) => x.product_id);
}

before(async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  db = await database({ recherche: true });
  await db.exec(sql('A-EXECUTER-2026-09-26-recherche.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-recherche.sql'));
  await db.exec(`
    INSERT INTO public.products (id, name, slug, category, description, public_price, status) VALUES
      ('p1', 'Réfrigérateur Samsung 200 L', 'frigo-samsung', 'Électroménager', 'Deux portes, classe A+', 150000, 'approved'),
      ('p2', 'Congélateur coffre 150 L', 'congelateur', 'Électroménager', 'Garde le froid 24 h', 120000, 'approved'),
      ('p3', 'Téléviseur LG 43 pouces', 'tv-lg', 'Image et son', 'Écran plat Smart TV', 180000, 'approved'),
      ('p4', 'Réfrigérateur caché', 'frigo-cache', 'Électroménager', '', 99000, 'pending'),
      ('p5', 'Réfrigérateur sans prix', 'frigo-sans-prix', 'Électroménager', '', 0, 'approved'),
      ('p6', 'Ventilateur sur pied', 'ventilateur', 'Électroménager', 'Silencieux, trois vitesses', 25000, 'approved');
  `);
});

test('sans accents ni majuscules : « refrigerateur » trouve « Réfrigérateur »', async () => {
  assert.deepEqual(await chercher('refrigerateur'), ['p1']);
  assert.deepEqual(await chercher('RÉFRIGÉRATEUR'), ['p1']);
});

test('seuls les articles en vente (approuvés, avec un prix) remontent', async () => {
  const ids = await chercher('frigo');
  assert.ok(!ids.includes('p4'), 'produit en attente');
  assert.ok(!ids.includes('p5'), 'produit sans prix');
});

test('synonymes dans les deux sens : « frigo », « tv », « ventilo »', async () => {
  assert.deepEqual(await chercher('frigo'), ['p1']);
  assert.deepEqual(await chercher('tv'), ['p3']);
  assert.deepEqual(await chercher('ventilo'), ['p6']);
});

test('faute de frappe tolérée sur un mot assez long', async () => {
  assert.deepEqual(await chercher('samsumg'), ['p1']);
  assert.deepEqual(await chercher('refrigirateur'), ['p1']);
});

test('tous les mots utiles doivent correspondre ; les petits mots sont ignorés', async () => {
  assert.deepEqual(await chercher('frigo de samsung'), ['p1']);
  assert.deepEqual(await chercher('frigo lg'), [], 'aucun frigo LG');
});

test('catégorie et description comptent, le nom passe devant', async () => {
  const ids = await chercher('electromenager');
  assert.deepEqual([...ids].sort(), ['p1', 'p2', 'p6']);
  assert.deepEqual(await chercher('silencieux'), ['p6']);
});

test('requête vide, trop courte ou piégée : rien, sans erreur', async () => {
  assert.deepEqual(await chercher(''), []);
  assert.deepEqual(await chercher('a'), []);
  assert.deepEqual(await chercher('%'), []);
  assert.deepEqual(await chercher("'; drop table products; --"), []);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.products')).rows[0].n, 6);
});

test('limite respectée et bornée à 200', async () => {
  assert.equal((await chercher('electromenager', 1)).length, 1);
  assert.equal((await chercher('electromenager', 100000)).length, 3);
});

test('synonyme : format contrôlé par la base', async () => {
  await assert.rejects(db.exec(`INSERT INTO public.recherche_synonymes (terme, equivalent) VALUES ('Frigo', 'refrigerateur')`), 'majuscule');
  await assert.rejects(db.exec(`INSERT INTO public.recherche_synonymes (terme, equivalent) VALUES ('frigo', '%')`), 'joker');
  await db.exec(`INSERT INTO public.recherche_synonymes (terme, equivalent) VALUES ('coffre', 'congelateur')`);
  assert.deepEqual(await chercher('coffre'), ['p2']);
});

test('normalisation côté serveur identique à la base (accents, majuscules, espaces)', () => {
  const { normaliserTerme, normaliserRecherche } = require('../src/lib/recherche-texte.ts');
  assert.equal(normaliserRecherche('  Réfrigérateur   ÉTÉ '), 'refrigerateur ete');
  assert.equal(normaliserTerme(' Frigo '), 'frigo');
  assert.equal(normaliserTerme('deux mots'), null, 'un seul mot');
  assert.equal(normaliserTerme('a'), null, 'trop court');
});

test('recherche locale de secours : mêmes règles d’accents', () => {
  const { correspondLocalement } = require('../src/lib/recherche-texte.ts');
  const p = { name: 'Réfrigérateur Samsung', description: 'Deux portes', category: 'Électroménager' };
  assert.equal(correspondLocalement(p, 'refrigerateur samsung'), true);
  assert.equal(correspondLocalement(p, 'electromenager'), true);
  assert.equal(correspondLocalement(p, 'frigo lg'), false);
});
