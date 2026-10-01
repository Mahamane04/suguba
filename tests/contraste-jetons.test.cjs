// Audit intégral du 2026-10-01 — REQ-A11Y-CONTRASTE-001 (WCAG 1.4.3, 4,5:1 pour le texte).
// Le gris slate-500 d'origine (#64748b) n'atteignait que 4,35:1 sur les fonds clairs de
// Suguba : 609 nœuds signalés par axe-core sur 30 pages. Ce test empêche son retour.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../tailwind.config.js');

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const couleurs = config.theme.extend.colors;
// Fonds clairs réellement mesurés sous du texte gris lors du scan.
const FONDS = ['#ffffff', '#f2f6f1', '#f1f5f9', '#f5f8f5', '#f8fafc', couleurs.suguba.sauge];

test('le gris de texte secondaire (slate-500) reste lisible sur tous les fonds clairs', () => {
  const gris = couleurs.slate && couleurs.slate[500];
  assert.ok(gris, 'slate-500 doit rester surchargé dans tailwind.config.js');
  for (const fond of FONDS) assert.ok(ratio(gris, fond) >= 4.5, `${gris} sur ${fond} : ${ratio(gris, fond).toFixed(2)}:1`);
});

test('le texte vert sur fond blanc utilise brand-dark, pas brand', () => {
  assert.ok(ratio(couleurs.suguba['brand-dark'], '#ffffff') >= 4.5);
  // Rappel du piège : la couleur officielle ne passe pas en texte.
  assert.ok(ratio(couleurs.suguba.brand, '#ffffff') < 4.5);
});
