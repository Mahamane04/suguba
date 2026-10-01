// TEST-SEC-RPC-001 (audit intégral du 2026-10-01) : aucune fonction SECURITY DEFINER
// ne doit rester exécutable par la clé publique (anon) ou un compte connecté (authenticated).
//
// Sur Supabase, une fonction créée dans « public » reçoit par défaut EXECUTE pour anon ET
// authenticated : `REVOKE ... FROM PUBLIC` ne suffit pas. La base de test PGlite n'a pas ces
// droits par défaut et ne peut donc pas révéler l'oubli ; ce test vérifie le texte des
// migrations : chaque fonction SECURITY DEFINER doit être révoquée explicitement pour anon et
// authenticated quelque part, et les droits par défaut doivent être retirés.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOSSIER = path.join(__dirname, '..', 'supabase');
const fichiers = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.sql') && f !== 'purge-comptes.sql');
const corpus = fichiers.map((f) => fs.readFileSync(path.join(DOSSIER, f), 'utf8')).join('\n');
const sansCommentaires = corpus.replace(/--[^\n]*/g, '');

function fonctionsDefiner() {
  const noms = new Set();
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\$\$/gi;
  let m;
  while ((m = re.exec(sansCommentaires))) if (/SECURITY\s+DEFINER/i.test(m[2])) noms.add(m[1]);
  return [...noms].sort();
}

function revoqueePourRolesPublics(nom) {
  // REVOKE ... ON FUNCTION ... public.<nom>(...) ... FROM ... anon ... authenticated (dans une même instruction).
  const instructions = sansCommentaires.split(';').filter((s) => /REVOKE/i.test(s) && new RegExp(`public\\.${nom}\\s*\\(`, 'i').test(s));
  return instructions.some((s) => /FROM[\s\S]*\banon\b/i.test(s) && /FROM[\s\S]*\bauthenticated\b/i.test(s));
}

test('chaque fonction SECURITY DEFINER est révoquée pour anon et authenticated', () => {
  const definer = fonctionsDefiner();
  assert.ok(definer.length > 20, `fonctions détectées : ${definer.length}`);
  const ouvertes = definer.filter((n) => !revoqueePourRolesPublics(n));
  assert.deepEqual(ouvertes, [], `Fonctions SECURITY DEFINER encore exécutables par la clé publique : ${ouvertes.join(', ')}`);
});

test('verser_recompense (création de commission) n’est exécutable que par le serveur', () => {
  assert.ok(revoqueePourRolesPublics('verser_recompense'));
  assert.match(sansCommentaires, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.verser_recompense[\s\S]*?TO\s+service_role/i);
});

test('les futures fonctions ne reçoivent plus EXECUTE d’office pour les rôles publics', () => {
  assert.match(sansCommentaires, /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+anon,\s*authenticated/i);
});
