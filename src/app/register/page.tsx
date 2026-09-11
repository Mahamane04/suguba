'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import EtapesInscription from '@/components/common/EtapesInscription';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
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

type Role = 'reseller' | 'supplier' | 'driver' | 'diaspora';

const ROLES: { cle: Role; titre: string; detail: string; icone: React.ElementType }[] = [
  { cle: 'reseller', titre: 'Revendeur', detail: 'Partagez des produits, touchez une commission', icone: Store },
  { cle: 'supplier', titre: 'Fournisseur', detail: 'Vendez votre stock via Suguba', icone: ShoppingBag },
  { cle: 'driver', titre: 'Livreur', detail: 'Livrez les commandes à Bamako', icone: Truck },
  { cle: 'diaspora', titre: 'Diaspora', detail: 'Commandez pour vos proches au Mali', icone: Globe },
];

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
  const [role, setRole] = useState<Role>('reseller');
  const [email, setEmail] = useState('');
  const [lienEnvoye, setLienEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le rôle survit à l'aller-retour Google / email via ce paramètre (lu par
  // /auth/callback, puis transmis à /register/complete).
  const retour = () => `${window.location.origin}/auth/callback?intendedRole=${role}`;

  const inscriptionGoogle = async () => {
    setErreur(null);
    if (!supabase) { setErreur('Inscription indisponible sur cet environnement.'); return; }
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: retour() } });
  };

  const inscriptionEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!supabase) { setErreur('Inscription indisponible sur cet environnement.'); return; }
    setEnvoi(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: retour() },
    });
    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    setLienEnvoye(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        <EtapesInscription etapeActuelle={1} />

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-slate-900">Créer mon compte</h1>
          <p className="text-sm text-slate-500">Choisissez votre profil, puis connectez-vous en un clic.</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-black text-sm text-slate-900">1. Vous êtes…</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(({ cle, titre, detail, icone: Icone }) => {
              const choisi = role === cle;
              return (
                <button
                  key={cle}
                  type="button"
                  onClick={() => setRole(cle)}
                  aria-pressed={choisi}
                  className={`p-3.5 rounded-2xl border bg-white text-left flex items-start gap-3 transition-all ${
                    choisi ? 'border-suguba-brand ring-2 ring-suguba-brand/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${choisi ? 'bg-suguba-brand text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {choisi ? <Check className="w-4 h-4" /> : <Icone className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{titre}</p>
                    <p className="text-[11px] text-slate-500">{detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <Link href="/" className="flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-slate-300 bg-white hover:border-slate-400">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-slate-900">Client</p>
              <p className="text-[11px] text-slate-500">Pas besoin de compte pour acheter : commandez directement, vous payez à la livraison.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </Link>
        </section>

        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 space-y-4">
          <h2 className="font-black text-sm text-slate-900">2. Vérifiez votre identité</h2>

          <button
            type="button"
            onClick={inscriptionGoogle}
            className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <GoogleIcon className="w-5 h-5" />
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[11px] font-bold text-slate-500 uppercase">ou</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {lienEnvoye ? (
            <div className="text-center space-y-2 py-2">
              <Mail className="w-6 h-6 text-suguba-brand mx-auto" />
              <p className="text-sm font-bold text-slate-900">Vérifiez votre boîte mail</p>
              <p className="text-xs text-slate-500">
                Un lien a été envoyé à <strong>{email}</strong>. Ouvrez-le depuis ce même appareil.
              </p>
              <button type="button" onClick={() => setLienEnvoye(false)} className="text-xs font-bold text-suguba-brand hover:underline">
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form onSubmit={inscriptionEmail} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
              />
              <Button type="submit" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Recevoir un lien'}
              </Button>
            </form>
          )}

          {erreur && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center">
            En créant un compte, vous acceptez les{' '}
            <Link href="/legal/terms" className="text-suguba-brand underline">conditions générales</Link>.
          </p>
        </section>

        <p className="text-center text-xs text-slate-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-bold text-suguba-brand hover:underline">Se connecter</Link>
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
