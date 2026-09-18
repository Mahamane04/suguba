'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/ui/Surface';

/** Tuiles de synthèse du réseau en tête du back-office. Rien tant que la migration n'est pas là. */

interface Stats {
  disponible: boolean;
  liens: number; clics: number; commandes: number; conversion: number; caPartages: number;
  clientsAttribues: number; missionsActives: number; aValider: number;
  sponsoActives: number; sponsoEnAttente: number; verifications: number; boutiques: number;
}

export default function StatsReseauAdmin() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    fetch('/api/admin/reseau-stats').then((r) => r.json()).then(setS).catch(() => undefined);
  }, []);
  if (!s || !s.disponible) return null;

  const aTraiter = [
    s.verifications > 0 && { texte: `${s.verifications} vérification${s.verifications > 1 ? 's' : ''} à examiner`, href: '/admin/verifications' },
    s.aValider > 0 && { texte: `${s.aValider} mission${s.aValider > 1 ? 's' : ''} à valider`, href: '/admin/recompenses' },
    s.sponsoEnAttente > 0 && { texte: `${s.sponsoEnAttente} sponsorisation${s.sponsoEnAttente > 1 ? 's' : ''} en attente`, href: '/admin/sponsorisations' },
  ].filter(Boolean) as { texte: string; href: string }[];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Visites via partages" valeur={s.clics.toLocaleString('fr-FR')} aide={`${s.liens} liens créés`} />
        <StatCard label="Ventes via partages" valeur={s.commandes} aide={`${s.conversion} % de conversion`} accent />
        <StatCard label="Clients attribués" valeur={s.clientsAttribues} aide="Rattachés à un revendeur" />
        <StatCard label="Boutiques" valeur={s.boutiques} aide={`${s.sponsoActives} sponsorisation${s.sponsoActives > 1 ? 's' : ''} en cours`} />
      </div>
      {aTraiter.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aTraiter.map((t) => (
            <Link key={t.href} href={t.href} className="px-3 py-2 rounded-2xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              {t.texte} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
