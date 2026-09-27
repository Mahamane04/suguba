'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Columns3, Save, Trash2, ChevronUp, ChevronDown, Table2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import ChoixUniteVente, { SAISIE_UNITE_VIDE, type SaisieUnite } from '@/components/produit/ChoixUniteVente';
import { COLONNES_CATALOGUE, FILTRES_PAR_DEFAUT, colonnesValides, type Apercu, type FiltresCatalogue } from '@/lib/admin/tableau';

interface Ligne { id: string; nom: string; slug: string; categorie: string; statut: string; prix: number; stock: number; fournisseur: string; photos: number; creeLe: string; unite: string }
interface Reponse { total: number; page: number; taillePage: number; categories: string[]; lignes: Ligne[]; avecUnite: boolean }
interface Vue { id: string; nom: string; config: { filtres?: Partial<FiltresCatalogue>; colonnes?: string[] } }

const STATUTS: Record<string, string> = { approved: 'En vente', submitted: 'Soumis', pending: 'En attente', rejected: 'Refusé', hidden: 'Masqué' };
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

function versParams(f: FiltresCatalogue, page?: number): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== '' && v !== false) p.set(k, String(v));
  if (page) p.set('page', String(page));
  return p;
}

/**
 * Catalogue en tableau (A4, 2026-09-27) — pour travailler sur ordinateur :
 * filtres et tri faits par le serveur sur TOUT le catalogue, colonnes au
 * choix, vues enregistrées par membre, sélection (cette page ou tous les
 * résultats du filtre), actions groupées avec aperçu, export CSV (droit
 * dédié). Photos et prix se gèrent toujours dans « Produits ».
 */
export default function CatalogueTableauPage() {
  const { toast, demander: demanderTexte } = useToast();
  const [filtres, setFiltres] = useState<FiltresCatalogue>(FILTRES_PAR_DEFAUT);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [colonnes, setColonnes] = useState<string[]>(colonnesValides(null));
  const [menuColonnes, setMenuColonnes] = useState(false);
  const [vues, setVues] = useState<Vue[]>([]);
  const [peutExporter, setPeutExporter] = useState(false);
  const [peutModifier, setPeutModifier] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [tousLeFiltre, setTousLeFiltre] = useState(false);
  const [action, setAction] = useState<'' | 'categorie' | 'unite'>('');
  const [categorieCible, setCategorieCible] = useState('');
  const [uniteCible, setUniteCible] = useState<SaisieUnite>(SAISIE_UNITE_VIDE);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback((f: FiltresCatalogue, p: number) => {
    setErreur('');
    fetch(`/api/admin/catalogue?${versParams(f, p)}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j as Reponse; })
      .then(setDonnees)
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { const t = setTimeout(() => charger(filtres, page), 250); return () => clearTimeout(t); }, [filtres, page, charger]);

  const chargerVues = useCallback(() => {
    fetch('/api/admin/vues?page=catalogue', { cache: 'no-store' }).then((r) => r.json()).then((j) => setVues(j.vues || [])).catch(() => undefined);
  }, []);
  useEffect(() => {
    chargerVues();
    fetch('/api/admin/poste', { cache: 'no-store' }).then((r) => r.json()).then((p) => {
      setPeutExporter((p.permissions || []).includes('donnees.exporter'));
      setPeutModifier((p.permissions || []).includes('produit.moderer'));
    }).catch(() => undefined);
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setFiltres((f) => ({ ...f, q }));
  }, [chargerVues]);

  const changer = (maj: Partial<FiltresCatalogue>) => { setFiltres((f) => ({ ...f, ...maj })); setPage(1); setSelection(new Set()); setTousLeFiltre(false); };
  const trier = (tri: FiltresCatalogue['tri']) => changer({ tri, sens: filtres.tri === tri && filtres.sens === 'desc' ? 'asc' : 'desc' });

  async function enregistrerVue() {
    const nom = await demanderTexte({
      titre: 'Enregistrer cette vue', message: 'Filtres et colonnes actuels, retrouvés en un clic (visibles par vous seul).',
      libelle: 'Nom de la vue', placeholder: 'Ex. : Sans unité', min: 2, confirmer: 'Enregistrer',
    });
    if (!nom) return;
    const r = await fetch('/api/admin/vues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'catalogue', nom, config: { filtres, colonnes } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
    toast('Vue enregistrée.', { ton: 'succes' }); chargerVues();
  }
  async function supprimerVue(v: Vue) {
    const r = await fetch(`/api/admin/vues?id=${v.id}`, { method: 'DELETE' });
    if (r.ok) chargerVues(); else toast('Suppression impossible.', { ton: 'erreur' });
  }
  const appliquerVue = (v: Vue) => { setColonnes(colonnesValides(v.config.colonnes)); changer({ ...FILTRES_PAR_DEFAUT, ...(v.config.filtres || {}) }); };

  const ids = useMemo(() => (donnees?.lignes || []).map((l) => l.id), [donnees]);
  const toutePage = ids.length > 0 && ids.every((id) => selection.has(id));
  const nbSelection = tousLeFiltre ? Math.min(donnees?.total || 0, 500) : selection.size;

  async function demander(confirmer: boolean) {
    if (!action) return;
    setEnvoi(true);
    try {
      const valeur = action === 'categorie' ? categorieCible : { unite: uniteCible.unite, contenu: uniteCible.contenu, mesure: uniteCible.mesure, quantiteMin: uniteCible.quantiteMin };
      const r = await fetch('/api/admin/produits-groupes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, valeur, confirmer, ...(tousLeFiltre ? { filtre: filtres } : { ids: [...selection] }) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Action impossible.', { ton: 'erreur' }); return; }
      if (!confirmer) { setApercu(j.apercu); return; }
      toast(`${j.modifies} produit${j.modifies > 1 ? 's' : ''} modifié${j.modifies > 1 ? 's' : ''}${j.exclus ? `, ${j.exclus} exclu${j.exclus > 1 ? 's' : ''}` : ''}.`, { ton: 'succes' });
      setApercu(null); setAction(''); setSelection(new Set()); setTousLeFiltre(false); charger(filtres, page);
    } finally { setEnvoi(false); }
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taillePage)) : 1;
  const enTete = (cle: string, titre: string, tri?: FiltresCatalogue['tri']) => colonnes.includes(cle) && (
    <th key={cle} className="px-3 py-2 font-bold whitespace-nowrap" aria-sort={tri && filtres.tri === tri ? (filtres.sens === 'asc' ? 'ascending' : 'descending') : undefined}>
      {tri ? (
        <button type="button" onClick={() => trier(tri)} className="inline-flex items-center gap-1 hover:underline">
          {titre}{filtres.tri === tri && (filtres.sens === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      ) : titre}
    </th>
  );

  return (
    <PageReseau titre="Catalogue en tableau" large sousTitre="Filtrer, trier, sélectionner et modifier plusieurs produits à la fois."
      action={<Link href="/admin/products" className="text-xs font-bold text-suguba-brand-dark underline">Photos et prix : Produits</Link>}>

      <div className="flex flex-wrap gap-2 items-center">
        <input type="search" value={filtres.q} onChange={(e) => changer({ q: e.target.value })} aria-label="Rechercher"
          placeholder="Produit, fournisseur, identifiant…" className="flex-1 min-w-[14rem] h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm" />
        <select value={filtres.statut} onChange={(e) => changer({ statut: e.target.value as FiltresCatalogue['statut'] })} aria-label="Statut" className="h-10 px-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtres.categorie} onChange={(e) => changer({ categorie: e.target.value })} aria-label="Catégorie" className="h-10 px-2 rounded-xl border border-slate-200 bg-white text-sm max-w-[14rem]">
          <option value="">Toutes les catégories</option>
          {(donnees?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filtres.sansPhoto} onChange={(e) => changer({ sansPhoto: e.target.checked })} />Sans photo</label>
        <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filtres.sansUnite} onChange={(e) => changer({ sansUnite: e.target.checked })} />Sans unité</label>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Vues enregistrées" value="" onChange={(e) => { const v = vues.find((x) => x.id === e.target.value); if (v) appliquerVue(v); }} className="h-9 px-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="">{vues.length ? 'Mes vues…' : 'Aucune vue enregistrée'}</option>
          {vues.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
        </select>
        <Button type="button" variant="ghost" size="sm" onClick={enregistrerVue}><Save className="w-4 h-4" />Enregistrer la vue</Button>
        {vues.length > 0 && (
          <details className="relative">
            <summary className="list-none cursor-pointer h-9 px-3 rounded-xl text-sm font-semibold text-slate-600 inline-flex items-center gap-1 hover:bg-slate-100"><Trash2 className="w-4 h-4" />Vues</summary>
            <div className="absolute z-20 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
              {vues.map((v) => <button key={v.id} type="button" onClick={() => supprimerVue(v)} className="w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-rose-50">Retirer « {v.nom} »</button>)}
            </div>
          </details>
        )}
        <div className="relative">
          <Button type="button" variant="ghost" size="sm" aria-expanded={menuColonnes} onClick={() => setMenuColonnes((o) => !o)}><Columns3 className="w-4 h-4" />Colonnes</Button>
          {menuColonnes && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
              {COLONNES_CATALOGUE.map((c) => (
                <label key={c.cle} className="flex items-center gap-2 text-sm px-1">
                  <input type="checkbox" checked={colonnes.includes(c.cle)} disabled={c.cle === 'nom'}
                    onChange={(e) => setColonnes((l) => e.target.checked ? [...l, c.cle] : l.filter((x) => x !== c.cle))} />{c.titre}
                </label>
              ))}
            </div>
          )}
        </div>
        {peutExporter && (
          <a href={`/api/admin/export?type=catalogue&${versParams(filtres)}`} className="h-9 px-3 rounded-xl text-sm font-semibold text-slate-700 inline-flex items-center gap-1 hover:bg-slate-100">
            <Download className="w-4 h-4" />Exporter (CSV)
          </a>
        )}
        {donnees && <span className="ml-auto text-xs text-slate-500">{donnees.total.toLocaleString('fr-FR')} produit{donnees.total > 1 ? 's' : ''}</span>}
      </div>

      {peutModifier && nbSelection > 0 && (
        <Card className="!bg-slate-900 !border-slate-900 text-white space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{nbSelection} sélectionné{nbSelection > 1 ? 's' : ''}</strong>
            {toutePage && !tousLeFiltre && donnees && donnees.total > ids.length && (
              <button type="button" onClick={() => setTousLeFiltre(true)} className="underline">Sélectionner les {Math.min(donnees.total, 500)} résultats du filtre</button>
            )}
            {tousLeFiltre && <span className="text-emerald-200">Tous les résultats du filtre (500 au plus)</span>}
            <button type="button" onClick={() => { setSelection(new Set()); setTousLeFiltre(false); setApercu(null); setAction(''); }} className="underline ml-auto">Annuler la sélection</button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <select aria-label="Action groupée" value={action} onChange={(e) => { setAction(e.target.value as typeof action); setApercu(null); }} className="h-9 px-2 rounded-xl text-slate-900 text-sm">
              <option value="">Choisir une action…</option>
              <option value="categorie">Changer la catégorie</option>
              <option value="unite">Changer l’unité de vente</option>
            </select>
            {action === 'categorie' && <input value={categorieCible} onChange={(e) => setCategorieCible(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" list="categories-existantes" className="h-9 px-3 rounded-xl text-slate-900 text-sm" />}
            <datalist id="categories-existantes">{(donnees?.categories || []).map((c) => <option key={c} value={c} />)}</datalist>
            {action && <Button type="button" size="sm" variant="secondary" disabled={envoi} onClick={() => demander(false)}>Voir l’aperçu</Button>}
          </div>
          {action === 'unite' && <div className="bg-white rounded-xl p-3 text-slate-900 max-w-md"><ChoixUniteVente id="unite-groupe" compact valeur={uniteCible} onChange={setUniteCible} /></div>}
        </Card>
      )}

      {apercu && (
        <Card className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900">Aperçu : {apercu.concernes.length} produit{apercu.concernes.length > 1 ? 's' : ''} modifié{apercu.concernes.length > 1 ? 's' : ''}, {apercu.exclus.length} exclu{apercu.exclus.length > 1 ? 's' : ''}</h2>
          <ul className="text-xs text-slate-700 max-h-40 overflow-y-auto space-y-0.5">
            {apercu.concernes.slice(0, 50).map((c) => <li key={c.id}>{c.nom} : {c.avant} → <strong>{c.apres}</strong></li>)}
            {apercu.concernes.length > 50 && <li>… et {apercu.concernes.length - 50} autres</li>}
          </ul>
          {apercu.exclus.length > 0 && (
            <ul className="text-xs text-amber-800 max-h-32 overflow-y-auto space-y-0.5">
              {apercu.exclus.slice(0, 50).map((x) => <li key={x.id}>Exclu — {x.nom} : {x.raison}</li>)}
            </ul>
          )}
          <p className="text-xs text-slate-500">Le prix et la visibilité ne changent pas. Chaque modification est inscrite au journal.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={envoi || apercu.concernes.length === 0} onClick={() => demander(true)}>Confirmer la modification</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setApercu(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {erreur ? <EmptyState icone={Table2} titre="Catalogue indisponible" texte={erreur} />
        : !donnees ? <Skeleton className="h-96" />
        : donnees.lignes.length === 0 ? <EmptyState icone={Table2} titre="Aucun produit" texte="Aucun produit ne correspond à ces filtres." />
        : (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  {peutModifier && (
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" aria-label="Sélectionner cette page" checked={toutePage}
                        onChange={(e) => { setTousLeFiltre(false); setSelection(e.target.checked ? new Set(ids) : new Set()); }} />
                    </th>
                  )}
                  {enTete('nom', 'Produit', 'name')}{enTete('categorie', 'Catégorie')}{enTete('fournisseur', 'Fournisseur', 'supplier_name')}
                  {enTete('prix', 'Prix', 'public_price')}{enTete('unite', 'Unité')}{enTete('stock', 'Stock', 'stock')}
                  {enTete('statut', 'Statut')}{enTete('photos', 'Photos')}{enTete('creeLe', 'Créé le', 'created_at')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donnees.lignes.map((l) => (
                  <tr key={l.id} className={selection.has(l.id) || tousLeFiltre ? 'bg-suguba-50/50' : 'hover:bg-slate-50'}>
                    {peutModifier && (
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Sélectionner ${l.nom}`} checked={tousLeFiltre || selection.has(l.id)}
                        onChange={(e) => { setTousLeFiltre(false); setSelection((s) => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; }); }} /></td>
                    )}
                    {colonnes.includes('nom') && <td className="px-3 py-2 font-semibold text-slate-900 max-w-[18rem] truncate"><Link href={`/p/${l.slug}`} target="_blank" className="hover:underline">{l.nom}</Link></td>}
                    {colonnes.includes('categorie') && <td className="px-3 py-2 text-slate-700">{l.categorie}</td>}
                    {colonnes.includes('fournisseur') && <td className="px-3 py-2 text-slate-700">{l.fournisseur}</td>}
                    {colonnes.includes('prix') && <td className="px-3 py-2 tabular-nums whitespace-nowrap">{l.prix ? fcfa(l.prix) : '—'}</td>}
                    {colonnes.includes('unite') && <td className="px-3 py-2 text-slate-700">{l.unite || <span className="text-amber-700">À renseigner</span>}</td>}
                    {colonnes.includes('stock') && <td className="px-3 py-2 tabular-nums">{l.stock}</td>}
                    {colonnes.includes('statut') && <td className="px-3 py-2 text-xs">{STATUTS[l.statut] || l.statut}</td>}
                    {colonnes.includes('photos') && <td className="px-3 py-2 tabular-nums">{l.photos || <span className="text-amber-700">0</span>}</td>}
                    {colonnes.includes('creeLe') && <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{new Date(l.creeLe).toLocaleDateString('fr-FR')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-3 text-sm">
              <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <span className="text-xs text-slate-500">Page {page} sur {pages}</span>
              <Button type="button" variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </Card>
        )}
      {donnees && !donnees.avecUnite && <p className="text-xs text-amber-800">Colonne « Unité » vide : SQL de l’unité de vente non exécuté.</p>}
    </PageReseau>
  );
}
