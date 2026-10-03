// TEST-UX-QUARTIER-001..002 (2026-10-03) : « Mon quartier » de l'accueil et de
// /boutiques devient une seule pilule (repère citron, quartier en gras,
// localisation rangée dedans), de la même forme que « Boutiques ».
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const Choice = require('../src/components/ui/ChoicePicker.tsx').default;
const choix = [{ valeur: 'Banconi', libelle: 'Banconi' }];

test('ChoicePicker : le champ par défaut ne change pas ; « nu » laisse l’appelant dessiner le déclencheur', () => {
  const champ = renderToStaticMarkup(React.createElement(Choice, { valeur: '', choix, onChange: () => {} }));
  assert.match(champ, /rounded-2xl px-3\.5/);
  const nu = renderToStaticMarkup(React.createElement(Choice, {
    nu: true, valeur: 'Banconi', choix, onChange: () => {}, listeClassName: 'min-w-[16rem]',
    rendu: (s, ouvert) => React.createElement('b', null, `${s.libelle}:${ouvert}`),
  }));
  assert.doesNotMatch(nu, /rounded-2xl px-3\.5/);
  assert.match(nu, /<b>Banconi:false<\/b>/);
  assert.match(nu, /role="combobox"/);
  assert.match(nu, /min-w-\[16rem\]/);
});

test('NeighborhoodPicker « puce » : une pilule, repère citron, localisation dans la pilule', () => {
  const src = lire('src/components/common/NeighborhoodPicker.tsx');
  const puce = src.slice(src.indexOf("if (variante === 'puce')"), src.indexOf('return <div className={`space-y-1'));
  assert.match(puce, /inline-flex items-center max-w-full h-12 rounded-full/);
  assert.match(puce, /bg-suguba-citron text-suguba-profond/);
  assert.match(puce, /selection \? 'text-white' : 'text-suguba-citron'/, 'quartier à choisir en citron');
  assert.match(puce, /aria-label="Utiliser ma position actuelle"/);
  assert.match(lire('src/app/page.tsx'), /rounded-full bg-white text-suguba-profond text-sm font-bold px-4 h-12/, '« Boutiques » à la même hauteur');
});
