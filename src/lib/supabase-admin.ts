import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté serveur UNIQUEMENT — utilise la clé service_role qui
 * contourne RLS. Ne jamais importer ce fichier depuis un composant 'use client'
 * ni depuis quoi que ce soit qui finit dans le bundle navigateur : la clé
 * service_role donne un accès total à la base, elle ne doit exister que dans
 * l'environnement serveur (routes API / middleware Node).
 */

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

/**
 * Noms des variables d'environnement manquantes (jamais leurs valeurs — ces
 * noms ne sont pas des secrets, contrairement à la clé elle-même). Sert à
 * renvoyer une erreur actionnable au lieu d'un "Supabase non configuré"
 * opaque : sur un déploiement Vercel, savoir LAQUELLE manque fait la
 * différence entre 10 secondes et une heure de diagnostic.
 *
 * Une variable définie mais vide (cas classique d'un copier-coller raté dans
 * l'interface Vercel) est traitée comme manquante — c'est bien ce qu'elle est
 * en pratique.
 */
export function missingSupabaseAdminEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Volontairement PAS de mise en cache du cas "absent" : une instance
  // serverless démarrée avant l'ajout des variables resterait sinon cassée
  // tant qu'elle est tiède, même après correction côté hébergeur.
  if (!url?.trim() || !serviceKey?.trim()) {
    console.error(
      '[SUPABASE ADMIN] Variables manquantes ou vides:',
      missingSupabaseAdminEnv().join(', ')
    );
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
