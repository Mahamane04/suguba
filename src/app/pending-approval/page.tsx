'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck, LogOut } from 'lucide-react';

/**
 * Écran affiché à un utilisateur authentifié (numéro vérifié par OTP) dont
 * le dossier n'a pas encore été validé par un admin — voir middleware.ts et
 * /api/admin/review-profile. Remplace l'ancien comportement où un compte
 * fraîchement inscrit accédait directement au tableau de bord sans aucun
 * contrôle (voir la demande de validation d'inscription du 2026-08-19).
 */
export default function PendingApprovalPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f8f5] p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-float p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-black text-gray-900">Dossier en cours de validation</h1>
        <p className="text-sm text-gray-500">
          Votre numéro est vérifié. Votre profil est maintenant examiné par l&apos;équipe Suguba
          avant activation — vous recevrez un SMS dès que ce sera fait, généralement sous 24h.
        </p>
        <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-xl py-2 px-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Étape de sécurité, pas un bug — merci de votre patience.</span>
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
