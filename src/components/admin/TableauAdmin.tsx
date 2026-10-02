'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Columns3 } from 'lucide-react';

/**
 * Tableau de l'espace équipe (lot U4, 2026-09-27) — les listes pensées pour
 * le téléphone (une carte par ligne) montraient trois fois moins de lignes
 * qu'un tableau sur ordinateur.
 *
 * - Tri par colonne (sur la page affichée), en cliquant sur l'en-tête.
 * - Colonnes à afficher ou masquer, retenues par ce navigateur.
 * - Sélection de plusieurs lignes quand la page propose une action groupée.
 * - Ligne cliquable (ou Entrée) : ouvre le dossier dans le panneau latéral.
 * - Ligne ciblée par un lien (?id=…) : surlignée et amenée à l'écran.
 * - Sous 768 px : une carte par ligne, comme avant.
 */

const OMBRE_COLLANTE = 'shadow-[-8px_0_8px_-8px_rgb(15_23_42/0.18)]';

export interface Colonne<T> {
  cle: string;
  titre: string;
  rendu: (ligne: T) => React.ReactNode;
  /** Valeur de tri ; sans elle, la colonne ne se trie pas. */
  tri?: (ligne: T) => string | number | null | undefined;
  droite?: boolean;
  /** Masquée tant que l'utilisateur ne l'affiche pas. */
  cachee?: boolean;
  /** Toujours affichée (ne figure pas dans le choix des colonnes). */
  fixe?: boolean;
  classe?: string;
}

interface Props<T> {
  lignes: T[];
  colonnes: Colonne<T>[];
  cleLigne: (ligne: T) => string;
  /** Nom du tableau pour retenir les colonnes choisies (ex. « commandes »). */
  memoire: string;
  titre: string;
  onOuvrir?: (ligne: T) => void;
  selection?: {
    choisies: Set<string>;
    onChange: (choisies: Set<string>) => void;
    possible?: (ligne: T) => boolean;
  };
  cible?: string | null;
  carteMobile?: (ligne: T) => React.ReactNode;
  /** Contenu à gauche de la barre d'outils (actions groupées…). */
  barre?: React.ReactNode;
}

const CLE_STOCKAGE = (m: string) => `suguba_colonnes_${m}`;

function lireColonnes(memoire: string): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_STOCKAGE(memoire)) || 'null');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null;
  } catch { return null; }
}

const INTERACTIF = 'a,button,input,select,textarea,label,[role="checkbox"]';

export default function TableauAdmin<T>({ lignes, colonnes, cleLigne, memoire, titre, onOuvrir, selection, cible, carteMobile, barre }: Props<T>) {
  const parDefaut = useMemo(() => colonnes.filter((c) => !c.cachee).map((c) => c.cle), [colonnes]);
  const [visibles, setVisibles] = useState<string[]>(parDefaut);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [tri, setTri] = useState<{ cle: string; sens: 1 | -1 } | null>(null);
  const choixRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const v = lireColonnes(memoire); if (v?.length) setVisibles(v); }, [memoire]);
  useEffect(() => {
    if (!choixOuvert) return;
    const fermer = (e: MouseEvent) => { if (!choixRef.current?.contains(e.target as Node)) setChoixOuvert(false); };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, [choixOuvert]);

  // Ligne ciblée par le lien : l'amener à l'écran une fois chargée.
  useEffect(() => {
    if (!cible || !lignes.some((l) => cleLigne(l) === cible)) return;
    const candidates = document.querySelectorAll<HTMLElement>(`[data-dossier="${CSS.escape(cible)}"]`);
    const visible = [...candidates].find((el) => el.getClientRects().length > 0);
    visible?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cible, lignes, cleLigne]);

  const basculer = (cle: string) => {
    const suivantes = visibles.includes(cle) ? visibles.filter((c) => c !== cle) : [...visibles, cle];
    setVisibles(suivantes);
    try { localStorage.setItem(CLE_STOCKAGE(memoire), JSON.stringify(suivantes)); } catch { /* stockage indisponible */ }
  };

  const affichees = colonnes.filter((c) => c.fixe || visibles.includes(c.cle));
  const triees = useMemo(() => {
    if (!tri) return lignes;
    const col = colonnes.find((c) => c.cle === tri.cle);
    if (!col?.tri) return lignes;
    const valeur = col.tri;
    return [...lignes].sort((a, b) => {
      const va = valeur(a), vb = valeur(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr', { numeric: true })) * tri.sens;
    });
  }, [lignes, colonnes, tri]);

  const selectionnables = selection ? triees.filter((l) => selection.possible?.(l) ?? true) : [];
  const toutes = selectionnables.length > 0 && selectionnables.every((l) => selection!.choisies.has(cleLigne(l)));
  const cocher = (id: string, oui: boolean) => {
    if (!selection) return;
    const s = new Set(selection.choisies);
    if (oui) s.add(id); else s.delete(id);
    selection.onChange(s);
  };

  const ouvrirSiLigne = (e: React.MouseEvent | React.KeyboardEvent, l: T) => {
    if (!onOuvrir || (e.target as HTMLElement).closest(INTERACTIF)) return;
    if ('key' in e && e.key !== 'Enter') return;
    onOuvrir(l);
  };

  const masquables = colonnes.filter((c) => !c.fixe);
  // ADM-01 (audit UI/UX du 2026-10-02) : sur un écran étroit, le tableau défile et
  // perdait d'abord sa DERNIÈRE colonne, celle des actions (« Actio… », boutons
  // coupés). La dernière colonne fixe et à droite reste collée au bord.
  const collante = (c: Colonne<T>, i: number) => Boolean(c.fixe && c.droite && i === affichees.length - 1);

  return (
    <div className="space-y-2">
      {/* ADM-12 (audit UI/UX du 2026-10-02) : sans outil à afficher (mobile, où
          « Colonnes » est masqué), la barre laissait une bande vide de 40 px. */}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${barre ? 'min-h-[40px]' : masquables.length > 0 ? 'hidden md:flex md:min-h-[40px]' : 'hidden'}`}>
        <div className="flex flex-wrap items-center gap-2">{barre}</div>
        {masquables.length > 0 && (
          <div className="relative hidden md:block" ref={choixRef}>
            <button type="button" onClick={() => setChoixOuvert((v) => !v)} aria-expanded={choixOuvert}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700">
              <Columns3 className="w-4 h-4" />Colonnes
            </button>
            {choixOuvert && (
              <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-2">
                {masquables.map((c) => (
                  <label key={c.cle} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={visibles.includes(c.cle)} onChange={() => basculer(c.cle)} className="accent-suguba-profond" />
                    {c.titre}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ordinateur et tablette */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm" aria-label={titre}>
          <thead>
            <tr className="text-left text-xs font-bold text-slate-600">
              {selection && (
                <th scope="col" className="w-10 px-3 py-3 bg-slate-50 lg:sticky lg:top-0 z-10 first:rounded-tl-3xl">
                  <input type="checkbox" aria-label="Tout sélectionner sur cette page" checked={toutes} disabled={!selectionnables.length}
                    onChange={(e) => selection.onChange(e.target.checked ? new Set([...selection.choisies, ...selectionnables.map(cleLigne)]) : new Set())}
                    className="accent-suguba-profond w-4 h-4" />
                </th>
              )}
              {affichees.map((c, i) => {
                const actif = tri?.cle === c.cle;
                return (
                  <th key={c.cle} scope="col" aria-sort={actif ? (tri!.sens === 1 ? 'ascending' : 'descending') : undefined}
                    className={`px-3 py-3 bg-slate-50 lg:sticky lg:top-0 z-10 whitespace-nowrap first:rounded-tl-3xl last:rounded-tr-3xl ${c.droite ? 'text-right' : ''} ${collante(c, i) ? `sticky right-0 z-20 ${OMBRE_COLLANTE}` : ''} ${c.classe || ''}`}>
                    {c.tri ? (
                      <button type="button" onClick={() => setTri(actif ? { cle: c.cle, sens: tri!.sens === 1 ? -1 : 1 } : { cle: c.cle, sens: 1 })}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${actif ? 'text-slate-900' : ''}`}>
                        {c.titre}
                        {actif ? (tri!.sens === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : null}
                      </button>
                    ) : c.titre}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {triees.map((l) => {
              const id = cleLigne(l);
              const choisie = selection?.choisies.has(id);
              const ciblee = cible === id;
              return (
                <tr key={id} data-dossier={id} tabIndex={onOuvrir ? 0 : undefined}
                  onClick={(e) => ouvrirSiLigne(e, l)} onKeyDown={(e) => ouvrirSiLigne(e, l)}
                  className={`group align-top ${onOuvrir ? 'cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-suguba-sauge' : ''} ${choisie ? 'bg-suguba-menthe/60' : ''} ${ciblee ? 'bg-suguba-menthe outline outline-2 -outline-offset-2 outline-suguba-profond' : ''}`}>
                  {selection && (
                    <td className="px-3 py-3">
                      {(selection.possible?.(l) ?? true) && (
                        <input type="checkbox" aria-label="Sélectionner" checked={Boolean(choisie)} onChange={(e) => cocher(id, e.target.checked)} className="accent-suguba-profond w-4 h-4" />
                      )}
                    </td>
                  )}
                  {affichees.map((c, i) => (
                    <td key={c.cle} className={`px-3 py-3 text-slate-800 ${c.droite ? 'text-right tabular-nums whitespace-nowrap' : ''} ${collante(c, i) ? `sticky right-0 ${OMBRE_COLLANTE} ${ciblee || choisie ? 'bg-suguba-menthe' : onOuvrir ? 'bg-white group-hover:bg-slate-50' : 'bg-white'}` : ''} ${c.classe || ''}`}>{c.rendu(l)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Téléphone : une carte par ligne */}
      <ul className="md:hidden space-y-2" aria-label={titre}>
        {triees.map((l) => {
          const id = cleLigne(l);
          const ciblee = cible === id;
          return (
            <li key={id} data-dossier={id} tabIndex={onOuvrir ? 0 : undefined}
              onClick={(e) => ouvrirSiLigne(e, l)} onKeyDown={(e) => ouvrirSiLigne(e, l)}
              className={`bg-white rounded-3xl border p-4 flex gap-3 ${ciblee ? 'border-suguba-profond ring-2 ring-suguba-profond' : 'border-slate-200'} ${onOuvrir ? 'cursor-pointer active:bg-slate-50' : ''}`}>
              {selection && (selection.possible?.(l) ?? true) && (
                <input type="checkbox" aria-label="Sélectionner" checked={selection.choisies.has(id)} onChange={(e) => cocher(id, e.target.checked)} className="accent-suguba-profond w-5 h-5 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {carteMobile ? carteMobile(l) : (
                  <dl className="space-y-1">
                    {affichees.map((c) => (
                      <div key={c.cle} className="flex justify-between gap-3 text-sm">
                        <dt className="text-slate-500 shrink-0">{c.titre}</dt>
                        <dd className="text-slate-900 text-right min-w-0 break-words">{c.rendu(l)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
