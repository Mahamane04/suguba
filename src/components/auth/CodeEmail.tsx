'use client';

import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { DELAI_RENVOI_S, codeComplet, messageErreurEmail, nettoyerCode } from '@/lib/code-email';

/**
 * Après l'envoi d'un e-mail Suguba (2026-09-26) : le client tape le code à
 * 6 chiffres reçu, OU clique sur le lien.
 *   connexion    : code de connexion sans mot de passe ;
 *   inscription  : confirmation de l'adresse, UNE seule fois ;
 *   recuperation : mot de passe oublié (ou premier mot de passe).
 * Une fois le code vérifié : `onValide` s'il est fourni, sinon /auth/callback
 * — même suite que le lien et que Google (échange de session, choix du
 * profil pour une adresse nouvelle).
 */
type Usage = 'connexion' | 'inscription' | 'recuperation';

const TYPES: Record<Usage, ('email' | 'signup' | 'recovery')[]> = {
  connexion: ['email'],
  inscription: ['email', 'signup'],
  recuperation: ['recovery'],
};

const TEXTES: Record<Usage, { titre: string; but: string }> = {
  connexion: { titre: 'Vérifiez votre boîte mail', but: 'Tapez-le ci-dessous, ou cliquez sur le lien de l’e-mail.' },
  inscription: { titre: 'Confirmez votre adresse', but: 'Une seule fois : ensuite, vous vous connecterez avec votre mot de passe.' },
  recuperation: { titre: 'Vérifiez votre boîte mail', but: 'Tapez-le ci-dessous pour choisir votre mot de passe.' },
};

export default function CodeEmail({ email, retour, onAutreAdresse, usage = 'connexion', onValide }: {
  email: string;
  /** Adresse de retour des liens de l'e-mail (/auth/callback, avec le rôle choisi). */
  retour: string;
  onAutreAdresse: () => void;
  usage?: Usage;
  onValide?: () => void;
}) {
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [verification, setVerification] = useState(false);
  const [attente, setAttente] = useState(DELAI_RENVOI_S);
  const [renvoye, setRenvoye] = useState(false);

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !codeComplet(code)) return;
    setVerification(true); setErreur('');
    let derniere: string | null = null;
    for (const type of TYPES[usage]) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
      if (!error) { derniere = null; break; }
      derniere = error.message;
    }
    if (derniere !== null) {
      setVerification(false);
      setErreur(messageErreurEmail(derniere));
      return;
    }
    if (onValide) onValide(); else window.location.assign(retour);
  }

  async function renvoyer() {
    if (!supabase || attente > 0) return;
    setErreur(''); setRenvoye(false);
    const { error } = usage === 'inscription'
      ? await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: retour } })
      : usage === 'recuperation'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: retour })
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: retour } });
    if (error) { setErreur(messageErreurEmail(error.message)); return; }
    setCode(''); setRenvoye(true); setAttente(DELAI_RENVOI_S);
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-gray-900">{TEXTES[usage].titre}</p>
        <p className="text-xs text-gray-500">
          Un code à 6 chiffres a été envoyé à <b>{email}</b>. {TEXTES[usage].but}
        </p>
        <p className="text-xs text-gray-500">Rien reçu ? Regardez dans les <b>Spams</b> ou « Courrier indésirable ».</p>
      </div>

      <form onSubmit={valider} className="space-y-3">
        <label htmlFor="code-email" className="block text-xs font-semibold text-gray-700 text-center">Code reçu par e-mail</label>
        <input
          id="code-email"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? 'code-email-erreur' : undefined}
          value={code}
          onChange={(e) => setCode(nettoyerCode(e.target.value))}
          placeholder="••••••"
          className="w-full py-3 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl font-bold tracking-[0.5em] tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond"
        />
        {erreur && <p id="code-email-erreur" role="alert" className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">{erreur}</p>}
        {renvoye && !erreur && <p role="status" className="text-xs font-semibold text-emerald-700 text-center">Nouveau code envoyé.</p>}
        <Button type="submit" size="lg" fullWidth disabled={verification || !codeComplet(code)}>
          {verification ? 'Vérification…' : 'Valider le code'}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-2 text-xs">
        <button type="button" onClick={onAutreAdresse} className="font-semibold text-suguba-brand-dark hover:underline min-h-[44px]">
          Utiliser une autre adresse
        </button>
        <button type="button" onClick={renvoyer} disabled={attente > 0} className="font-semibold text-suguba-brand-dark hover:underline disabled:text-slate-500 disabled:no-underline min-h-[44px]">
          {attente > 0 ? `Renvoyer le code (${attente} s)` : 'Renvoyer le code'}
        </button>
      </div>
    </div>
  );
}
