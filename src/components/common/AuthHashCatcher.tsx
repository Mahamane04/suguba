'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Capture tout retour OAuth (#access_token=... ou ?code=...) arrivant par erreur
 * sur la racine (/) ou toute autre page que /auth/callback, et redirige immédiatement
 * vers /auth/callback pour finaliser la session Supabase sans bloquer l'utilisateur.
 */
export default function AuthHashCatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    const search = window.location.search;

    // Si l'URL contient un access_token ou un code OAuth et qu'on n'est pas déjà sur /auth/callback
    if (pathname !== '/auth/callback') {
      if (hash && (hash.includes('access_token=') || hash.includes('refresh_token='))) {
        router.replace(`/auth/callback${search}${hash}`);
      } else if (search && search.includes('code=')) {
        router.replace(`/auth/callback${search}${hash}`);
      }
    }
  }, [pathname, router]);

  return null;
}
