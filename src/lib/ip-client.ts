import type { NextRequest } from 'next/server';

/**
 * Adresse IP du visiteur pour les compteurs (visites, clics) — audit du 2026-10-01.
 * `x-forwarded-for` peut être rempli par le visiteur lui-même : on prend d'abord
 * les en-têtes posés par Vercel (non falsifiables), puis le dernier recours.
 */
export function ipClient(req: NextRequest): string | null {
  const vercel = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip');
  const brute = vercel || req.headers.get('x-forwarded-for');
  return brute?.split(',')[0]?.trim() || null;
}
