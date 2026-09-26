'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Mail, ArrowRight } from 'lucide-react';
import LogoSuguba from '@/components/ui/LogoSuguba';
import Button from '@/components/ui/Button';
import CodeEmail from '@/components/auth/CodeEmail';
import ChampMotDePasse from '@/components/auth/ChampMotDePasse';
import { supabase } from '@/lib/supabase';
import { messageErreurEmail, messageErreurMotDePasse, problemeMotDePasse } from '@/lib/code-email';

/**
 * Mot de passe oublié — ou premier mot de passe d'un compte créé avec
 * Google ou un code (2026-09-26).
 *   1. l'adresse ; 2. le code à 6 chiffres reçu (ou le lien de l'e-mail) ;
 *   3. le nouveau mot de passe, puis connexion par /auth/callback.
 * Rien n'indique si l'adresse a un compte : on ne révèle pas qui est inscrit.
 */
type Etape = 'adresse' | 'code' | 'nouveau';

export default function MotDePassePage() {
  const [etape, setEtape] = useState<Etape>('adresse');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    try {
      const saisi = sessionStorage.getItem('suguba_email_saisi');
      if (saisi) setEmail(saisi);
    } catch { /* navigation privée */ }
    // Arrivée par le lien de l'e-mail : Supabase ouvre une session de
    // récupération, on passe directement au nouveau mot de passe.
    if (!supabase) return;
    if (window.location.hash.includes('type=recovery')) setEtape('nouveau');
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'PASSWORD_RECOVERY') setEtape('nouveau');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const retour = () => `${window.location.origin}/mot-de-passe`;

  async function demander(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { setErreur('Service indisponible sur cet environnement.'); return; }
    setEnvoi(true); setErreur('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: retour() });
    setEnvoi(false);
    if (error) { setErreur(messageErreurEmail(error.message)); return; }
    setEtape('code');
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const probleme = problemeMotDePasse(motDePasse, confirmation);
    if (probleme) { setErreur(probleme); return; }
    setEnvoi(true); setErreur('');
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    if (error) { setEnvoi(false); setErreur(messageErreurMotDePasse(error.message)); return; }
    window.location.assign(`${window.location.origin}/auth/callback`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center"><LogoSuguba className="h-8" /></Link>
        <Link href="/login" className="text-xs text-slate-600 hover:underline">Retour à la connexion</Link>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-float space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-suguba-menthe text-suguba-profond flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {etape === 'nouveau' ? 'Choisissez votre mot de passe' : 'Mot de passe oublié'}
            </h1>
            {etape === 'adresse' && (
              <p className="text-xs text-slate-600">Aussi pour créer un premier mot de passe si vous vous connectiez avec Google ou un code.</p>
            )}
          </div>

          {etape === 'adresse' && (
            <form onSubmit={demander} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="mdp-email" className="block text-xs font-semibold text-gray-700">Adresse email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
                  <input
                    id="mdp-email" type="email" required autoComplete="email" placeholder="vous@exemple.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(erreur)} aria-describedby={erreur ? 'mdp-erreur' : undefined}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond"
                  />
                </div>
              </div>
              {erreur && <p id="mdp-erreur" role="alert" className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">{erreur}</p>}
              <Button type="submit" size="lg" fullWidth disabled={envoi}>
                {envoi ? 'Envoi…' : <>Recevoir un code<ArrowRight className="w-4 h-4" /></>}
              </Button>
              <p className="text-xs text-slate-500 text-center">Si un compte existe avec cette adresse, un code à 6 chiffres arrive par e-mail.</p>
            </form>
          )}

          {etape === 'code' && (
            <CodeEmail usage="recuperation" email={email.trim()} retour={retour()}
              onAutreAdresse={() => setEtape('adresse')} onValide={() => { setErreur(''); setEtape('nouveau'); }} />
          )}

          {etape === 'nouveau' && (
            <form onSubmit={enregistrer} className="space-y-4">
              <ChampMotDePasse id="mdp-nouveau" label="Nouveau mot de passe" nouveau value={motDePasse} onChange={setMotDePasse} decrit="mdp-aide" />
              <p id="mdp-aide" className="text-xs text-slate-500">8 caractères au moins, avec une lettre et un chiffre.</p>
              <ChampMotDePasse id="mdp-confirmation" label="Confirmer le mot de passe" nouveau value={confirmation} onChange={setConfirmation} />
              {erreur && <p role="alert" className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">{erreur}</p>}
              <Button type="submit" size="lg" fullWidth disabled={envoi}>
                {envoi ? 'Enregistrement…' : 'Enregistrer et me connecter'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
