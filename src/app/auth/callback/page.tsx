'use client';

import { prendreApresConnexion } from '@/lib/apres-connexion';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Loader2, ShieldAlert } from 'lucide-react';

const DEST_BY_ROLE: Record<string, string> = {
  admin: '/admin',
  driver: '/driver',
  supplier: '/supplier',
  reseller: '/reseller',
  customer: '/compte/commandes',
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
      let { data, error: sessionErr } = await client.auth.getSession();
      if (cancelled) return;

      // Sur un téléphone lent, le jeton Google peut n'être lu qu'un instant
      // après ce premier appel : on attend l'événement de connexion (8 s max)
      // au lieu d'afficher aussitôt « connexion incomplète » — ce qui
      // obligeait à tout recommencer alors que Google avait bien répondu.
      if (!data.session) {
        const session = await new Promise<Session | null>((resolve) => {
          const minuterie = setTimeout(() => { abonnement.unsubscribe(); resolve(null); }, 8000);
          const { data: { subscription: abonnement } } = client.auth.onAuthStateChange((_evt, s) => {
            if (s) { clearTimeout(minuterie); abonnement.unsubscribe(); resolve(s); }
          });
        });
        if (cancelled) return;
        data = { session };
        sessionErr = null;
      }

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
        // Rechargement COMPLET, et non router.push (2026-09-24) : l'identité
        // affichée par l'en-tête et la barre du bas n'était lue qu'au
        // chargement de l'app. Une navigation « douce » gardait l'état
        // visiteur alors que la session venait d'être posée : l'utilisateur
        // voyait « Se connecter » et devait recommencer la connexion Google.
        // `replace` retire aussi cette page de l'historique (le bouton retour
        // ne relance pas l'échange).
        const aller = (chemin: string) => window.location.replace(chemin);
        const refCode = new URLSearchParams(window.location.search).get('ref') || '';
        const versCompletion = () => {
          const params = new URLSearchParams({ fullName: json.fullName || '' });
          if (intendedRole) params.set('intendedRole', intendedRole);
          if (refCode) params.set('ref', refCode);
          aller(`/register/complete?${params.toString()}`);
        };

        // Adresse inconnue et aucun rôle choisi (connexion depuis /login) :
        // rien n'a été créé. La personne choisit son profil sur la page
        // suivante, qui crée alors le compte avec le bon rôle.
        if (json.needsRole) {
          versCompletion();
          return;
        }

        if (!res.ok || !json.success) {
          setError(json.error || 'Erreur lors de la connexion.');
          return;
        }

        // Profil jamais complété (aucun numéro) : on finit l'inscription avant
        // tout. La condition portait aussi sur `status !== 'active'` — or tous
        // les comptes naissent actifs depuis le 2026-09-10, si bien que plus
        // personne ne passait par ce formulaire : ni nom confirmé, ni numéro,
        // ni fiche fournisseur ou livreur. L'admin n'y est pas soumis.
        if (!json.hasPhone && json.role !== 'admin') {
          versCompletion();
          return;
        }

        if (json.status !== 'active') {
          aller('/pending-approval');
          return;
        }
        aller(prendreApresConnexion() || DEST_BY_ROLE[json.role] || '/reseller');
      } catch (err) {
        setError('Erreur réseau lors de la connexion.');
      }
    };

    finish();
    return () => { cancelled = true; };
  }, []);

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
