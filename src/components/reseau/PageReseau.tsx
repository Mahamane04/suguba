'use client';

import React from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { PageHeader } from '@/components/ui/Surface';

/**
 * Enveloppe commune des écrans du module Réseau.
 *
 * Les pages existantes recopiaient chacune la même structure (fond slate-100,
 * en-tête, largeur maximale, barre du bas, pied de page) avec des marges
 * légèrement différentes à chaque fois. Une seule enveloppe : un seul endroit
 * où corriger un décalage, et la place de la barre du bas ne peut plus être
 * oubliée sur un écran.
 */
export default function PageReseau({
  titre,
  sousTitre,
  retour,
  action,
  large = false,
  children,
}: {
  titre: string;
  sousTitre?: string;
  retour?: { href: string; libelle: string };
  action?: React.ReactNode;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 space-y-5 ${large ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <PageHeader titre={titre} sousTitre={sousTitre} retour={retour} action={action} />
        {children}
      </main>
      <BottomNav />
      <Footer />
    </div>
  );
}
