'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ShieldAlert } from 'lucide-react';

const DEST_BY_ROLE: Record<string, string> = {
  admin: '/admin',
  driver: '/driver',
  supplier: '/supplier',
  reseller: '/reseller',
  customer: '/reseller',
  diaspora: '/diaspora',
};

/**
 * Point de retour après le flux OAuth Google (voir /login). Le SDK Supabase
 * côté client détecte automatiquement le jeton présent dans l'URL au
 * chargement de cette page ; on récupère ensuite la session pour l'échanger
 * contre notre propre cookie de session signé (/api/auth/supabase-exchange)
 * — exactement le même point d'entrée que pour la connexion par email.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setError('Supabase non configuré sur cet environnement.');
      return;
    }

    let cancelled = false;

    const finish = async () => {
      // Laisse au SDK le temps de traiter le fragment d'URL (#access_token=...)
      const { data, error: sessionErr } = await client.auth.getSession();
      if (cancelled) return;

      if (sessionErr || !data.session) {
        setError('Connexion Google incomplète. Réessayez depuis la page de connexion.');
        return;
      }

      try {
        // Lu directement depuis l'URL plutôt que via useSearchParams (qui
        // exigerait un Suspense boundary) : le rôle choisi sur /register
        // avant de cliquer "S'inscrire avec Google" (voir handleGoogleRegister)
        // survit à l'aller-retour OAuth via ce paramètre de redirectTo.
        const intendedRole = new URLSearchParams(window.location.search).get('intendedRole') || undefined;

        const res = await fetch('/api/auth/supabase-exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ intendedRole }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Erreur lors de la connexion.');
          return;
        }

        // Un compte Google fraîchement créé (jamais de numéro — voir
        // hasPhone dans supabase-exchange) doit d'abord passer par
        // /register/complete pour renseigner les champs propres à son rôle
        // (téléphone pour tous, plus entreprise/véhicule/bénéficiaire selon
        // le cas — voir ce fichier, désormais commun aux 4 rôles depuis que
        // le téléphone/OTP maison a été retiré de l'inscription). Un compte
        // déjà complet (reconnexion) suit le chemin habituel.
        const refCode = new URLSearchParams(window.location.search).get('ref') || '';
        if (json.status !== 'active' && !json.hasPhone) {
          const params = new URLSearchParams({ fullName: json.fullName || '' });
          if (refCode) params.set('ref', refCode);
          router.push(`/register/complete?${params.toString()}`);
          return;
        }

        if (json.status !== 'active') {
          router.push('/pending-approval');
          return;
        }
        router.push(DEST_BY_ROLE[json.role] || '/reseller');
      } catch (err) {
        setError('Erreur réseau lors de la connexion.');
      }
    };

    finish();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f8f5] p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-float p-7 text-center space-y-4">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <a href="/login" className="inline-block text-xs font-bold text-suguba-brand hover:underline">
              Retour à la connexion
            </a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-suguba-brand animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Connexion en cours…</p>
          </>
        )}
      </div>
    </div>
  );
}
