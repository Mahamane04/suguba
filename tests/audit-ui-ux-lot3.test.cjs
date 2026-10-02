// TEST-UX-COMPOSANTS-001..009 (audit UI/UX du 2026-10-02, lot 3 « les composants ») :
// bouton avec chargement, partage WhatsApp unique, pastilles adoucies, écran vide avec
// « Réessayer », colonne d'action collante, gestes clés au bouton commun, cibles de 40 px.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const rendre = (composant, props, ...enfants) => renderToStaticMarkup(React.createElement(composant, props, ...enfants));

test('Button : « loading » garde le libellé (invisible), bloque le double appui et l’annonce', () => {
  const Button = require('../src/components/ui/Button.tsx').default;
  const html = rendre(Button, { loading: true, type: 'button' }, 'Payer 6 000 F');
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /<span class="invisible[^"]*">Payer 6 000 F<\/span>/);
  const normal = rendre(Button, { type: 'button' }, 'Payer');
  assert.doesNotMatch(normal, /aria-busy=|disabled=""/);
});

test('REV-03 : un seul bouton de partage WhatsApp, vert WhatsApp, logo, nouvel onglet pour un lien', () => {
  const Bouton = require('../src/components/ui/BoutonPartageWhatsApp.tsx').default;
  const html = rendre(Bouton, { href: 'https://api.whatsapp.com/send?text=x' });
  assert.match(html, /bg-suguba-wa/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /Partager sur WhatsApp/);
  for (const f of ['src/components/product/ProductCard.tsx', 'src/app/reseller/page.tsx', 'src/components/reseau/CarteLien.tsx', 'src/app/reseller/badge/page.tsx']) {
    const src = lire(f);
    assert.match(src, /<BoutonPartageWhatsApp/, f);
    assert.doesNotMatch(src, /hover:bg-\[#(1fbf5b|20bd5a)\]/, `${f} : bouton de partage fait main restant`);
  }
});

test('ADM-04 : « succès » n’est plus un vert vif plein ; « attente » se voit', () => {
  const { StatusPill } = require('../src/components/ui/Surface.tsx');
  const succes = rendre(StatusPill, { ton: 'succes' }, 'Livrée');
  assert.match(succes, /bg-suguba-menthe/);
  assert.doesNotMatch(succes, /bg-suguba-brand /);
  assert.match(succes, /before:bg-suguba-brand/, 'la marque reste sur le point');
  assert.match(rendre(StatusPill, { ton: 'attente' }, 'À confirmer'), /bg-amber-50/);
});

test('FOU-07 / ADM-09 : un seul écran vide, avec une variante erreur et « Réessayer »', () => {
  const { EmptyState } = require('../src/components/ui/Surface.tsx');
  const html = rendre(EmptyState, { erreur: true, titre: 'Connexion impossible', onReessayer: () => {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /Réessayer/);
  const ancien = require('../src/components/ui/EmptyState.tsx').default;
  const Package = require('lucide-react').Package;
  const htmlAncien = rendre(ancien, { icon: Package, title: 'Rien', action: { label: 'Voir', href: '/' } });
  assert.doesNotMatch(htmlAncien, /bg-slate-900/, 'plus de bouton noir hors charte');
  assert.match(htmlAncien, /bg-suguba-profond/);
  const fournisseur = lire('src/app/supplier/page.tsx');
  assert.match(fournisseur, /if \(!res\.ok\) throw/);
  assert.match(fournisseur, /onReessayer=/);
  assert.match(lire('src/app/supplier/commandes/page.tsx'), /titre="Commandes indisponibles"[^/]*onReessayer=/);
});

test('ADM-01 / ADM-12 : colonne d’action collante, montants insécables, pas de bande vide', () => {
  const src = lire('src/components/admin/TableauAdmin.tsx');
  assert.match(src, /const collante = \(c: Colonne<T>, i: number\) => Boolean\(c\.fixe && c\.droite && i === affichees\.length - 1\)/);
  assert.match(src, /sticky right-0/);
  assert.match(src, /text-right tabular-nums whitespace-nowrap/);
  assert.doesNotMatch(src, /justify-between gap-2 min-h-\[40px\]">/);
});

test('ADM-08 : les gestes clés de l’équipe passent par le bouton commun', () => {
  assert.doesNotMatch(lire('src/app/admin/products/new/page.tsx'), /bg-slate-700/);
  const prix = lire('src/components/admin/ProductPricingModal.tsx');
  assert.doesNotMatch(prix, /bg-gradient-to-r from-slate-800/);
  assert.doesNotMatch(prix, /bg-slate-700/);
  const livreurs = lire('src/components/admin/DriverVerificationPanel.tsx');
  assert.doesNotMatch(livreurs, /bg-slate-900/);
  assert.match(livreurs, /loading=\{enCours === l\.id\}/);
});

test('REV-07 : plus de boutons de 32–36 px sur les cartes produit', () => {
  assert.doesNotMatch(lire('src/components/product/ProductCard.tsx'), /!h-9|\bh-9 w-9\b/);
  assert.doesNotMatch(lire('src/app/reseller/catalog/page.tsx'), /className="h-8 /);
});

test('FOU-03 : la pastille de statut ne partage plus la ligne du titre', () => {
  const src = lire('src/app/supplier/commandes/page.tsx');
  assert.match(src, /<div className="min-w-0 flex-1 space-y-0\.5">\s*<StatusPill ton=\{e\.ton\}>/);
});

test('LigneListe : montant insécable ; utilisée par les listes du livreur', () => {
  const LigneListe = require('../src/components/ui/LigneListe.tsx').default;
  const html = rendre(LigneListe, { titre: 'Ventilateur', valeur: '24 950 F', statut: 'Payé en ligne' });
  assert.match(html, /whitespace-nowrap">24 950 F/);
  assert.match(html, /min-w-0 flex-1/);
  for (const f of ['src/app/driver/page.tsx', 'src/app/driver/earnings/page.tsx']) assert.match(lire(f), /<LigneListe /, f);
});
