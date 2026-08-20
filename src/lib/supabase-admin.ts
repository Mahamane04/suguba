import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté serveur UNIQUEMENT — utilise la clé service_role qui
 * contourne RLS. Ne jamais importer ce fichier depuis un composant 'use client'
 * ni depuis quoi que ce soit qui finit dans le bundle navigateur : la clé
 * service_role donne un accès total à la base, elle ne doit exister que dans
 * l'environnement serveur (routes API / middleware Node).
 */

let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    cached = null;
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
