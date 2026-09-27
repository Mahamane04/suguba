'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X, ExternalLink } from 'lucide-react';
import { PosteAdminContexte } from './contexte';
import RechercheGlobale from './RechercheGlobale';
import type { Rubrique } from '@/lib/admin/poste';

interface Poste { nom: string; libelleMetier: string; rubriques: Rubrique[] }

/** Environnement affiché en permanence : on ne confond jamais essai et production. */
function environnement(): { libelle: string; classe: string } {
  if (typeof window === 'undefined') return { libelle: '', classe: '' };
  const h = window.location.hostname;
  if (h === 'app.sugubaml.com') return { libelle: 'Production', classe: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/40' };
  if (h === 'localhost' || h === '127.0.0.1') return { libelle: 'Local', classe: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/40' };
  return { libelle: 'Prévisualisation', classe: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/40' };
}

function Navigation({ poste, pathname, onNaviguer }: { poste: Poste | null; pathname: string; onNaviguer?: () => void }) {
  if (!poste) return <div className="px-3 py-4 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 rounded-lg bg-white/10 animate-pulse" />)}</div>;
  if (!poste.rubriques.length) {
    return <p className="px-4 py-4 text-xs text-emerald-100/80">Aucun rôle d’équipe : demandez à un Super Admin de vous en attribuer un.</p>;
  }
  return (
    <nav aria-label="Menu de l’équipe" className="px-2 py-3 space-y-4">
      {poste.rubriques.map((r) => (
        <div key={r.cle}>
          <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-100/60">{r.titre}</p>
          <ul className="space-y-0.5">
            {r.entrees.map((e) => {
              const actif = e.href === pathname || (e.href !== '/admin' && !e.href.includes('#') && pathname.startsWith(e.href));
              return (
                <li key={e.href}>
                  <Link href={e.href} onClick={onNaviguer} aria-current={actif ? 'page' : undefined}
                    className={`block px-2.5 py-1.5 rounded-lg text-sm transition-colors ${actif ? 'bg-white text-suguba-profond font-bold' : 'text-emerald-50 hover:bg-white/10'}`}>
                    {e.libelle}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Poste de travail de l'équipe (A1, 2026-09-27) — enveloppe de TOUTES les
 * pages /admin. Sur ordinateur : menu latéral des rubriques autorisées,
 * recherche globale (Ctrl+K), environnement affiché. Sur téléphone : une
 * barre « Menu · Rechercher » ouvre le même menu en tiroir. Les pages
 * existantes s'affichent telles quelles à droite.
 */
export default function PosteAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';
  const [poste, setPoste] = useState<Poste | null>(null);
  const [tiroir, setTiroir] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [env, setEnv] = useState({ libelle: '', classe: '' });

  useEffect(() => {
    setEnv(environnement());
    fetch('/api/admin/poste', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setPoste(p || { nom: '', libelleMetier: '', rubriques: [] }))
      .catch(() => setPoste({ nom: '', libelleMetier: '', rubriques: [] }));
  }, []);

  const ouvrirRecherche = useCallback(() => { setTiroir(false); setRecherche(true); }, []);
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ouvrirRecherche(); }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouvrirRecherche]);
  useEffect(() => { setTiroir(false); }, [pathname]);

  const entete = (
    <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/a-traiter" className="text-white font-extrabold tracking-tight text-lg">Suguba · Équipe</Link>
        {env.libelle && <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${env.classe}`}>{env.libelle}</span>}
      </div>
      <button type="button" onClick={ouvrirRecherche}
        className="w-full h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-emerald-50 text-sm inline-flex items-center gap-2">
        <Search className="w-4 h-4" /><span className="flex-1 text-left">Rechercher</span>
        <kbd className="text-[11px] font-semibold text-emerald-100/70">Ctrl K</kbd>
      </button>
    </div>
  );
  const pied = poste?.nom ? (
    <div className="px-4 py-3 border-t border-white/10 text-xs text-emerald-100/80 space-y-1">
      <p className="font-bold text-white truncate">{poste.nom}</p>
      {poste.libelleMetier && <p>{poste.libelleMetier}</p>}
      <Link href="/" className="inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />Voir le site</Link>
    </div>
  ) : null;

  return (
    <PosteAdminContexte.Provider value={true}>
      {/* Ordinateur : menu latéral fixe */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-suguba-profond">
        {entete}
        <div className="flex-1 overflow-y-auto"><Navigation poste={poste} pathname={pathname} /></div>
        {pied}
      </aside>

      {/* Téléphone et tablette : barre compacte + tiroir */}
      <div className="lg:hidden sticky top-16 z-40 bg-suguba-profond text-white px-4 h-11 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setTiroir(true)} className="inline-flex items-center gap-2 text-sm font-bold min-h-[44px]" aria-expanded={tiroir}>
          <Menu className="w-4 h-4" />Menu équipe
        </button>
        <div className="flex items-center gap-2">
          {env.libelle && <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${env.classe}`}>{env.libelle}</span>}
          <button type="button" onClick={ouvrirRecherche} aria-label="Rechercher" className="w-10 h-10 inline-flex items-center justify-center"><Search className="w-4 h-4" /></button>
        </div>
      </div>
      {tiroir && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu de l’équipe">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-slate-900/50" onClick={() => setTiroir(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-suguba-profond flex flex-col">
            <button type="button" onClick={() => setTiroir(false)} aria-label="Fermer" className="absolute top-3 right-3 w-9 h-9 text-white inline-flex items-center justify-center"><X className="w-5 h-5" /></button>
            {entete}
            <div className="flex-1 overflow-y-auto"><Navigation poste={poste} pathname={pathname} onNaviguer={() => setTiroir(false)} /></div>
            {pied}
          </div>
        </div>
      )}

      <div className="lg:pl-64">{children}</div>
      {recherche && <RechercheGlobale onFermer={() => setRecherche(false)} />}
    </PosteAdminContexte.Provider>
  );
}
