// ==============================================================================
// SUGUBA SAAS — MIGRATION DES IMAGES DE DÉMO HORS D'UNSPLASH
// ==============================================================================
//
// Corrige BUG-011 pour le catalogue de démo existant (les nouveaux produits
// passent déjà par /api/products/upload-image, voir supplier/products/new).
// Télécharge chaque image Unsplash référencée dans src/lib/mock-data.ts et
// supabase/schema.sql, la réuploade dans le bucket Supabase Storage
// "product-images" (créé par `npm run setup-storage`), puis réécrit les
// deux fichiers ET les lignes déjà présentes dans la table `products` pour
// pointer vers le fichier hébergé par Suguba au lieu du lien externe.
//
// Usage : npm run migrate-images

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
const FILES_TO_REWRITE = ['src/lib/mock-data.ts', 'supabase/schema.sql'];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Recenser tous les liens Unsplash uniques dans les fichiers à migrer.
  const unsplashUrlPattern = /https:\/\/images\.unsplash\.com\/[^\s'"]+/g;
  const found = new Set();
  const fileContents = {};

  for (const file of FILES_TO_REWRITE) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    fileContents[file] = content;
    const matches = content.match(unsplashUrlPattern) || [];
    matches.forEach((m) => found.add(m));
  }

  const urls = Array.from(found);
  console.log(`🔎 ${urls.length} lien(s) Unsplash unique(s) trouvé(s).`);

  // 2. Télécharger + uploader chacun, construire la table de correspondance.
  const urlMap = {};
  let index = 0;
  for (const oldUrl of urls) {
    index += 1;
    process.stdout.write(`  [${index}/${urls.length}] ${oldUrl.slice(0, 70)}... `);
    try {
      const res = await fetch(oldUrl);
      if (!res.ok) {
        console.log(`⚠️  HTTP ${res.status}, ignoré (laissé tel quel).`);
        continue;
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const buffer = Buffer.from(await res.arrayBuffer());

      const idMatch = oldUrl.match(/photo-([a-zA-Z0-9-]+)/);
      const fileId = idMatch ? idMatch[1] : `img-${index}`;
      const storagePath = `seed/${fileId}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      });
      if (uploadErr) {
        console.log(`⚠️  échec upload (${uploadErr.message}), ignoré.`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      urlMap[oldUrl] = publicUrlData.publicUrl;
      console.log('✅');
    } catch (err) {
      console.log(`⚠️  erreur réseau (${err.message}), ignoré.`);
    }
  }

  const migratedCount = Object.keys(urlMap).length;
  console.log(`\n📦 ${migratedCount}/${urls.length} image(s) migrée(s) vers le bucket "${BUCKET_NAME}".`);

  // 3. Réécrire les fichiers source (remplacement texte simple, ordre stable).
  for (const file of FILES_TO_REWRITE) {
    if (!(file in fileContents)) continue;
    let content = fileContents[file];
    let replaced = 0;
    for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
      if (content.includes(oldUrl)) {
        content = content.split(oldUrl).join(newUrl);
        replaced += 1;
      }
    }
    if (replaced > 0) {
      fs.writeFileSync(path.join(process.cwd(), file), content, 'utf8');
      console.log(`✏️  ${file} — ${replaced} lien(s) remplacé(s).`);
    }
  }

  // 4. Mettre à jour les lignes déjà présentes dans la table `products`
  // (le fichier schema.sql corrigé ne sera rejoué que sur un futur reset ;
  // les données déjà insérées par un `npm run` ou un déploiement précédent
  // gardent sinon les anciennes URLs).
  const { data: products, error: fetchErr } = await supabase.from('products').select('id, images');
  if (fetchErr) {
    console.warn('⚠️  Impossible de lire la table products pour mise à jour:', fetchErr.message);
  } else if (products && products.length > 0) {
    let updatedRows = 0;
    for (const product of products) {
      if (!Array.isArray(product.images)) continue;
      const newImages = product.images.map((img) => urlMap[img] || img);
      const changed = newImages.some((img, i) => img !== product.images[i]);
      if (changed) {
        const { error: updateErr } = await supabase.from('products').update({ images: newImages }).eq('id', product.id);
        if (!updateErr) updatedRows += 1;
      }
    }
    console.log(`🗄️  ${updatedRows} ligne(s) de la table products mise(s) à jour.`);
  }

  console.log('\n✅ Migration terminée.');
}

main().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
