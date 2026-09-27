'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Smartphone } from 'lucide-react';
import LogoSuguba from '@/components/ui/LogoSuguba';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { nettoyerCode } from '@/lib/code-email';

/**
 * Double authentification de l'équipe (A3, 2026-09-27) : un code à 6 chiffres
 * donné par une application (Google Authenticator, Microsoft Authenticator,
 * Authy…), en plus du mot de passe ou de Google. Si le mot de passe fuit, le
 * compte reste protégé.
 *   etape=verifier : saisir le code ; etape=inscrire : scanner le QR code
 *   puis saisir le premier code. Ensuite retour à la connexion (suite).
 */
type Etat = 'chargement' | 'sans_session' | 'verifier' | 'inscrire' | 'erreur';

function Contenu() {
  const params = useSearchParams();
  const suiteBrute = params.get('suite') || '';
  // Seulement un chemin interne : jamais une redirection vers un autre site.
  const suite = suiteBrute.startsWith('/') && !suiteBrute.startsWith('//') ? suiteBrute : '/auth/callback';
  const [etat, setEtat] = useState<Etat>('chargement');
  const [facteur, setFacteur] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supabase) { setEtat('erreur'); setErreur('Service indisponible sur cet environnement.'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEtat('sans_session'); return; }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setEtat('erreur'); setErreur('Lecture de votre double authentification impossible. Réessayez.'); return; }
      const verifie = data?.totp?.find((f) => f.status === 'verified');
      if (verifie) { setFacteur(verifie.id); setEtat('verifier'); return; }
      // Nettoie une inscription commencée puis abandonnée, puis recommence.
      for (const f of data?.all || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
      const { data: inscription, error: e2 } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Suguba ${new Date().toISOString().slice(0, 10)}` });
      if (e2 || !inscription) { setEtat('erreur'); setErreur('Activation impossible. Vérifiez que la double authentification est activée dans Supabase, puis réessayez.'); return; }
      setFacteur(inscription.id); setQr(inscription.totp.qr_code); setSecret(inscription.totp.secret); setEtat('inscrire');
    })();
  }, []);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !facteur || code.length !== 6) return;
    setEnvoi(true); setErreur('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteur, code });
    if (error) { setEnvoi(false); setErreur('Code incorrect ou expiré. Vérifiez l’heure du téléphone et réessayez.'); setCode(''); return; }
    window.location.replace(suite);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">
      <div className="px-4 py-4 sm:px-6"><Link href="/"><LogoSuguba className="h-8" /></Link></div>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-gray-100 shadow-float space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-suguba-menthe text-suguba-profond flex items-center justify-center mx-auto"><ShieldCheck className="w-6 h-6" /></div>
            <h1 className="text-xl font-bold text-gray-900">Double authentification</h1>
            <p className="text-xs text-slate-600">Protection des comptes de l’équipe Suguba.</p>
          </div>

          {etat === 'chargement' && <p className="text-sm text-slate-500 text-center">Chargement…</p>}
          {etat === 'sans_session' && (
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-700">Votre connexion a expiré.</p>
              <Button href="/login" fullWidth>Se reconnecter</Button>
            </div>
          )}
          {etat === 'erreur' && <p role="alert" className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">{erreur}</p>}

          {etat === 'inscrire' && (
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-2"><Smartphone className="w-4 h-4 mt-0.5 shrink-0" />Installez une application d’authentification (Google Authenticator, Microsoft Authenticator ou Authy).</li>
              <li>Dans l’application, scannez ce code :</li>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR code en data URL fourni par Supabase */}
              {qr && <img src={qr} alt="QR code à scanner avec votre application d’authentification" className="w-44 h-44 mx-auto" />}
              {secret && <li className="text-xs text-slate-500">Ou saisissez la clé : <code className="font-bold break-all select-all">{secret}</code></li>}
              <li>Tapez le code à 6 chiffres affiché par l’application.</li>
            </ol>
          )}
          {etat === 'verifier' && <p className="text-sm text-slate-700 text-center">Ouvrez votre application d’authentification et tapez le code Suguba à 6 chiffres.</p>}

          {(etat === 'inscrire' || etat === 'verifier') && (
            <form onSubmit={valider} className="space-y-3">
              <label htmlFor="code-mfa" className="sr-only">Code de l’application</label>
              <input id="code-mfa" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code}
                onChange={(e) => setCode(nettoyerCode(e.target.value).slice(0, 6))} placeholder="••••••"
                aria-invalid={Boolean(erreur)} aria-describedby={erreur ? 'erreur-mfa' : undefined}
                className="w-full py-3 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl font-bold tracking-[0.5em] tabular-nums" />
              {erreur && <p id="erreur-mfa" role="alert" className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">{erreur}</p>}
              <Button type="submit" size="lg" fullWidth disabled={envoi || code.length !== 6}>{envoi ? 'Vérification…' : 'Valider'}</Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DoubleAuthentificationPage() {
  return <Suspense fallback={null}><Contenu /></Suspense>;
}
