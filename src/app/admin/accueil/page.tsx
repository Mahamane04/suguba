'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutTemplate, Eye, EyeOff } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { BLOCS_ACCUEIL } from '@/lib/admin/pilotage';
import type { BlocsAccueil, CleBlocAccueil } from '@/lib/reseau/reglages';

/**
 * Accueil client (A5, 2026-09-27) : préparer quels blocs apparaissent sous
 * la recherche et le catalogue, voir l'aperçu, puis publier. Seulement des
 * blocs prévus par le design ; masquer un bloc ne rend aucun produit
 * vendable ni invendable.
 */
export default function AccueilAdminPage() {
  const { toast } = useToast();
  const [publies, setPublies] = useState<BlocsAccueil | null>(null);
  const [brouillon, setBrouillon] = useState<BlocsAccueil | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch('/api/admin/accueil', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setPublies(j.blocs); setBrouillon(j.blocs); })
      .catch((e) => setErreur((e as Error).message));
  }, []);

  const modifie = publies && brouillon && BLOCS_ACCUEIL.some((b) => publies[b.cle] !== brouillon[b.cle]);

  async function publier() {
    if (!brouillon) return;
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/accueil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocs: brouillon }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Publication impossible.', { ton: 'erreur' }); return; }
      setPublies(j.blocs); setBrouillon(j.blocs);
      toast('Accueil publié : visible par les clients d’ici une minute.', { ton: 'succes' });
    } finally { setEnvoi(false); }
  }

  const bascule = (cle: CleBlocAccueil) => setBrouillon((b) => (b ? { ...b, [cle]: !b[cle] } : b));

  return (
    <PageReseau titre="Accueil client" large sousTitre="Choisir les blocs affichés aux clients, voir l’aperçu, publier.">
      {erreur ? <EmptyState icone={LayoutTemplate} titre="Indisponible" texte={erreur} />
        : !brouillon ? <Skeleton className="h-64" />
        : (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Blocs</h2>
              {BLOCS_ACCUEIL.map((b) => (
                <label key={b.cle} className="flex items-start gap-3">
                  <input type="checkbox" checked={brouillon[b.cle]} onChange={() => bascule(b.cle)} className="mt-1 w-5 h-5" />
                  <span className="text-sm"><strong className="text-slate-900">{b.titre}</strong><span className="block text-xs text-slate-500">{b.description}</span></span>
                </label>
              ))}
              <p className="text-xs text-slate-500">Toujours affichés : la recherche, les catégories et le catalogue.</p>
              <div className="flex gap-2">
                <Button type="button" onClick={publier} disabled={!modifie || envoi}>{envoi ? 'Publication…' : 'Publier'}</Button>
                {modifie && <Button type="button" variant="ghost" onClick={() => setBrouillon(publies)}>Annuler les changements</Button>}
                <Link href="/" target="_blank" className="h-10 px-3 rounded-xl text-sm font-semibold text-slate-700 inline-flex items-center hover:bg-slate-100">Voir le site</Link>
              </div>
            </Card>
            <Card className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Aperçu {modifie ? '(non publié)' : ''}</h2>
              <div className="mx-auto w-full max-w-[260px] rounded-[28px] border-4 border-slate-800 p-2 space-y-1.5 bg-slate-50">
                <div className="h-14 rounded-xl bg-suguba-profond text-white text-[10px] font-bold flex items-center justify-center">Recherche · Catégories</div>
                {brouillon.a_la_une && <div className="h-8 rounded-lg bg-amber-100 text-[10px] font-bold flex items-center justify-center">À la une</div>}
                {brouillon.boutiques_quartier && <div className="h-10 rounded-lg bg-white border text-[10px] font-bold flex items-center justify-center">Boutiques près de chez vous</div>}
                <div className="grid grid-cols-2 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-white border text-[9px] flex items-center justify-center">Produit</div>)}</div>
                {brouillon.gagner && <div className="h-8 rounded-lg bg-white border text-[10px] font-bold flex items-center justify-center">Gagner de l’argent</div>}
                {brouillon.garanties && <div className="h-8 rounded-lg bg-white border text-[10px] font-bold flex items-center justify-center">Garanties</div>}
              </div>
              <ul className="text-xs text-slate-600 space-y-0.5">
                {BLOCS_ACCUEIL.filter((b) => publies && publies[b.cle] !== brouillon[b.cle]).map((b) => (
                  <li key={b.cle} className="inline-flex items-center gap-1 mr-3">{brouillon[b.cle] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}{b.titre} : {brouillon[b.cle] ? 'affiché' : 'masqué'}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
    </PageReseau>
  );
}
