// ==============================================================================
// SUGUBA SAAS — PURGE DES DONNÉES DE TEST (DESTRUCTIF, IRRÉVERSIBLE)
// ==============================================================================
//
// Vide les tables transactionnelles et le catalogue de démo avant l'ouverture
// commerciale, en PRÉSERVANT les comptes listés dans PRESERVE_PHONES (l'admin
// bootstrap — voir scripts/create-admin.js : le supprimer couperait le seul
// accès au tableau de bord, et il n'existe aucun moyen de se réattribuer le
// rôle admin depuis le site public).
//
// Ordre de suppression imposé par les clés étrangères :
//   commissions -> payouts -> orders -> products -> profiles
//
// Usage (le drapeau --confirm est OBLIGATOIRE, sinon le script ne fait qu'un
// inventaire à blanc) :
//   node scripts/purge-test-data.js            # inventaire seul, ne supprime rien
//   node scripts/purge-test-data.js --confirm  # supprime réellement

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Numéros dont le profil ne doit JAMAIS être supprimé par ce script.
const PRESERVE_PHONES = ['+22371360525'];

const TABLES_IN_ORDER = ['commissions', 'payouts', 'orders', 'products', 'otp_challenges'];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

async function main() {
  const confirmed = process.argv.includes('--confirm');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).');
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`\n📋 Cible : ${url}`);
  console.log(confirmed ? '⚠️  MODE RÉEL — les données vont être supprimées.\n' : 'ℹ️  Inventaire à blanc (ajoutez --confirm pour supprimer).\n');

  for (const table of TABLES_IN_ORDER) {
    const { count, error: countErr } = await db.from(table).select('*', { count: 'exact', head: true });
    if (countErr) {
      console.log(`   ${table.padEnd(16)} — table absente ou illisible (${countErr.message})`);
      continue;
    }
    if (!confirmed) {
      console.log(`   ${table.padEnd(16)} ${count} ligne(s) seraient supprimées`);
      continue;
    }
    // .neq() sur une colonne toujours renseignée = "tout" ; PostgREST refuse
    // un DELETE sans filtre, d'où ce prédicat volontairement trivial.
    const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(error ? `   ❌ ${table} : ${error.message}` : `   ✅ ${table.padEnd(16)} ${count} ligne(s) supprimée(s)`);
  }

  // Profils en dernier, et jamais ceux à préserver.
  const { data: profiles } = await db.from('profiles').select('id, phone, full_name, role');
  const doomed = (profiles || []).filter((p) => !PRESERVE_PHONES.includes(p.phone));
  const kept = (profiles || []).filter((p) => PRESERVE_PHONES.includes(p.phone));

  console.log('');
  for (const p of kept) {
    console.log(`   🔒 CONSERVÉ  ${p.phone} — ${p.full_name} (${p.role})`);
  }
  for (const p of doomed) {
    if (!confirmed) {
      console.log(`   🗑️  à supprimer ${p.phone} — ${p.full_name} (${p.role})`);
      continue;
    }
    const { error } = await db.from('profiles').delete().eq('id', p.id);
    console.log(error ? `   ❌ ${p.phone} : ${error.message}` : `   ✅ supprimé ${p.phone} — ${p.full_name}`);
  }

  console.log(confirmed ? '\n✨ Purge terminée.\n' : '\nRien n\'a été supprimé. Relancez avec --confirm.\n');
}

main().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
