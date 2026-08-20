// ==============================================================================
// SUGUBA SAAS — BOOTSTRAP DU PREMIER COMPTE ADMIN
// ==============================================================================
//
// Il n'existe volontairement AUCUN moyen de devenir admin depuis le site web
// public (voir /api/auth/verify-otp : le rôle 'admin' n'est jamais
// auto-attribuable — corrige BUG-003 de l'audit du 2026-08-19). Ce script est
// donc l'UNIQUE façon de créer le tout premier compte admin : il tourne en
// ligne de commande, sur la machine d'un opérateur de confiance, avec la clé
// service_role (jamais exposée au navigateur).
//
// Une fois ce premier admin créé, il peut en promouvoir d'autres directement
// depuis le tableau de bord admin (POST /api/admin/promote), sans repasser
// par ce script.
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/create-admin.js "+22370000000" "Nom Complet"
//
// (ou renseigner ces deux variables dans .env.local avant de lancer le script)

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Petit chargeur .env.local sans dépendance externe (dotenv n'est pas
// installé dans ce projet) — ne remplace jamais une variable déjà présente
// dans l'environnement du shell appelant.
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
  const [, , rawPhone, rawName] = process.argv;

  if (!rawPhone) {
    console.error('Usage: node scripts/create-admin.js "+22370000000" "Nom Complet"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (variables d\'environnement ou .env.local).');
    process.exit(1);
  }

  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  const phone = cleaned.startsWith('+') ? cleaned : cleaned.startsWith('223') ? '+' + cleaned : '+223' + cleaned;
  const fullName = rawName || 'Suguba Ops Master';

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing, error: fetchErr } = await supabase.from('profiles').select('id, role, status').eq('phone', phone).maybeSingle();
  if (fetchErr) {
    console.error('❌ Erreur de lecture Supabase:', fetchErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error: updateErr } = await supabase.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', existing.id);
    if (updateErr) {
      console.error('❌ Erreur de mise à jour:', updateErr.message);
      process.exit(1);
    }
    console.log(`✅ Profil existant (${phone}) promu admin et activé.`);
  } else {
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      phone,
      full_name: fullName,
      role: 'admin',
      status: 'active',
      city: 'Bamako',
      balance: 0,
    });
    if (insertErr) {
      console.error('❌ Erreur de création:', insertErr.message);
      process.exit(1);
    }
    console.log(`✅ Compte admin créé pour ${fullName} (${phone}).`);
  }

  console.log('→ Ce numéro peut désormais se connecter via /login (OTP réel) et accéder à /admin.');
}

main().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
