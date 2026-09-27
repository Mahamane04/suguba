'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';

interface Groupe { cle: string; titre: string; resultats: { titre: string; detail: string; lien: string }[]; erreur?: string }

/**
 * Recherche globale de l'équipe (A1, 2026-09-27) — Ctrl+K. Commandes,
 * produits, personnes, boutiques, paiements : seulement les groupes que le
 * membre a le droit de consulter (filtré par le serveur). Flèches ↑ ↓ pour
 * choisir, Entrée pour ouvrir, Échap pour fermer.
 */
export default function RechercheGlobale({ onFermer }: { onFermer: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [etat, setEtat] = useState<'vide' | 'chargement' | 'ok' | 'erreur'>('vide');
  const [choix, setChoix] = useState(0);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => { champ.current?.focus(); }, []);
  useEffect(() => {
    const texte = q.trim();
    if (texte.length < 2) { setGroupes([]); setEtat('vide'); return; }
    setEtat('chargement');
    const annulation = new AbortController();
    const minuterie = setTimeout(() => {
      fetch(`/api/admin/recherche-globale?q=${encodeURIComponent(texte)}`, { signal: annulation.signal, cache: 'no-store' })
        .then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((j) => { setGroupes(j.groupes || []); setEtat('ok'); setChoix(0); })
        .catch(() => { if (!annulation.signal.aborted) setEtat('erreur'); });
    }, 250);
    return () => { clearTimeout(minuterie); annulation.abort(); };
  }, [q]);

  const liste = useMemo(() => groupes.flatMap((g) => g.resultats), [groupes]);
  const ouvrir = (lien: string) => { onFermer(); router.push(lien); };

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setChoix((c) => Math.min(liste.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setChoix((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && liste[choix]) { e.preventDefault(); ouvrir(liste[choix].lien); }
  };

  let index = -1;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Recherche globale" onKeyDown={surTouche}>
      <button type="button" aria-label="Fermer la recherche" className="absolute inset-0 bg-slate-900/50" onClick={onFermer} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-slate-200">
          {etat === 'chargement' ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" /> : <Search className="w-4 h-4 text-slate-400" />}
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher"
            placeholder="Commande, produit, personne, boutique, référence de paiement…"
            className="flex-1 h-14 text-base outline-none placeholder:text-slate-400" />
          <button type="button" onClick={onFermer} aria-label="Fermer" className="w-9 h-9 inline-flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {etat === 'vide' && <p className="px-4 py-6 text-sm text-slate-500">Tapez au moins 2 caractères. ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.</p>}
          {etat === 'erreur' && <p role="alert" className="px-4 py-6 text-sm font-semibold text-rose-700">Recherche impossible pour le moment. Réessayez.</p>}
          {etat === 'ok' && liste.length === 0 && groupes.every((g) => !g.erreur) && <p className="px-4 py-6 text-sm text-slate-500">Aucun résultat pour « {q.trim()} ».</p>}
          {groupes.filter((g) => g.resultats.length || g.erreur).map((g) => (
            <section key={g.cle} className="py-2">
              <h3 className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">{g.titre}</h3>
              {g.erreur && <p className="px-4 py-1 text-xs text-rose-700">{g.erreur}</p>}
              <ul>
                {g.resultats.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <li key={`${g.cle}-${i}`}>
                      <button type="button" onMouseEnter={() => setChoix(i)} onClick={() => ouvrir(r.lien)}
                        className={`w-full text-left px-4 py-2 ${choix === i ? 'bg-suguba-50' : 'hover:bg-slate-50'}`}>
                        <span className="block text-sm font-bold text-slate-900 truncate">{r.titre}</span>
                        <span className="block text-xs text-slate-500 truncate">{r.detail}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
