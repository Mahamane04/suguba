// Connexion par e-mail avec code à 6 chiffres (2026-09-26).
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { nettoyerCode, codeComplet, messageErreurEmail } = require('../src/lib/code-email.ts');

test('code : chiffres seulement, collé avec des espaces accepté', () => {
  assert.equal(nettoyerCode(' 123 456 '), '123456');
  assert.equal(nettoyerCode('12a3-45b6'), '123456');
  assert.equal(nettoyerCode('12345678901234'), '1234567890', '10 chiffres au plus');
  assert.equal(codeComplet('123456'), true);
  assert.equal(codeComplet('12345'), false);
  assert.equal(codeComplet('12345a'), false);
});

test('erreurs Supabase traduites, jamais affichées en anglais', () => {
  assert.match(messageErreurEmail('Token has expired or is invalid'), /Code incorrect ou expiré/);
  assert.match(messageErreurEmail('For security purposes, you can only request this after 42 seconds.'), /Attendez une minute/);
  assert.match(messageErreurEmail('Error sending magic link email'), /n’a pas pu partir/);
  assert.match(messageErreurEmail('Error sending confirmation email'), /n’a pas pu partir/);
  assert.match(messageErreurEmail('Unable to validate email address: invalid format'), /Adresse e-mail invalide/);
  assert.doesNotMatch(messageErreurEmail('Something odd'), /[A-Z][a-z]+ [a-z]+ odd/);
});

test('mot de passe : 8 caractères, une lettre et un chiffre, confirmation identique', () => {
  const { problemeMotDePasse } = require('../src/lib/code-email.ts');
  assert.match(problemeMotDePasse('abc123'), /8 caractères/);
  assert.match(problemeMotDePasse('abcdefgh'), /une lettre et un chiffre/);
  assert.match(problemeMotDePasse('12345678'), /une lettre et un chiffre/);
  assert.match(problemeMotDePasse('a'.repeat(72) + '1'), /72/);
  assert.match(problemeMotDePasse('bamako2026', 'bamako2025'), /pas identiques/);
  assert.equal(problemeMotDePasse('bamako2026', 'bamako2026'), null);
  assert.equal(problemeMotDePasse('bamako2026'), null);
});

test('erreurs de mot de passe traduites et utiles', () => {
  const { messageErreurMotDePasse } = require('../src/lib/code-email.ts');
  assert.match(messageErreurMotDePasse('Invalid login credentials'), /Mot de passe oublié/);
  assert.match(messageErreurMotDePasse('Email not confirmed'), /pas encore confirmée/);
  assert.match(messageErreurMotDePasse('User already registered'), /existe déjà/);
  assert.match(messageErreurMotDePasse('New password should be different from the old password.'), /différent/);
  assert.match(messageErreurMotDePasse('Password should be at least 8 characters.'), /trop faible/);
});

test('connexion : mot de passe par défaut, code et mot de passe oublié en secours', () => {
  const src = readFileSync(require.resolve('../src/app/login/page.tsx'), 'utf8');
  assert.match(src, /signInWithPassword\(\{ email, password \}\)/);
  assert.match(src, /<CodeEmail usage="inscription"/, 'adresse jamais confirmée : nouveau code');
  assert.match(src, /shouldCreateUser: true/, 'le code par e-mail reste possible, même pour une adresse nouvelle');
  assert.match(src, /href="\/mot-de-passe"/);
  assert.doesNotMatch(src, /mot-de-passe\?email=/, 'jamais l’adresse dans l’URL');
  assert.doesNotMatch(src, /setErr\w*\(error\.message\)/, 'pas de message brut de Supabase');
});

test('inscription : mot de passe vérifié, adresse confirmée une fois, compte existant signalé', () => {
  const src = readFileSync(require.resolve('../src/app/register/page.tsx'), 'utf8');
  assert.match(src, /auth\.signUp\(/);
  assert.match(src, /problemeMotDePasse\(motDePasse, confirmation\)/);
  assert.match(src, /identities\.length === 0/, 'adresse déjà inscrite');
  assert.match(src, /<CodeEmail usage="inscription"/);
  assert.doesNotMatch(src, /setErr\w*\(error\.message\)/);
});

test('code : bons types de vérification et suite commune /auth/callback', () => {
  const comp = readFileSync(require.resolve('../src/components/auth/CodeEmail.tsx'), 'utf8');
  assert.match(comp, /inscription: \['email', 'signup'\]/);
  assert.match(comp, /recuperation: \['recovery'\]/);
  assert.match(comp, /verifyOtp\(\{ email, token: code, type \}\)/);
  assert.match(comp, /window\.location\.assign\(retour\)/);
  const mdp = readFileSync(require.resolve('../src/app/mot-de-passe/page.tsx'), 'utf8');
  assert.match(mdp, /resetPasswordForEmail/);
  assert.match(mdp, /updateUser\(\{ password: motDePasse \}\)/);
  assert.match(mdp, /PASSWORD_RECOVERY/, 'le lien de l’e-mail marche aussi');
});
