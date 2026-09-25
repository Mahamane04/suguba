'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff } from 'lucide-react';

/**
 * Scanner de QR par la caméra arrière (2026-09-25), 100 % dans le téléphone :
 * aucune image n'est envoyée à un service externe. Utilise le détecteur
 * intégré du navigateur quand il existe (Chrome Android), sinon jsQR
 * (Safari iPhone). S'arrête au premier QR lu.
 */
export default function ScannerQr({ onLecture }: { onLecture: (texte: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const rappel = useRef(onLecture);
  rappel.current = onLecture;

  useEffect(() => {
    let flux: MediaStream | null = null;
    let image = 0;
    let fini = false;
    const toile = document.createElement('canvas');
    const ctx = toile.getContext('2d', { willReadFrequently: true });
    type Detecteur = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
    const Natif = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detecteur }).BarcodeDetector;
    let detecteur: Detecteur | null = null;
    try { detecteur = Natif ? new Natif({ formats: ['qr_code'] }) : null; } catch { detecteur = null; }

    const terminer = (texte: string) => {
      if (fini) return;
      fini = true;
      flux?.getTracks().forEach((t) => t.stop());
      rappel.current(texte);
    };

    const lire = async () => {
      if (fini) return;
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        try {
          if (detecteur) {
            const codes = await detecteur.detect(v);
            if (codes[0]?.rawValue) return terminer(codes[0].rawValue);
          } else if (ctx) {
            // Image réduite : plus rapide, et un QR tenu devant la caméra reste lisible.
            const echelle = Math.min(1, 640 / v.videoWidth);
            toile.width = Math.round(v.videoWidth * echelle);
            toile.height = Math.round(v.videoHeight * echelle);
            ctx.drawImage(v, 0, 0, toile.width, toile.height);
            const d = ctx.getImageData(0, 0, toile.width, toile.height);
            const qr = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
            if (qr?.data) return terminer(qr.data);
          }
        } catch { /* image suivante */ }
      }
      image = requestAnimationFrame(lire);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur('Ce téléphone ne permet pas d’utiliser la caméra ici. Saisissez le code à la place.');
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (fini) { flux.getTracks().forEach((t) => t.stop()); return; }
        if (video.current) {
          video.current.srcObject = flux;
          await video.current.play().catch(() => undefined);
        }
        image = requestAnimationFrame(lire);
      } catch (e) {
        const nom = (e as { name?: string })?.name;
        setErreur(nom === 'NotAllowedError'
          ? 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code à la place.'
          : 'Caméra indisponible. Saisissez le code à la place.');
      }
    })();

    return () => {
      fini = true;
      cancelAnimationFrame(image);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (erreur) {
    return (
      <div role="alert" className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 flex items-start gap-2">
        <CameraOff className="w-5 h-5 shrink-0 text-slate-500" />
        <span>{erreur}</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square">
      <video ref={video} playsInline muted className="w-full h-full object-cover" aria-label="Caméra : visez le QR du client" />
      <div className="absolute inset-[18%] border-4 border-suguba-citron rounded-3xl pointer-events-none" />
      <p className="absolute bottom-3 inset-x-0 text-center text-xs font-bold text-white drop-shadow">Visez le QR sur le téléphone du client</p>
    </div>
  );
}
