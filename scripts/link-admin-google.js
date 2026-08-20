// ==============================================================================
// SUGUBA SAAS — RELIER UN COMPTE GOOGLE AU PROFIL ADMIN EXISTANT
// ==============================================================================
//
// L'admin (créé via scripts/create-admin.js, connexion par OTP téléphone)
// veut aussi pouvoir se connecter via Google, plus fiable que l'OTP SMS.
// Aucun compte ne peut s'auto-attribuer le rôle admin (voir SELF_SERVE_ROLES
// dans /api/auth/supabase-exchange) : la seule façon sûre de brancher Google
// sur un admin est de poser son email sur la ligne `profiles` existante —
// au prochain clic sur "Continuer avec Google" (/login), supabase-exchange
// retrouvera ce profil par email et en héritera le rôle/statut (admin/actif),
// jamais l'inverse.
//
// Usage :
//   node scripts/link-admin-google.js "+22371360525" "infos@sugubaml.com"

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
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
  const [, , rawPhone, rawEmail] = process.argv;

  if (!rawPhone || !rawEmail) {
    console.error('Usage: node scripts/link-admin-google.js "+22371360525" "infos@sugubaml.com"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local).');
    process.exit(1);
  }

  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  const phone = cleaned.startsWith('+') ? cleaned : cleaned.startsWith('223') ? '+' + cleaned : '+223' + cleaned;
  const email = rawEmail.trim().toLowerCase();

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: admin, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, role, status, email')
    .eq('phone', phone)
    .maybeSingle();

  if (fetchErr) {
    console.error('❌ Erreur de lecture Supabase:', fetchErr.message);
    process.exit(1);
  }
  if (!admin) {
    console.error(`❌ Aucun profil trouvé pour ${phone}. Lancez d'abord scripts/create-admin.js.`);
    process.exit(1);
  }
  if (admin.role !== 'admin') {
    console.error(`❌ Le profil ${phone} n'a pas le rôle admin (rôle actuel: ${admin.role}). Rien n'a été modifié.`);
    process.exit(1);
  }

  // L'email doit être libre — la colonne est UNIQUE, un doublon révèlerait
  // qu'un autre profil (client, revendeur...) utilise déjà cette adresse.
  const { data: emailTaken } = await supabase
    .from('profiles')
    .select('id, phone, role')
    .eq('email', email)
    .maybeSingle();
  if (emailTaken && emailTaken.id !== admin.id) {
    console.error(`❌ ${email} est déjà utilisé par un autre profil (${emailTaken.phone || emailTaken.id}, rôle ${emailTaken.role}).`);
    process.exit(1);
  }

  const { error: updateErr } = await supabase.from('profiles').update({ email }).eq('id', admin.id);
  if (updateErr) {
    console.error('❌ Erreur de mise à jour:', updateErr.message);
    process.exit(1);
  }

  console.log(`✅ ${email} est désormais relié au profil admin ${phone} (statut: ${admin.status}).`);
  console.log('→ Prochaine connexion : ouvrir /login, cliquer "Continuer avec Google", choisir ce compte Google.');
  console.log('  supabase-exchange retrouvera ce profil par email et gardera le rôle admin existant — jamais auto-attribué.');
}

main().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
