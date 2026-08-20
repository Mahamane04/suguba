// ==============================================================================
// SUGUBA SAAS — CRÉATION DU BUCKET DE STOCKAGE DES IMAGES PRODUIT
// ==============================================================================
//
// Corrige BUG-011 à la racine : jusqu'ici, les visuels produit étaient soit
// des URLs Unsplash hotlinkées (plusieurs déjà mortes au moment de l'audit),
// soit une URL arbitraire collée par le fournisseur dans un champ texte
// (n'importe quel lien, y compris cassé ou inapproprié). Ce script crée un
// bucket Supabase Storage public en lecture, écriture réservée au serveur
// (service_role) — voir /api/products/upload-image pour le point d'entrée
// serveur qui l'utilise.
//
// Usage : npm run setup-storage

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

const BUCKET_NAME = 'product-images';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('❌ Erreur de lecture des buckets:', listErr.message);
    process.exit(1);
  }

  if (existing.some((b) => b.name === BUCKET_NAME)) {
    console.log(`ℹ️  Le bucket "${BUCKET_NAME}" existe déjà — rien à faire.`);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (createErr) {
    console.error('❌ Erreur de création du bucket:', createErr.message);
    process.exit(1);
  }

  console.log(`✅ Bucket "${BUCKET_NAME}" créé (public en lecture, 5MB max, JPEG/PNG/WEBP).`);
  console.log('→ Écriture réservée au serveur (service_role) via /api/products/upload-image.');
}

main().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
