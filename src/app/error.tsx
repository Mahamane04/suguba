'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

/**
 * Erreur pendant l'affichage d'une page (PUB-05, audit UI/UX du 2026-10-02).
 * Sans ce fichier, Next.js montrait son écran par défaut, en anglais. Le détail
 * technique n'est jamais affiché : seul un repère (digest) aide le support.
 */
export default function ErreurPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center">
      <div className="w-full max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Cette page n’a pas pu s’afficher</h1>
          <p className="text-base text-slate-700">
            Souvent, c’est la connexion. Réessayez dans un instant ; si le problème continue, prévenez Suguba.
          </p>
        </div>
        <div className="grid gap-3">
          <Button type="button" size="lg" fullWidth onClick={() => reset()}>
            <RefreshCw className="w-5 h-5" />Réessayer
          </Button>
          <Button href="/" variant="ghost" size="lg" fullWidth>Retour à l’accueil</Button>
        </div>
        <a
          href="https://wa.me/22389460000?text=Bonjour%20Suguba%2C%20une%20page%20ne%20s%27affiche%20pas."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-suguba-brand-dark hover:underline"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Prévenir Suguba sur WhatsApp
        </a>
        {error.digest && <p className="text-xs text-slate-600">Repère pour le support : {error.digest}</p>}
      </div>
    </main>
  );
}
