'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Smartphone, X, Check } from 'lucide-react';

export default function PwaInstallPrompt() {
  const pathname = usePathname() || '';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Détection iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIosDevice && !isStandalone) {
      setIsIos(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt && !isIos) return null;
  // Espace équipe (2026-09-27) : on y travaille sur ordinateur, et ce bandeau
  // se glissait sous le menu latéral fixe (texte coupé « …votre téléphone »).
  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      {/* Small floating install banner for mobile users */}
      <div className="bg-suguba-profond text-white px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-suguba-citron" />
          </div>
          <p className="font-medium truncate">
            Installer l&apos;application <strong>Suguba</strong> sur votre téléphone
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="min-h-[36px] px-4 bg-suguba-citron hover:bg-[#b9e94f] text-suguba-profond font-semibold rounded-full text-xs transition-transform active:scale-95"
          >
            Installer
          </button>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => {
              setShowPrompt(false);
              setIsIos(false);
            }}
            className="w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS manual instructions modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-slate-900 text-center">
            <div className="w-12 h-12 rounded-2xl bg-suguba-menthe text-suguba-profond flex items-center justify-center mx-auto">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base">Installer sur iPhone / iPad</h3>
            <p className="text-xs text-slate-600 text-left space-y-2">
              1. Appuyez sur le bouton de <strong>Partage</strong> en bas de Safari.<br />
              2. Faites défiler et appuyez sur <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong>.<br />
              3. Appuyez sur <strong>Ajouter</strong> en haut à droite.
            </p>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </>
  );
}
