// Logo et couverture de boutique (2026-09-26) : l'adresse d'image n'est plus
// jamais tronquée à 160 caractères, et les adresses déjà tronquées se réparent.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ecrites = [];
const requete = () => {
  const q = { update(v) { ecrites.push(v); return q; }, eq() { return q; }, is() { return q; }, then(ok) { return Promise.resolve({ error: null }).then(ok); } };
  return q;
};
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports: { getSupabaseAdmin: () => ({ from: requete }) } };
const { majBoutique } = require('../src/lib/reseau/boutiques.ts');

const URL_LONGUE = 'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/product-images/boutiques/1070921e-ff29-49d6-87a1-0976d41e305b/4b97bc74-cdab-4660-9bcd-a1f1158c0000.webp';

test('logo et couverture : adresse complète, jamais tronquée', async () => {
  assert.ok(URL_LONGUE.length > 160);
  ecrites.length = 0;
  assert.deepEqual(await majBoutique('b1', 'u1', { nom: 'Ma boutique', logo: URL_LONGUE, couverture: URL_LONGUE, accroche: 'x'.repeat(300) }), { ok: true });
  assert.equal(ecrites[0].logo_url, URL_LONGUE);
  assert.equal(ecrites[0].cover_url, URL_LONGUE);
  assert.equal(ecrites[0].tagline.length, 160, 'les textes restent limités');
  assert.equal((await majBoutique('b1', 'u1', { logo: 'javascript:alert(1)' })).ok, false);
  assert.equal((await majBoutique('b1', 'u1', { logo: null })).ok, true);
});

test('SQL : répare une adresse tronquée à partir du stockage', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const { readFileSync } = require('node:fs');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA storage; CREATE TABLE storage.objects (bucket_id text, name text);
    CREATE TABLE public.stores (id text primary key, logo_url text, cover_url text, updated_at timestamptz);`);
  const nom = URL_LONGUE.split('/product-images/')[1];
  await db.query(`INSERT INTO storage.objects VALUES ('product-images', $1), ('product-images', 'boutiques/autre/fichier.webp')`, [nom]);
  await db.query(`INSERT INTO public.stores VALUES ('b1', $1, $1, null), ('b2', $2, null, null)`, [URL_LONGUE.slice(0, 160), 'https://ok.example/logo.webp']);
  const script = readFileSync(require('node:path').join(__dirname, '../supabase/A-EXECUTER-2026-09-26-reparer-images-boutiques.sql'), 'utf8');
  const r = await db.exec(script);
  assert.deepEqual(r[r.length - 1].rows[0], { logos_repares: 1, couvertures_reparees: 1 });
  const b = (await db.query(`SELECT * FROM public.stores ORDER BY id`)).rows;
  assert.equal(b[0].logo_url, URL_LONGUE);
  assert.equal(b[0].cover_url, URL_LONGUE);
  assert.equal(b[1].logo_url, 'https://ok.example/logo.webp', 'adresses intactes non touchées');
  const r2 = await db.exec(script);
  assert.deepEqual(r2[r2.length - 1].rows[0], { logos_repares: 0, couvertures_reparees: 0 }, 'sans effet à la 2e exécution');
});
