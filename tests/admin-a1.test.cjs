// Poste de travail admin — A1 (2026-09-27) : menu par droits, file
// « À traiter » par métier, responsables, recherche globale.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const poste = require('../src/lib/admin/poste.ts');
const { permissionsDuRole } = require('../src/lib/reseau/permissions.ts');

test('métiers : chaque rôle d’équipe arrive sur son métier', () => {
  assert.equal(poste.metierDuRole('support'), 'support');
  assert.equal(poste.metierDuRole('finance'), 'finance');
  assert.equal(poste.metierDuRole('moderateur'), 'catalogue');
  assert.equal(poste.metierDuRole('responsable_fournisseurs'), 'catalogue');
  assert.equal(poste.metierDuRole('marketing'), 'marketing');
  assert.equal(poste.metierDuRole('responsable_livraison'), 'livraisons');
  assert.equal(poste.metierDuRole('super_admin'), 'direction');
});

test('menu : chaque entrée mène à une page qui existe', () => {
  for (const r of poste.RUBRIQUES) for (const e of r.entrees) {
    const chemin = e.href.split('#')[0].split('?')[0];
    const fichier = path.join(__dirname, '../src/app', chemin, 'page.tsx');
    assert.ok(existsSync(fichier), `${e.libelle} → ${chemin}`);
  }
  // ADM-11 (lot 6 de l'audit UI/UX) : « Plus » (17 entrées) scindé en « Campagnes » et « Réglages et équipe ».
  assert.equal(poste.RUBRIQUES.length, 7, 'sept destinations');
  for (const r of poste.RUBRIQUES) assert.ok(r.entrees.length <= 8, `${r.titre} : ${r.entrees.length} entrées`);
});

test('menu : filtré selon les droits, rubriques vides retirées', () => {
  const support = poste.rubriquesVisibles(permissionsDuRole('support'));
  const titres = support.map((r) => r.titre);
  assert.ok(titres.includes('Commandes'));
  assert.ok(!titres.includes('Finance'), 'le support ne voit pas la finance');
  assert.ok(!titres.includes('Équipe et sécurité'));
  assert.ok(support[0].entrees.some((e) => e.href === '/admin/a-traiter'), '« À traiter » pour tous');
  const tout = poste.rubriquesVisibles(permissionsDuRole('super_admin'));
  assert.equal(tout.length, 7);
  assert.deepEqual(poste.rubriquesVisibles([]), [], 'sans rôle d’équipe : aucun menu, seulement le message « demandez un rôle »');
});

test('menu : la permission affichée est celle du serveur pour la page', () => {
  const { PERMISSION_PAR_ROUTE } = require('../src/lib/reseau/permissions-routes.ts');
  const pages = { '/admin/sav': 'GET /api/admin/sav', '/admin/devis': 'GET /api/admin/devis', '/admin/messages': 'GET /api/admin/messages',
    '/admin/prestations': 'GET /api/admin/prestations', '/admin/caisse-livreurs': 'GET /api/admin/caisse-livreurs', '/admin/products': 'GET /api/admin/products',
    '/admin/resultats': 'GET /api/admin/resultats', '/admin/priorite-reseau': 'GET /api/admin/priorite-reseau', '/admin/recherche': 'GET /api/admin/recherche-synonymes' };
  for (const r of poste.RUBRIQUES) for (const e of r.entrees) {
    if (pages[e.href]) assert.equal(e.permission, PERMISSION_PAR_ROUTE[pages[e.href]], e.href);
  }
});

test('À traiter : droits, métier, responsable, plus anciens d’abord', () => {
  const t = (type, id, depuis) => ({ type, id, titre: id, detail: '', depuis, lien: '/admin' });
  const taches = [
    t('retrait_a_payer', 'r1', '2026-09-20T10:00:00Z'),
    t('commande_a_confirmer', 'c2', '2026-09-26T10:00:00Z'),
    t('commande_a_confirmer', 'c1', '2026-09-25T10:00:00Z'),
    t('produit_a_verifier', 'p1', '2026-09-24T10:00:00Z'),
  ];
  const affect = new Map([['commande_a_confirmer:c1', { id: 'm1', nom: 'Awa' }]]);
  const support = poste.preparerTaches(taches, permissionsDuRole('support'), affect, 'support');
  assert.deepEqual(support.map((x) => x.id), ['c1', 'c2'], 'le support ne voit ni retrait ni produit');
  assert.equal(support[0].responsable.nom, 'Awa');
  assert.equal(support[1].responsable, null);
  const tout = poste.preparerTaches(taches, permissionsDuRole('super_admin'), new Map(), 'direction');
  assert.deepEqual(tout.map((x) => x.id), ['r1', 'p1', 'c1', 'c2']);
  const finance = poste.preparerTaches(taches, permissionsDuRole('finance'), new Map(), 'toutes');
  assert.ok(!finance.some((x) => x.type === 'produit_a_verifier'), 'jamais une tâche sans la permission, même en « toutes »');
});

test('À traiter : une source en panne est signalée, jamais « rien à traiter »', async () => {
  const { chargerTaches } = require('../src/lib/admin/a-traiter.ts');
  const lecteurs = Object.fromEntries(Object.keys(poste.TACHES).map((k) => [k, async () => []]));
  lecteurs.commande_a_confirmer = async () => [{ type: 'commande_a_confirmer', id: 'c1', titre: 'x', detail: '', depuis: '2026-09-26T00:00:00Z', lien: '/' }];
  lecteurs.sav_ouvert = async () => { throw new Error('panne'); };
  let lus = 0;
  lecteurs.retrait_a_payer = async () => { lus += 1; return []; };
  const r = await chargerTaches({}, permissionsDuRole('support'), lecteurs);
  assert.equal(r.taches.length, 1);
  assert.deepEqual(r.indisponibles, ['Réclamation SAV']);
  assert.equal(lus, 0, 'une source non autorisée n’est même pas lue');
});

test('ancienneté et urgence', () => {
  const m = Date.parse('2026-09-27T12:00:00Z');
  assert.equal(poste.anciennete('2026-09-27T11:30:00Z', m), 'il y a 30 min');
  assert.equal(poste.anciennete('2026-09-27T02:00:00Z', m), 'il y a 10 h');
  assert.equal(poste.anciennete('2026-09-24T12:00:00Z', m), 'il y a 3 j');
  assert.equal(poste.urgence('2026-09-27T11:00:00Z', m), 'normale');
  assert.equal(poste.urgence('2026-09-27T06:00:00Z', m), 'a_surveiller');
  assert.equal(poste.urgence('2026-09-26T06:00:00Z', m), 'en_retard');
});

test('recherche globale : motif sûr, groupes filtrés par droit', () => {
  assert.equal(poste.motifRecherche('a'), null);
  assert.equal(poste.motifRecherche('SG-10%'), '%SG-10\\%%');
  assert.equal(poste.motifRecherche('a,b(c)'), '%a b c%');
  const src = readFileSync(require.resolve('../src/app/api/admin/recherche-globale/route.ts'), 'utf8');
  assert.match(src, /GROUPES_RECHERCHE\.filter\(\(g\) => permissions\.includes\(g\.permission\)\)/);
});

test('boutique Suguba : ouvrir la page ne la crée plus', () => {
  const src = readFileSync(require.resolve('../src/app/api/admin/boutique-suguba/route.ts'), 'utf8');
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'));
  assert.match(get, /boutiqueSuguba\(false\)/);
  assert.doesNotMatch(get, /boutiqueSuguba\(true\)/);
});

test('SQL A1 : responsable par dossier, clé contrôlée, relançable', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a1.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a1.sql'));
  await db.exec(`INSERT INTO public.profiles (id, full_name, role) VALUES ('m1', '[TEST] Awa', 'admin')`);
  await db.exec(`INSERT INTO public.admin_affectations (dossier, membre_id) VALUES ('commande_a_confirmer:abc-1', 'm1')`);
  await assert.rejects(db.exec(`INSERT INTO public.admin_affectations (dossier, membre_id) VALUES ('pas une clé', 'm1')`));
  await assert.rejects(db.exec(`INSERT INTO public.admin_affectations (dossier, membre_id) VALUES ('commande_a_confirmer:abc-1', 'm1')`), 'un seul responsable');
});
