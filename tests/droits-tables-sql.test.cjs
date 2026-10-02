// TEST-SEC-RLS-001 (revue RLS du 2026-10-02) : la clé publique (anon) et un compte connecté
// (authenticated) ne doivent avoir aucun droit d'écriture sur `products`.
//
// RLS bloque déjà ces écritures (aucune règle d'écriture sur la table), mais les droits par défaut
// de Supabase les laissaient ouverts : une seule règle ajoutée par erreur aurait suffi pour qu'un
// visiteur change un prix ou un stock. Comme pour les fonctions (securite-fonctions-sql), la base
// PGlite n'a pas ces droits par défaut : ce test vérifie donc le texte des migrations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOSSIER = path.join(__dirname, '..', 'supabase');
const fichiers = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.sql') && f !== 'purge-comptes.sql');
const corpus = fichiers.map((f) => fs.readFileSync(path.join(DOSSIER, f), 'utf8')).join('\n');
const instructions = corpus.replace(/--[^\n]*/g, '').split(';');
const ECRITURES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

const surProducts = (s) => /\bON\s+(?:TABLE\s+)?public\.products\b/i.test(s);
const visePublics = (s) => /\b(?:FROM|TO)\b[\s\S]*\banon\b/i.test(s) && /\b(?:FROM|TO)\b[\s\S]*\bauthenticated\b/i.test(s);

test('les droits d’écriture sur products sont retirés à anon et authenticated', () => {
  const revocations = instructions.filter((s) => /^\s*REVOKE\b/i.test(s) && surProducts(s) && visePublics(s));
  const retires = ECRITURES.filter((d) => revocations.some((s) => new RegExp(`\\b(?:${d}|ALL)\\b`, 'i').test(s)));
  assert.deepEqual(retires, ECRITURES, `Droits encore accordés : ${ECRITURES.filter((d) => !retires.includes(d)).join(', ')}`);
});

test('aucune migration ne rend l’écriture sur products à anon ou authenticated', () => {
  const rendus = instructions.filter((s) => /^\s*GRANT\b/i.test(s) && surProducts(s)
    && /\b(?:anon|authenticated)\b/i.test(s) && /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)\b/i.test(s));
  assert.deepEqual(rendus.map((s) => s.trim()), []);
});
