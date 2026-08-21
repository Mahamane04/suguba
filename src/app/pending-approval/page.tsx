'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, LogOut, CheckCircle2 } from 'lucide-react';

const DEST_PAR_ROLE: Record<string, string> = {
  admin: '/admin',
  supplier: '/supplier',
  driver: '/driver',
  reseller: '/reseller',
  diaspora: '/diaspora',
  customer: '/',
};

/**
 * Écran affiché à un utilisateur authentifié (numéro vérifié par OTP) dont
 * le dossier n'a pas encore été validé par un admin — voir middleware.ts et
 * /api/admin/review-profile. Remplace l'ancien comportement où un compte
 * fraîchement inscrit accédait directement au tableau de bord sans aucun
 * contrôle (voir la demande de validation d'inscription du 2026-08-19).
 */
export default function PendingApprovalPage() {
  const router = useRouter();
  const [valide, setValide] = useState(false);

  /**
   * Le statut vit dans un cookie signé de 7 jours : une validation par un
   * admin ne change donc rien tant que la session n'est pas réémise. Sans ce
   * rappel régulier, la personne restait bloquée ici après avoir été acceptée,
   * sans aucun moyen de le savoir — constaté sur une vraie inscription
   * fournisseur. On interroge le serveur, et on ouvre l'espace dès qu'il
   * confirme l'activation.
   */
  useEffect(() => {
    let arrete = false;

    const verifier = async () => {
      try {
        const res = await fetch('/api/auth/refresh-session', { method: 'POST' });
        if (!res.ok || arrete) return;
        const data = await res.json();
        if (data.authenticated && data.status === 'active') {
          arrete = true;
          setValide(true);
          setTimeout(() => router.push(DEST_PAR_ROLE[data.role] || '/'), 1600);
        }
      } catch {
        // Réseau coupé : on retentera au prochain passage, inutile d'alerter.
      }
    };

    verifier();
    const minuteur = setInterval(verifier, 15000);
    return () => { arrete = true; clearInterval(minuteur); };
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (valide) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f8f5] p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-float p-7 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-gray-900">Compte activé !</h1>
          <p className="text-sm text-gray-500">
            Votre dossier vient d&apos;être validé par l&apos;équipe Suguba. Ouverture de votre
            espace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f8f5] p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-float p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-black text-gray-900">Dossier en cours de validation</h1>
        {/* La version précédente promettait « vous recevrez un SMS » : aucune
            passerelle SMS n'est branchée, ce message ne pouvait donc pas être
            tenu. On annonce ce qui se passe réellement — la page se met à jour
            d'elle-même. */}
        <p className="text-sm text-gray-500">
          Votre numéro est vérifié. Votre dossier est maintenant examiné par l&apos;équipe Suguba,
          généralement sous 24h.
        </p>
        <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-xl py-2 px-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Gardez cette page ouverte : elle s&apos;ouvrira toute seule dès validation.</span>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/"
            className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-2xl text-gray-400 hover:text-gray-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
