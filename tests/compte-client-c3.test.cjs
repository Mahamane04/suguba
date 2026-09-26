// Compte client — C3 (2026-09-26) : diaspora = même compte client ; la carte
// bancaire n'est proposée qu'une fois vérifiée par un vrai paiement test.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('carte bancaire fermée par défaut, ouvrable seulement explicitement', () => {
  const { completerReglages } = require('../src/lib/pricing.ts');
  assert.equal(completerReglages({}).paiementCarteVerifie, false);
  assert.equal(completerReglages({ paiementCarteVerifie: 'oui' }).paiementCarteVerifie, false, 'seul un vrai booléen ouvre la carte');
  assert.equal(completerReglages({ paiementCarteVerifie: true }).paiementCarteVerifie, true);
});

test('le serveur refuse le paiement par carte tant qu’il n’est pas ouvert', async () => {
  const avant = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, cle: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const { POST } = require('../src/app/api/payments/saspay/create/route.ts');
    const req = new Request('http://localhost/api/payments/saspay/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: 'SG-TEST', network: 'card', phone: '+33612345678' }),
    });
    const r = await POST(req);
    assert.equal(r.status, 409);
    assert.match((await r.json()).error, /carte n’est pas encore ouvert/);
  } finally {
    if (avant.url) process.env.NEXT_PUBLIC_SUPABASE_URL = avant.url;
    if (avant.cle) process.env.SUPABASE_SERVICE_ROLE_KEY = avant.cle;
  }
});

test('la page diaspora ne promet plus la carte sans condition', () => {
  const { readFileSync } = require('node:fs');
  const page = readFileSync(require.resolve('../src/app/diaspora/page.tsx'), 'utf8');
  assert.equal(page.includes('Paiement Sécurisé CB (Visa/Mastercard)'), false);
  assert.equal(page.includes('par Carte Bancaire / Visa / Mastercard'), false);
  assert.match(page, /paiementCarte === true/, 'lit le réglage public');
  assert.match(page, /payé à la réception/i, 'sans carte : payé à la réception par le proche');
});
