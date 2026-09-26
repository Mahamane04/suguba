// Prix fournisseur privés (2026-09-26, lot A) : le catalogue envoyé au
// navigateur ne contient que les colonnes du rôle, et la base refuse les
// colonnes sensibles à la clé publique.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COLONNES_PUBLIQUES, produitPourLecteur } = require('../src/lib/catalogue.ts');

const produit = {
  id: 'p1', name: '[TEST] Imprimante', slug: 'test-imprimante', public_price: 130000, supplier_id: 'f1', status: 'approved',
  supplier_price: 100000, reseller_commission: 8000, commission_proposee: 10000, pricing_status: 'ok', pricing_computed_at: 'x',
  mode_prix: 'fixe', prix_conseille: null,
};

test('chaque rôle ne reçoit que ses colonnes', () => {
  const pub = produitPourLecteur(produit, { role: 'public' });
  for (const c of ['supplier_price', 'reseller_commission', 'commission_proposee', 'pricing_status']) assert.ok(!(c in pub), `${c} caché au public`);
  assert.equal(pub.public_price, 130000);

  const rev = produitPourLecteur(produit, { role: 'reseller' });
  assert.equal(rev.reseller_commission, 8000, 'le revendeur voit ses gains');
  assert.ok(!('supplier_price' in rev) && !('commission_proposee' in rev), 'mais jamais le prix fournisseur');

  assert.equal(produitPourLecteur(produit, { role: 'supplier', fournisseurId: 'f1', voitPrix: true }).supplier_price, 100000, 'son propre produit');
  assert.ok(!('supplier_price' in produitPourLecteur(produit, { role: 'supplier', fournisseurId: 'f2', voitPrix: true })), 'pas celui d’un concurrent');
  assert.ok(!('supplier_price' in produitPourLecteur(produit, { role: 'supplier', fournisseurId: 'f1', voitPrix: false })), 'collaborateur sans droit catalogue');
  assert.deepEqual(produitPourLecteur(produit, { role: 'admin' }), produit);
});

test('la liste publique du code est exactement celle autorisée par le SQL', () => {
  const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '../supabase/A-EXECUTER-2026-09-26-catalogue-prix-prives.sql'), 'utf8');
  const bloc = sql.match(/GRANT SELECT \(([\s\S]+?)\) ON public\.products/)[1];
  assert.deepEqual(bloc.split(',').map((c) => c.trim()).sort(), [...COLONNES_PUBLIQUES].sort());
});

test('SQL : la clé publique ne lit plus le prix fournisseur', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  for (const f of ['A-EXECUTER-2026-09-25-audit-securite.sql', 'A-EXECUTER-2026-09-25-caisse-livreurs.sql', 'A-EXECUTER-2026-09-26-offres-remise.sql', 'A-EXECUTER-2026-09-26-devis.sql', 'A-EXECUTER-2026-09-26-prestations-etapes.sql']) await db.exec(sql(f));
  await db.exec(`INSERT INTO public.products (id, name, slug, category, supplier_id, stock, status, supplier_price, public_price)
    VALUES ('p1', '[TEST] Imprimante', 'test-imprimante', 'Informatique', 'f1', 3, 'approved', 100000, 130000)`);
  await db.exec(sql('A-EXECUTER-2026-09-26-catalogue-prix-prives.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-catalogue-prix-prives.sql')); // relançable
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT supplier_price FROM public.products'), /permission denied/);
  await assert.rejects(db.query('SELECT * FROM public.products'), /permission denied/);
  const r = await db.query(`SELECT ${COLONNES_PUBLIQUES.join(', ')} FROM public.products`);
  assert.equal(r.rows.length, 1, 'les colonnes publiques restent lisibles');
  await db.exec('RESET ROLE');
});
