// Admin A4 (2026-09-27) : listes professionnelles — filtres serveur,
// colonnes, vues enregistrées, export CSV contrôlé, actions groupées.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const t = require('../src/lib/admin/tableau.ts');

test('filtres : seules les valeurs connues passent, texte assaini', () => {
  const f = t.lireFiltres(new URLSearchParams('q=frigo,(x)%&statut=approved&tri=supplier_name&sens=asc&sansPhoto=1'));
  assert.equal(f.q, 'frigo x');
  assert.equal(f.statut, 'approved');
  assert.equal(f.tri, 'supplier_name');
  assert.equal(f.sens, 'asc');
  assert.equal(f.sansPhoto, true);
  const piege = t.lireFiltres({ statut: 'archived', tri: 'supplier_price', sens: 'n’importe' });
  assert.equal(piege.statut, '', 'statut inconnu ignoré');
  assert.equal(piege.tri, 'created_at', 'tri sur une colonne non prévue (prix fournisseur) refusé');
  assert.equal(piege.sens, 'desc');
});

test('colonnes : liste blanche, défaut si vide', () => {
  assert.deepEqual(t.colonnesValides(['nom', 'prix', 'supplier_price', 'prix']), ['nom', 'prix']);
  assert.ok(t.colonnesValides(null).includes('nom'));
  assert.ok(!t.colonnesValides(null).includes('photos'), 'photos masquée par défaut');
});

test('CSV : formules neutralisées, séparateurs échappés, accents conservés', () => {
  assert.equal(t.celluleCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(t.celluleCsv('+22370000000'), "'+22370000000");
  assert.equal(t.celluleCsv('-5'), "'-5");
  assert.equal(t.celluleCsv('a;b'), '"a;b"');
  assert.equal(t.celluleCsv(null), '');
  const csv = t.construireCsv(['Produit', 'Prix'], [['Réfrigérateur', 150000]]);
  assert.ok(csv.startsWith('﻿'), 'BOM pour Excel');
  assert.equal(csv.slice(1), 'Produit;Prix\r\nRéfrigérateur;150000');
});

test('actions groupées : aperçu avec exclusions expliquées, rien de modifié', () => {
  const produits = [
    { id: 'p1', nom: 'Frigo', statut: 'approved', categorie: 'Froid', uniteVente: null, typeOffre: 'produit' },
    { id: 'p2', nom: 'Clim', statut: 'approved', categorie: 'Électroménager', uniteVente: 'unite', typeOffre: 'produit' },
    { id: 'p3', nom: 'Vieux', statut: 'archived', categorie: 'Froid' },
    { id: 'p4', nom: 'Pose', statut: 'approved', categorie: 'Services', typeOffre: 'service' },
  ];
  const cat = t.apercuAction(produits, 'categorie', 'Électroménager');
  assert.deepEqual(cat.concernes.map((c) => c.id), ['p1', 'p4']);
  assert.deepEqual(cat.exclus.map((x) => [x.id, x.raison]), [['p2', 'Déjà dans cette catégorie'], ['p3', 'Produit archivé']]);
  assert.match(t.apercuAction(produits, 'categorie', 'x').erreur, /2 caractères/);
  const u = t.apercuAction(produits, 'unite', { unite: 'lot', contenu: '4' });
  assert.deepEqual(u.concernes.map((c) => c.id), ['p1', 'p2']);
  assert.equal(u.concernes[0].apres, 'lot de 4');
  assert.ok(u.exclus.some((x) => x.id === 'p4' && /Service/.test(x.raison)));
  assert.match(t.apercuAction(produits, 'unite', { unite: 'lot' }).erreur, /lot/);
});

test('export : droit dédié, réservé au Super Admin par défaut, sans coordonnées de client', () => {
  const { PERMISSION_PAR_ROUTE } = require('../src/lib/reseau/permissions-routes.ts');
  const { permissionsDuRole, ROLES_EQUIPE } = require('../src/lib/reseau/permissions.ts');
  assert.equal(PERMISSION_PAR_ROUTE['GET /api/admin/export'], 'donnees.exporter');
  assert.ok(permissionsDuRole('super_admin').includes('donnees.exporter'));
  for (const r of ROLES_EQUIPE.filter((x) => x.valeur !== 'super_admin')) assert.ok(!permissionsDuRole(r.valeur).includes('donnees.exporter'), r.valeur);
  const src = readFileSync(require.resolve('../src/app/api/admin/export/route.ts'), 'utf8');
  assert.doesNotMatch(src, /customer_phone|customer_name|landmark/, 'jamais le téléphone, le nom ou le repère du client');
  assert.match(src, /journaliserAction\(/, 'chaque export est journalisé');
});

test('actions groupées : aperçu obligatoire, plafond, pas de prix ni de suppression', () => {
  const src = readFileSync(require.resolve('../src/app/api/admin/produits-groupes/route.ts'), 'utf8');
  assert.match(src, /corps\.confirmer !== true\) return NextResponse\.json\(\{ apercu \}\)/);
  assert.match(src, /MAX_GROUPE/);
  assert.doesNotMatch(src, /public_price|supplier_price|\.delete\(/);
  const { PERMISSION_PAR_ROUTE } = require('../src/lib/reseau/permissions-routes.ts');
  assert.equal(PERMISSION_PAR_ROUTE['POST /api/admin/produits-groupes'], 'produit.moderer');
});

test('SQL A4 : vues propres à chaque membre, nom unique par liste', async () => {
  const { database, sql } = require('./helpers/audit-db.cjs');
  const db = await database();
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a4.sql'));
  await db.exec(sql('A-EXECUTER-2026-09-27-admin-a4.sql'));
  await db.exec(`INSERT INTO public.profiles (id, full_name, role) VALUES ('m1', '[TEST] Awa', 'admin')`);
  await db.exec(`INSERT INTO public.vues_admin (membre_id, page, nom, config) VALUES ('m1', 'catalogue', 'Sans unité', '{"filtres":{"sansUnite":true}}')`);
  await assert.rejects(db.exec(`INSERT INTO public.vues_admin (membre_id, page, nom) VALUES ('m1', 'catalogue', 'Sans unité')`), 'nom unique');
  await assert.rejects(db.exec(`INSERT INTO public.vues_admin (membre_id, page, nom) VALUES ('m1', 'Catalogue!', 'x')`), 'page contrôlée');
  const src = readFileSync(require.resolve('../src/app/api/admin/vues/route.ts'), 'utf8');
  assert.match(src, /\.eq\('id', id\)\.eq\('membre_id', session!\.uid\)/, 'on ne retire que ses propres vues');
});
