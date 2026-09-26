'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export interface CoordonneesDestinataire { nom: string; telephone: string; quartier: string | null; repere: string | null }
interface Enregistre extends CoordonneesDestinataire { id: string; relation: string | null }

/**
 * « Pour qui commandez-vous ? » (2026-09-26, compte client — C2) : visible
 * seulement pour un compte connecté. Remplit le formulaire avec « Pour moi »
 * (coordonnées du compte) ou un destinataire enregistré ; tout reste
 * modifiable ensuite. Sans compte, rien ne s'affiche.
 */
export default function ChoixDestinataire({ onChoisir }: { onChoisir: (c: CoordonneesDestinataire) => void }) {
  const [donnees, setDonnees] = useState<{ moi: CoordonneesDestinataire; destinataires: Enregistre[] } | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/compte/destinataires', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.moi) setDonnees({ moi: { ...j.moi, repere: null }, destinataires: j.destinataires || [] }); })
      .catch(() => undefined);
  }, []);
  if (!donnees) return null;

  const choisir = (cle: string, c: CoordonneesDestinataire) => { setChoisi(cle); onChoisir(c); };
  const pastille = (actif: boolean) => `px-3 min-h-10 rounded-full text-xs font-bold border ${actif ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-700">Pour qui commandez-vous ?</p>
      <div className="flex flex-wrap gap-2">
        {donnees.moi.nom && (
          <button type="button" className={pastille(choisi === 'moi')} onClick={() => choisir('moi', donnees.moi)}>Pour moi</button>
        )}
        {donnees.destinataires.map((d) => (
          <button key={d.id} type="button" className={pastille(choisi === d.id)} onClick={() => choisir(d.id, d)}>
            {d.nom}{d.relation ? ` · ${d.relation}` : ''}
          </button>
        ))}
        <Link href="/compte/destinataires" className="px-3 min-h-10 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-600 inline-flex items-center">
          + Un proche
        </Link>
      </div>
    </div>
  );
}
