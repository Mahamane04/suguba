// Compte client — C2 (2026-09-26) : favoris et destinataires enregistrés.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const compte = require('../src/lib/compte-client.ts');

function base(tables) {
  return {
    from(nom) {
      tables[nom] ||= [];
      let lignes = tables[nom];
      const q = {
        select() { return q; },
        eq(c, v) { lignes = lignes.filter((l) => l[c] === v); return q; },
        in(c, vs) { lignes = lignes.filter((l) => vs.includes(l[c])); return q; },
        order() { return q; },
        limit() { return q; },
        maybeSingle: async () => ({ data: lignes[0] ? { ...lignes[0] } : null, error: null }),
        then(ok, ko) { return Promise.resolve({ data: lignes.map((l) => ({ ...l })), error: null }).then(ok, ko); },
      };
      return q;
    },
  };
}

test('destinataire : nom et numéro obligatoires, texte nettoyé', () => {
  const d = compte.normaliserDestinataire({ nom: '  Aminata   Diarra ', telephone: '70 12-34-56', quartier: 'ACI 2000', relation: 'Maman' });
  assert.equal(d.nom, 'Aminata Diarra');
  assert.equal(d.telephone, '70123456');
  assert.equal(d.ville, 'Bamako');
  assert.equal(d.quartier, 'ACI 2000');
  assert.equal(d.repere, null);
  assert.throws(() => compte.normaliserDestinataire({ nom: 'A', telephone: '70123456' }), /nom/);
  assert.throws(() => compte.normaliserDestinataire({ nom: 'Awa', telephone: '1234' }), /numéro/);
  assert.equal(compte.normaliserDestinataire({ nom: 'Awa', telephone: '+33 6 12 34 56 78' }).telephone, '+33612345678', 'numéro étranger (diaspora)');
});

test('favoris : jamais le prix conseillé d’un article au prix de gros, disponibilité du jour', async () => {
  const t = {
    favoris: [{ profile_id: 'c1', product_id: 'p1' }, { profile_id: 'c1', product_id: 'p2' }, { profile_id: 'c1', product_id: 'p3' }, { profile_id: 'c2', product_id: 'p1' }],
    products: [
      { id: 'p1', name: 'TV', slug: 'tv', images: ['a.jpg'], public_price: 150000, status: 'approved', stock: 3, mode_prix: 'fixe', supplier_price: 100000 },
      { id: 'p2', name: 'Riz', slug: 'riz', images: [], public_price: 20000, status: 'approved', stock: 5, mode_prix: 'gros', supplier_price: 15000 },
      { id: 'p3', name: 'Radio', slug: 'radio', images: [], public_price: 9000, status: 'approved', stock: 0, mode_prix: 'fixe', supplier_price: 6000 },
    ],
  };
  const { favoris } = await compte.mesFavoris(base(t), 'c1');
  assert.equal(favoris.length, 3, 'seulement les favoris de ce compte');
  const par = Object.fromEntries(favoris.map((f) => [f.id, f]));
  assert.equal(par.p1.prix, 150000);
  assert.equal(par.p2.prix, null, 'prix de gros : le prix dépend du revendeur');
  assert.equal(par.p3.disponible, false, 'plus de stock');
  assert.equal(JSON.stringify(favoris).includes('100000'), false, 'aucun prix fournisseur');
});

test('SQL : favori unique par compte, destinataire contrôlé', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-26-compte-client-c2.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-26-compte-client-c2.sql'));
  await db.exec(`INSERT INTO public.favoris (profile_id, product_id) VALUES ('c1', 'p1')`);
  await assert.rejects(db.exec(`INSERT INTO public.favoris (profile_id, product_id) VALUES ('c1', 'p1')`));
  await db.exec(`INSERT INTO public.destinataires (profile_id, nom, telephone) VALUES ('c1', 'Aminata', '70123456')`);
  await assert.rejects(db.exec(`INSERT INTO public.destinataires (profile_id, nom, telephone) VALUES ('c1', 'A', '70123456')`), 'nom trop court');
  await assert.rejects(db.exec(`INSERT INTO public.destinataires (profile_id, nom, telephone) VALUES ('c1', 'Awa', '123')`), 'numéro trop court');
});
