// TEST-UX-FOND-001..010 (audit UI/UX du 2026-10-02, lot 6 « le fond ») :
// création d'offre allégée, inventaire sans appel réseau par appui, journal
// lisible, menu de l'équipe sans fourre-tout, une seule façon d'enregistrer,
// une seule coquille et une typographie plus calme.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rendre = (composant, props, ...enfants) => renderToStaticMarkup(React.createElement(composant, props, ...enfants));

test('FOU-04 : remise et commande repliées derrière un résumé ; libellés en casse de phrase', () => {
  const src = sansCommentaires(lire('src/app/supplier/products/new/page.tsx'));
  assert.match(src, /<details open=\{!reglagesParDefaut \|\| undefined\}/);
  assert.match(src, /Remise et commande/);
  assert.match(src, /Étape \{step \+ 1\} sur 4/);
  assert.doesNotMatch(src, /Nom du Produit|Description Détaillée|Prix Fournisseur Plancher Garanti|Quantité en Stock Réel/);
  assert.match(src, /<PageReseau/);
});

test('FOU-05 : tout est remis à zéro, une action principale, pas de « 0 F » de part en prix de gros', () => {
  const src = sansCommentaires(lire('src/app/supplier/products/new/page.tsx'));
  const reset = src.slice(src.indexOf('const reinitialiser'), src.indexOf('const reglagesParDefaut'));
  for (const f of ['setSupplierPrice', 'setStockQuantity', 'setPartRevendeur', 'setModePrix', 'setTypeOffre', 'setModeRemise', 'setModeCommande', 'setEtapes', 'setSaisieUnite', 'setStep(0)']) {
    assert.ok(reset.includes(f), `remise à zéro : ${f}`);
  }
  assert.match(src, /modePrix === 'fixe' \? \[\['Part du revendeur'/);
  assert.match(src, /<Button onClick=\{reinitialiser\}>Ajouter une autre offre<\/Button>/);
});

test('FOU-06 : l’inventaire montre le prix, ne part au serveur qu’à « Enregistrer », range le reste dans « Plus »', () => {
  const src = sansCommentaires(lire('src/app/supplier/inventory/page.tsx'));
  assert.match(src, /Vous touchez <strong/);
  assert.doesNotMatch(src.slice(src.indexOf('const ajuster'), src.indexOf('const enregistrerStock')), /fetch\(/, '− et + ne changent que l’écran');
  assert.match(src, /Enregistrer \{quantite\}/);
  assert.match(src, /<details className="group">[\s\S]{0,400}Plus/);
  assert.doesNotMatch(src, /Confirmer le stock/);
});

test('ADM-07 : le journal parle français, sans code de route ni JSON', () => {
  const { libelleAction, libelleDossier, detailsLisibles } = require('../src/lib/admin/libelles-journal.ts');
  assert.equal(libelleAction('POST /api/admin/products/price'), 'Prix d’un produit fixé');
  assert.equal(libelleAction('POST /api/admin/payouts'), 'Retrait traité');
  assert.equal(libelleAction('connexion'), 'Connexion à l’espace équipe');
  assert.equal(libelleAction('DELETE /api/admin/vues'), 'Vue enregistrée modifiée (suppression)');
  assert.match(libelleAction('export.commandes'), /^Export commandes/);
  assert.equal(libelleAction('POST /api/admin/inconnu'), 'Autre action de l’équipe');
  assert.equal(libelleDossier('payouts:7f3c2a90-1111-2222-3333-444455556666'), 'Retrait 7f3c2a90…');
  assert.equal(libelleDossier(null), '—');
  const d = detailsLisibles({ productId: 'abc', publicPrice: 24000, motif: 'test', actif: true });
  assert.deepEqual(d.map((x) => x.libelle), ['Prix client', 'Motif', 'Actif']);
  assert.equal(d[0].valeur, '24 000 F');
  const page = sansCommentaires(lire('src/app/admin/journal/page.tsx'));
  assert.doesNotMatch(page, /JSON\.stringify|<table/);
  assert.match(page, /aria-expanded=\{ouvert\}/);
  assert.doesNotMatch(lire('src/app/admin/validations/page.tsx'), /dossier <code>/);
});

test('ADM-11 : sept destinations, aucune au-delà de 8 entrées, plus de « Plus » ; les pages sans entrée allument leur rubrique', () => {
  const { RUBRIQUES, entreeActive, cheminDuMenu } = require('../src/lib/admin/poste.ts');
  assert.ok(!RUBRIQUES.some((r) => r.titre === 'Plus'));
  for (const r of RUBRIQUES) assert.ok(r.entrees.length <= 8 && r.entrees.every(Boolean), r.titre);
  assert.equal(cheminDuMenu('/admin/products/new'), '/admin/catalogue');
  assert.ok(entreeActive('/admin/catalogue', '/admin/products'));
  assert.ok(entreeActive('/admin/retraits', '/admin/retraits/abc'));
  assert.ok(!entreeActive('/admin', '/admin/retraits'));
  const hrefs = RUBRIQUES.flatMap((r) => r.entrees.map((e) => e.href));
  assert.ok(hrefs.includes('/admin/boutique-suguba'), 'Boutique Suguba retrouve son entrée');
  assert.ok(!hrefs.includes('/admin/simulateur'), 'plus de raccourci qui redirige');
  assert.match(lire('src/components/admin/PosteAdmin.tsx'), /const estActive = entreeActive;/);
});

test('ADM-13 : une seule barre d’enregistrement pour les réglages', () => {
  const Barre = require('../src/components/ui/BarreEnregistrement.tsx').default;
  assert.equal(rendre(Barre, { modifie: false, onEnregistrer: () => {} }), '', 'rien à dire : pas de barre');
  const html = rendre(Barre, { modifie: true, onEnregistrer: () => {}, onAnnuler: () => {} });
  assert.match(html, /Non enregistré/);
  assert.match(html, /Annuler/);
  assert.match(rendre(Barre, { modifie: true, bloque: true, onEnregistrer: () => {} }), /disabled=""/);
  for (const f of ['src/components/admin/EconomicSettingsPanel.tsx', 'src/app/admin/accueil/page.tsx', 'src/app/admin/priorite-reseau/page.tsx', 'src/app/admin/securite/page.tsx']) {
    assert.match(lire(f), /<BarreEnregistrement/, f);
  }
  assert.doesNotMatch(lire('src/app/admin/securite/page.tsx'), /onClick=\{enregistrer\} disabled=\{envoi\}>Enregistrer/);
});

test('ADM-14 / REV-15 : tuile commune, libellés calmes, en-tête de page à 14 px', () => {
  const { StatCard, PageHeader } = require('../src/components/ui/Surface.tsx');
  const tuile = rendre(StatCard, { label: 'En retard', valeur: 3, alerte: true });
  assert.match(tuile, /bg-amber-50/);
  assert.doesNotMatch(tuile, /uppercase/);
  assert.match(rendre(PageHeader, { titre: 'X', sousTitre: 'Y', retour: { href: '/', libelle: 'Retour' } }), /text-sm text-slate-600 mt-0\.5/);
  assert.doesNotMatch(lire('src/app/admin/caisse-livreurs/page.tsx'), /bg-slate-900 text-white space-y-1/);
  // Plus aucun petit libellé en capitales grasses dans l'application.
  const fichiers = [];
  const parcourir = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) parcourir(p); else if (p.endsWith('.tsx')) fichiers.push(p); } };
  parcourir(path.join(__dirname, '..', 'src'));
  const fautifs = fichiers.filter((f) => /className="[^"]*\btext-xs\b[^"]*\bfont-bold\b[^"]*\buppercase\b/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(fautifs.map((f) => path.relative(path.join(__dirname, '..'), f)), []);
});

test('REV-14 : les pages de l’ancienne génération passent par la coquille commune', () => {
  for (const f of ['src/app/reseller/orders/page.tsx', 'src/app/reseller/payouts/page.tsx', 'src/app/reseller/calculator/page.tsx', 'src/app/reseller/catalog/page.tsx',
    'src/app/supplier/paiements/page.tsx', 'src/app/supplier/inventory/page.tsx', 'src/app/supplier/products/new/page.tsx', 'src/app/driver/earnings/page.tsx', 'src/app/driver/aide/page.tsx']) {
    const src = lire(f);
    assert.match(src, /<PageReseau/, f);
    assert.doesNotMatch(src, /import Header from/, f);
  }
  assert.match(lire('src/app/driver/earnings/page.tsx'), /bg-suguba-profond border-suguba-profond/, 'plus de tuile noire');
});

test('LIV-05 : l’aide livreur a des champs étiquetés et un recours sans course', () => {
  const src = sansCommentaires(lire('src/app/driver/aide/page.tsx'));
  assert.match(src, /titre="Aucune course en cours"/);
  assert.match(src, /getSupportChatLink\(\)/);
  assert.match(src, /<Field label="Course"/);
  assert.match(src, /loading=\{busy\}/);
});

test('REV-15 : accueil revendeur — les explications passent en 14 px', () => {
  const src = lire('src/app/reseller/page.tsx');
  assert.ok((src.match(/text-sm/g) || []).length > (src.match(/text-xs/g) || []).length);
  assert.doesNotMatch(lire('src/app/reseller/orders/page.tsx'), /'bg-slate-900 text-white'/);
});
