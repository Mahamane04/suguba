'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code d'un lien de partage (2026-09-12) — inspiré d'une app de mobile
 * money malienne (carte profil avec QR code, vidéo partagée par
 * l'utilisateur) : un revendeur ou un fournisseur peut montrer son lien à
 * scanner directement (salon, marché), sans dicter une URL lettre par lettre.
 *
 * Génération 100% locale (paquet `qrcode`, pas de service tiers) : le lien
 * partagé ne transite par aucun serveur externe.
 */
export default function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => { if (!annule) setDataUrl(url); })
      .catch(() => { if (!annule) setDataUrl(null); });
    return () => { annule = true; };
  }, [value, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="bg-slate-100 rounded-2xl animate-pulse" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt={`QR code — ${value}`}
      width={size}
      height={size}
      className="rounded-2xl border border-slate-200"
    />
  );
}
