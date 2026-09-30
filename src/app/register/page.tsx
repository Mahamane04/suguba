'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ChoixProfil, { ResumeProfil, estProfil, PROFILS_INSCRIPTION, type ProfilInscription as Role } from '@/components/auth/ChoixProfil';
import { memoriserParrain } from '@/lib/parrain';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import EtapesInscription from '@/components/common/EtapesInscription';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import CodeEmail from '@/components/auth/CodeEmail';
import { messageErreurMotDePasse, problemeMotDePasse } from '@/lib/code-email';
import ChampMotDePasse from '@/components/auth/ChampMotDePasse';
import { Store, ShoppingBag, Truck, Globe, ShoppingCart, ShieldAlert, Mail, Check, ArrowRight } from 'lucide-react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3a7.4 7.4 0 0 1-11-3.89H1.08v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.07 14.2a7.2 7.2 0 0 1 0-4.4V6.71H1.08a12 12 0 0 0 0 10.58l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.08 6.71l3.99 3.09A7.16 7.16 0 0 1 12 4.75Z" />
    </svg>
  );
}

/**
 * Inscription — étape 1 : choisir son profil, puis prouver son identité
 * (Google ou lien email). Nom, numéro et informations du métier sont
 * demandés juste après, sur /register/complete, avant toute entrée dans
 * l'espace.
 *
 * Revue le 2026-09-10 : le lien email est proposé ici aussi (seul Google
 * l'était), et « Client » apparaît enfin — pour dire honnêtement qu'un achat
 * ne demande aucun compte, plutôt que de créer un compte qui ne mènerait nulle
 * part.
 */
export default function RegisterPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [compte, setCompte] = useState<'chargement'|'nouveau'|'existant'|'erreur'>('chargement');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demande = params.get('role');
    setRole(estProfil(demande) ? demande : null);
    memoriserParrain(params.get('ref'));
    fetch('/api/auth/me', {cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(m=>setCompte(m.authenticated?'existant':'nouveau')).catch(()=>setCompte('erreur'));
  }, []);
  const profil = PROFILS_INSCRIPTION.find(p=>p.cle===role);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [lienEnvoye, setLienEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le rôle survit à l'aller-retour Google / email via ce paramètre (lu par
  // /auth/callback, puis transmis à /register/complete).
  const retour = () => `${window.location.origin}/auth/callback?intendedRole=${role}`;

  const inscriptionGoogle = async () => {
    setErreur(null);
    if (!role || compte !== 'nouveau') return;
    if (!supabase) { setErreur('Inscription indisponible sur cet environnement.'); return; }
    setEnvoi(true);
    try { const {error} = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: retour() } }); if(error)setErreur('Connexion Google indisponible. Réessayez ou utilisez votre adresse e-mail.'); }
    catch { setErreur('Connexion interrompue. Réessayez.'); }
    finally { setEnvoi(false); }
  };

  const inscriptionEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!role || compte !== 'nouveau') return;
    if (!supabase) { setErreur('Inscription indisponible sur cet environnement.'); return; }
    // Mot de passe (2026-09-26) : l'adresse est confirmée UNE fois, par le
    // code (ou le lien) de l'e-mail d'inscription ; ensuite, e-mail + mot de
    // passe, sans attendre d'e-mail.
    const probleme = problemeMotDePasse(motDePasse, confirmation);
    if (probleme) { setErreur(probleme); return; }
    setEnvoi(true);
    try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: motDePasse,
      options: { emailRedirectTo: retour() },
    });
    setEnvoi(false);
    if (error) { setErreur(messageErreurMotDePasse(error.message)); return; }
    // Adresse déjà inscrite : Supabase ne le dit pas en clair (aucune
    // identité renvoyée) et n'envoie rien.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setErreur('Un compte existe déjà avec cette adresse : connectez-vous, ou choisissez « Mot de passe oublié ? » sur la page de connexion.');
      return;
    }
    if (data.session) { window.location.assign(retour()); return; }
    setLienEnvoye(true);
    } catch { setErreur('Connexion interrompue. Réessayez ; si un e-mail est arrivé, utilisez son code.'); } finally { setEnvoi(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        <EtapesInscription etapeActuelle={1} />

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Créer mon compte</h1>
          <p className="text-sm text-slate-500">Choisissez votre activité, confirmez votre adresse, puis complétez vos informations.</p>
        </div>

        {compte === 'chargement' ? <p role="status">Vérification de votre compte…</p> : compte === 'erreur' ? <p role="alert">Impossible de vérifier votre connexion. <button type="button" className="underline" onClick={()=>window.location.reload()}>Réessayer</button></p> : compte === 'existant' ? <section className="bg-white rounded-2xl border p-5 space-y-3"><h2 className="font-bold">Vous avez déjà un compte</h2><p className="text-sm">Ajoutez une activité à votre compte existant ; vos commandes et vos gains restent conservés.</p><Button href={role && ['supplier','reseller','driver'].includes(role) ? `/compte/profils?ajouter=${role}` : '/compte/profils'}>Gérer mes profils</Button></section> : <>
        <section id="choix-inscription" className="space-y-3 scroll-mt-24">
          <h2 className="font-bold text-base text-slate-900">Quel profil voulez-vous créer ? 5 choix possibles</h2>
          <ChoixProfil valeur={role} disabled={envoi || lienEnvoye} onChange={r=>{setRole(r);setErreur(null);requestAnimationFrame(()=>document.getElementById('connexion-inscription')?.focus());}} />
          {lienEnvoye && <p className="text-sm text-slate-600">Le code reçu correspond au profil {profil?.titre}. Pour changer de profil, revenez à la saisie de l’adresse e-mail.</p>}
          <Link href="/" className="flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-slate-300 bg-white hover:border-slate-400">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-slate-900">Acheter sans compte</p>
              <p className="text-xs text-slate-500">Un compte n’est pas obligatoire : commandez directement, vous payez à la livraison.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </Link>
        </section>

        {role ? <section id="connexion-inscription" tabIndex={-1} className="scroll-mt-24 focus:outline-none bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 space-y-4">
          <ResumeProfil profil={role} />
          <h2 className="font-bold text-base text-slate-900">Créez vos identifiants de connexion</h2>
          <p className="text-sm text-slate-600">Avec Google ou une adresse e-mail. Vous compléterez ensuite les informations de votre profil.</p>

          <button
            type="button"
            onClick={inscriptionGoogle}
            disabled={envoi || lienEnvoye}
            className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <GoogleIcon className="w-5 h-5" />
            Continuer avec Google · {profil?.titre}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-bold text-slate-500 uppercase">ou</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {lienEnvoye ? (
            <CodeEmail usage="inscription" email={email} retour={retour()} onAutreAdresse={() => setLienEnvoye(false)} />
          ) : (
            <form onSubmit={inscriptionEmail} className="space-y-3">
              <label htmlFor="register-email" className="block text-xs font-semibold text-gray-700">Adresse email</label>
              <input
                id="register-email"
                autoComplete="email"
                aria-invalid={Boolean(erreur)}
                aria-describedby={erreur ? 'register-error' : undefined}
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond"
              />
              <ChampMotDePasse id="register-password" label="Mot de passe" nouveau value={motDePasse} onChange={setMotDePasse} decrit="register-password-aide" />
              <p id="register-password-aide" className="text-xs text-slate-500">8 caractères au moins, avec une lettre et un chiffre.</p>
              <ChampMotDePasse id="register-password-2" label="Confirmer le mot de passe" nouveau value={confirmation} onChange={setConfirmation} />
              <Button type="submit" disabled={envoi} fullWidth>
                {envoi ? <><SugubaLoader className="mr-2 h-4 w-4" />Création…</> : `Créer mon compte ${profil?.titre.toLowerCase()}`}
              </Button>
              <p className="text-xs text-slate-500 text-center">Un code arrive par e-mail pour confirmer votre adresse, une seule fois.</p>
            </form>
          )}

          {erreur && (
            <div id="register-error" role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            En créant un compte, vous acceptez les{' '}
            <Link href="/legal/terms" className="text-suguba-brand-dark underline">conditions générales</Link>.
          </p>
        </section> : <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Choisissez un profil ci-dessus pour accéder à l’inscription.</p>}
        </>}

        <p className="text-center text-xs text-slate-600">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-bold text-suguba-brand-dark hover:underline">Se connecter</Link>
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
