import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Photos des demandes SAV (2026-09-25) — SERVEUR UNIQUEMENT.
 *
 * Stockage PRIVÉ : une photo de colis montre souvent l'intérieur d'un
 * domicile. Aucune URL publique n'est produite ; l'écran admin SAV obtient
 * des liens signés valables dix minutes. Chaque ticket a son dossier
 * (`<id du ticket>/1.webp`…), ce qui évite toute colonne supplémentaire.
 */

export const BUCKET_SAV_PHOTOS = 'sav-photos';
export const PHOTOS_SAV_MAX = 3;
const TAILLE_MAX = 5 * 1024 * 1024;

const verifies = new Set<string>();

/**
 * Crée le bucket PRIVÉ s'il manque ; refuse d'y déposer s'il a été rendu
 * public à la main. Partagé avec les photos d'étapes de prestation (lot 1c).
 */
export async function assurerBucketPrive(admin: SupabaseClient, bucket: string) {
  if (verifies.has(bucket)) return;
  const { data } = await admin.storage.getBucket(bucket);
  if (!data) {
    const { error } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: TAILLE_MAX });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  } else if (data.public) {
    // Garde-fou : bucket rendu public à la main → on refuse d'y déposer.
    throw new Error(`Le stockage « ${bucket} » est public : envoi refusé. Repassez-le en privé dans Supabase.`);
  }
  verifies.add(bucket);
}

export const assurerBucketSavPhotos = (admin: SupabaseClient) => assurerBucketPrive(admin, BUCKET_SAV_PHOTOS);

/** Liens temporaires (10 min) vers les photos d'un ticket, dans l'ordre. */
export async function liensPhotosTicket(admin: SupabaseClient, ticketId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return [];
  const { data, error } = await admin.storage.from(BUCKET_SAV_PHOTOS).list(ticketId, { limit: PHOTOS_SAV_MAX + 2 });
  if (error || !data?.length) return [];
  const chemins = data.map((f) => `${ticketId}/${f.name}`).sort();
  const { data: signes } = await admin.storage.from(BUCKET_SAV_PHOTOS).createSignedUrls(chemins, 600);
  return (signes || []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
}
