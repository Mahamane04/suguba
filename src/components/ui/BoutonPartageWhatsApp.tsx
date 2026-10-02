'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

type ProprietesButton = Parameters<typeof Button>[0];
type SansContenu<T> = T extends unknown ? Omit<T, 'children' | 'variant'> : never;

/**
 * « Partager sur WhatsApp », l'action n°1 du revendeur (REV-03, lot 3 de l'audit
 * UI/UX du 2026-10-02). Elle existait en quatre versions : vert WhatsApp ou vert
 * profond, logo WhatsApp ou icône de partage générique, 32 à 36 px, coins
 * arrondis ou pilule. Pour un public qui reconnaît une action à sa forme, le vert
 * WhatsApp et son logo SONT le repère : un seul bouton, partout.
 *
 * Lien externe (https://…) : ouvert dans un nouvel onglet. Sinon, `onClick`
 * (partage préparé par l'écran, avec `loading` pendant la préparation).
 */
export default function BoutonPartageWhatsApp({
  libelle = 'Partager sur WhatsApp',
  ...props
}: SansContenu<ProprietesButton> & { libelle?: React.ReactNode }) {
  const externe = typeof props.href === 'string' && /^https?:\/\//.test(props.href);
  const proprietes = (externe ? { target: '_blank', rel: 'noopener noreferrer', ...props } : props) as ProprietesButton;
  return (
    <Button {...proprietes} variant="whatsapp">
      <WhatsAppIcon className="w-5 h-5 shrink-0" />
      {libelle}
    </Button>
  );
}
