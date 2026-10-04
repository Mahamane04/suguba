// Chantier boutique revendeur — défauts vus À L'ÉCRAN (2026-10-03) sur la copie
// locale isolée, à 390 px, après les 8 lots (aucun n'avait été ouvert dans un
// navigateur) : logo caché par la couverture, rond de partage rogné, état de la
// barre d'enregistrement rogné, adresse coupée en plein mot, date peu lisible.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('Accueil revendeur : le logo de la carte « Ma boutique » passe au-dessus de la couverture', () => {
  const src = lire('src/app/reseller/page.tsx');
  // La couverture est positionnée : sans « relative », elle recouvrait la moitié du logo.
  assert.equal((src.match(/className="relative -mt-7 w-14 h-14 /g) || []).length, 2, 'logo et initiale');
  assert.doesNotMatch(src, /className="-mt-7 w-14 h-14 /);
});

test('Carte produit étroite : le rond de partage n’est plus rogné (requête de conteneur)', () => {
  const carte = lire('src/components/product/ProductCard.tsx');
  // Relecture finale (2026-10-04) : la RANGÉE des deux boutons se mesure, plus la
  // carte. container-type sur l'<article> enfermait dans la carte la fenêtre
  // « Affiche pour mon statut » (fixed, sans portail) sur les navigateurs d'avant
  // fin 2024 (Chrome ≤ 128, Safari iOS 16-17).
  const article = carte.match(/<article\s+className="([^"]*)"/);
  assert.ok(article, 'la carte reste un <article>');
  assert.doesNotMatch(article[1], /carte-produit/, 'jamais sur la carte : elle contient une fenêtre en position fixe');
  assert.match(article[1], /^bg-white rounded-3xl overflow-hidden /);
  assert.equal((carte.match(/className="[^"]*\bcarte-produit\b[^"]*"/g) || []).length, 1, 'un seul élément mesuré');
  assert.match(carte, /<div className="carte-produit flex items-center gap-2">\s*\{produit\.ajoutDirect \? \(/, 'la rangée « bouton principal + rond de partage »');
  assert.equal((carte.match(/className="bouton-ajout flex-1 min-w-0"/g) || []).length, 2, '« Ajouter » et « Acheter »');
  assert.equal((carte.match(/className="icone-ajout w-4 h-4"/g) || []).length, 2, 'les deux icônes du bouton');
  const css = lire('src/app/globals.css');
  assert.match(css, /\.carte-produit \{ container-type: inline-size; \}/);
  // La rangée mesure 26 px de moins que la carte : même seuil qu'avant (175 px de carte).
  assert.match(css, /@container \(max-width: 151px\) \{\s*\.carte-produit \.icone-ajout \{ display: none; \}/);
  assert.doesNotMatch(css, /@container \(max-width: 175px\)/);
  assert.equal((css.match(/container-type\s*:/g) || []).length, 1, 'aucun autre élément mesuré dans la feuille de style');
  // Les rayons de la vitrine gagnent 8 px de large sur téléphone.
  const rayons = lire('src/components/shop/BoutiqueProduits.tsx');
  assert.doesNotMatch(rayons, /px-4 sm:px-5/);
  assert.ok((rayons.match(/px-3 sm:px-5/g) || []).length >= 3);
});

test('Personnaliser : l’adresse a deux tiers de la ligne et se coupe après un « / », jamais en plein mot', () => {
  const src = lire('src/app/reseller/boutique/page.tsx');
  assert.match(src, /<div className="grid grid-cols-3 gap-3">\s*<StatCard label="Abonnés"/);
  assert.match(src, /<div className="col-span-2 grid">\s*<StatCard label="Adresse"/);
  assert.match(src, /\/<wbr \/>boutique\/<wbr \/>\{boutique\.slug\}/);
  assert.doesNotMatch(src, /break-all">\{origine/);
});

test('Notifications : la date n’est plus en gris clair (contraste insuffisant)', () => {
  const src = lire('src/app/notifications/page.tsx');
  assert.match(src, /<p className="text-xs text-slate-600 mt-1">\{quand\(n\.creeLe\)\}<\/p>/);
});
