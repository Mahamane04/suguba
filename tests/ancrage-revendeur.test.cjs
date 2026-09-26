// Revendeur d'origine (2026-09-26, lot B) : retenu dès l'arrivée par sa
// boutique ou son lien, jamais écrasé par un autre (premier contact).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Navigateur simulé : un cookie écrit = ajouté à document.cookie.
const jar = new Map();
global.window = { location: { protocol: 'https:' } };
global.document = {
  get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); },
  set cookie(v) { const [kv] = v.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); },
};
const a = require('../src/lib/ancrage-revendeur.ts');

test('code lu dans l’adresse : ?ref= ou boutique /r/<code>', () => {
  assert.equal(a.codeDansAdresse('/p/tv', '?ref=sg-107092'), 'SG-107092');
  assert.equal(a.codeDansAdresse('/r/SG-107092', ''), 'SG-107092');
  assert.equal(a.codeDansAdresse('/boutique/levis', ''), null);
  assert.equal(a.codeDansAdresse('/p/tv', '?ref=<script>'), null, 'format refusé');
});

test('premier contact : le premier revendeur reste, un autre lien ne l’écrase pas', () => {
  jar.clear();
  jar.set('autre', 'x');
  assert.equal(a.revendeurAncre(), null);
  assert.equal(a.ancrerRevendeur('sg-111111'), 'SG-111111');
  assert.equal(a.ancrerRevendeur('SG-222222'), 'SG-111111');
  assert.equal(a.revendeurAncre(), 'SG-111111');
  // L'offre choisie (lien dans l'adresse) passe avant la provenance, pour cette page.
  assert.equal(a.codeRevendeurVisite('SG-222222'), 'SG-222222');
  assert.equal(a.codeRevendeurVisite(null), 'SG-111111');
});
