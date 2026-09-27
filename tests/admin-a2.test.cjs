// Admin A2 (2026-09-27) : journal général non modifiable, notes internes,
// alerte de modification concurrente.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

test('journal : secrets masqués, textes longs tronqués', () => {
  const { nettoyerDetails } = require('../src/lib/admin/journal.ts');
  const r = nettoyerDetails({ montant: 5000, delivery_otp: '1234', password: 'x', token: 'y', note: 'a'.repeat(400) });
  assert.equal(r.montant, 5000);
  assert.equal(r.delivery_otp, '[masqué]');
  assert.equal(r.password, '[masqué]');
  assert.equal(r.token, '[masqué]');
  assert.equal(r.note.length, 301);
  assert.equal(nettoyerDetails(null), null);
});

test('journal automatique : dossier, motif et résumé déduits de la requête', () => {
  const j = require('../src/lib/admin/journal-route.ts');
  const p = new URLSearchParams('id=abc');
  assert.equal(j.typeDepuisCle('POST /api/admin/products/price'), 'products/price');
  assert.equal(j.extraireDossier('POST /api/admin/payouts', { payoutId: 'p1' }, new URLSearchParams()), 'payouts:p1');
  assert.equal(j.extraireDossier('DELETE /api/admin/recherche-synonymes', null, p), 'recherche-synonymes:abc');
  assert.equal(j.extraireDossier('POST /api/admin/caisse-livreurs', { driverId: 'd1', orderIds: ['o1'] }, new URLSearchParams()), 'caisse-livreurs:d1');
  assert.equal(j.extraireDossier('POST /api/admin/caisse-livreurs', { orderIds: ['o1', 'o2'] }, new URLSearchParams()), 'caisse-livreurs:o1,o2');
  assert.equal(j.extraireDossier('POST /api/admin/x', { dossier: 'commande_a_confirmer:c1' }, new URLSearchParams()), 'commande_a_confirmer:c1');
  assert.equal(j.extraireMotif({ motif: '  Client absent  ' }), 'Client absent');
  assert.deepEqual(j.resumeCorps({ a: 1, b: 'x', c: [1, 2], d: { e: 1 } }), { a: 1, b: 'x', c: '[2 éléments]', d: '{…}' });
});

test('chaque action admin (POST/PUT/PATCH/suppression) est journalisée', () => {
  const racine = path.join(__dirname, '../src/app/api/admin');
  const oublis = [];
  const parcourir = (d) => {
    for (const nom of readdirSync(d)) {
      const plein = path.join(d, nom);
      if (statSync(plein).isDirectory()) parcourir(plein);
      else if (nom === 'route.ts') {
        const chemin = '/api/admin/' + path.relative(racine, d).split(path.sep).join('/');
        const src = readFileSync(plein, 'utf8');
        for (const [, m] of src.matchAll(/export async function (POST|PUT|PATCH|DELETE)\(/g)) {
          if (chemin === '/api/admin/affectations' || chemin === '/api/admin/notes') {
            if (!src.includes('journaliserAction(')) oublis.push(`${m} ${chemin}`);
          } else if (!src.includes(`avecJournal(req, '${m} ${chemin}'`)) oublis.push(`${m} ${chemin}`);
        }
      }
    }
  };
  parcourir(racine);
  assert.deepEqual(oublis, [], 'Actions admin non journalisées :\n' + oublis.join('\n'));
});

test('SQL A2 : journal et notes non modifiables, relançable', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a2.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a2.sql'));
  await db.exec(`INSERT INTO public.journal_admin (auteur_id, action, dossier, apres) VALUES ('m1', 'POST /api/admin/payouts', 'payouts:p1', '{"montant": 5000}')`);
  await assert.rejects(db.exec(`UPDATE public.journal_admin SET action = 'autre'`), /TRACE_NON_MODIFIABLE/);
  await assert.rejects(db.exec(['DEL', 'ETE FROM public.journal_admin'].join('')), /TRACE_NON_MODIFIABLE/);
  await db.exec(`INSERT INTO public.notes_internes (dossier, auteur_id, texte) VALUES ('sav_ouvert:t1', 'm1', 'Client rappelé')`);
  await assert.rejects(db.exec(`UPDATE public.notes_internes SET texte = 'effacé'`), /TRACE_NON_MODIFIABLE/);
  await assert.rejects(db.exec(['DEL', 'ETE FROM public.notes_internes'].join('')), /TRACE_NON_MODIFIABLE/);
  await assert.rejects(db.exec(`INSERT INTO public.notes_internes (dossier, auteur_id, texte) VALUES ('sav_ouvert:t1', 'm1', '   ')`), 'note vide');
});

test('affectation : un changement concurrent d’un collègue n’est pas écrasé', () => {
  const src = readFileSync(require.resolve('../src/app/api/admin/affectations/route.ts'), 'utf8');
  assert.match(src, /versionVue/);
  assert.match(src, /conflit: true/);
  assert.match(src, /status: 409/);
  const page = readFileSync(require.resolve('../src/app/admin/a-traiter/page.tsx'), 'utf8');
  assert.match(page, /versionVue: t\.version/);
});

test('journal : lecture réservée à la gestion de l’équipe', () => {
  const { PERMISSION_PAR_ROUTE } = require('../src/lib/reseau/permissions-routes.ts');
  assert.equal(PERMISSION_PAR_ROUTE['GET /api/admin/journal'], 'plateforme.equipe');
});
