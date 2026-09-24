'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, Plus, ExternalLink, Check, Loader2, Crown, Clock, ListChecks, Settings2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, Skeleton, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import ProductImage from '@/components/common/ProductImage';
import { useToast } from '@/components/ui/Toast';

/**
 * Mes boutiques (2026-09-24) — revendeur ou fournisseur.
 *
 * Version gratuite : une boutique. Les formules Pro (réglées par l'admin)
 * en débloquent d'autres, chacune avec sa propre sélection d'articles, pour
 * viser des clients différents (ex. une boutique mode, une boutique maison).
 * La formule se paie par Mobile Money avec une référence ; Suguba l'active.
 */

interface Boutique { id: string; slug: string; nom: string; quartier: string | null; principale: boolean; abonnes: number; statut: string }
interface Formule { id: string; nom: string; prixMensuel: number; boutiques: number }
interface Plan { id: string; formuleNom: string; boutiquesMax: number; prixMensuel: number; statut: string; reference: string; expireLe: string | null }
interface Article { id: string; nom: string; image: string | null; prix: number }
interface Donnees {
  type: 'reseller' | 'supplier'; boutiques: Boutique[]; articles: Record<string, string[]>; catalogue: Article[];
  limite: number; formule: Formule; planActif: Plan | null; demande: Plan | null; disponible: boolean;
  formules: Formule[]; numeroPaiement: string;
}

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export default function MesBoutiquesPage() {
  const { toast, confirmer } = useToast();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState('');
  const [creation, setCreation] = useState({ ouvert: false, nom: '', quartier: '', envoi: false });
  const [selection, setSelection] = useState<string | null>(null);

  const charger = useCallback(() => fetch('/api/compte/boutiques', { cache: 'no-store' })
    .then((r) => r.json()).then((j) => { if (j.error) setErreur(j.error); else setD(j); })
    .catch(() => setErreur('Connexion impossible.')), []);
  useEffect(() => { charger(); }, [charger]);

  const poster = async (corps: Record<string, unknown>) => {
    const r = await fetch('/api/compte/boutiques', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Action impossible.');
    return j;
  };

  const creer = async () => {
    setCreation((c) => ({ ...c, envoi: true }));
    try {
      await poster({ action: 'creer', nom: creation.nom, quartier: creation.quartier || null });
      toast('Boutique créée. Choisissez maintenant ses articles.', { ton: 'succes' });
      setCreation({ ouvert: false, nom: '', quartier: '', envoi: false });
      await charger();
    } catch (e) {
      toast((e as Error).message, { ton: 'erreur' });
      setCreation((c) => ({ ...c, envoi: false }));
    }
  };

  const choisirFormule = async (f: Formule) => {
    const ok = await confirmer({
      titre: `Passer à la formule ${f.nom} ?`,
      message: `${enF(f.prixMensuel)} par mois pour ${f.boutiques} boutiques. Vous recevrez une référence pour payer par Mobile Money ; Suguba active la formule dès réception.`,
      confirmer: 'Demander',
    });
    if (!ok) return;
    try { await poster({ action: 'demander_formule', formuleId: f.id }); toast('Demande envoyée.', { ton: 'succes' }); await charger(); }
    catch (e) { toast((e as Error).message, { ton: 'erreur' }); }
  };

  if (erreur) return <PageReseau titre="Mes boutiques"><Card><p className="text-sm text-slate-700">{erreur}</p></Card></PageReseau>;
  if (!d) return <PageReseau titre="Mes boutiques"><Skeleton className="h-40" /></PageReseau>;

  const espace = d.type === 'supplier' ? '/supplier' : '/reseller';
  const pleine = d.boutiques.length >= d.limite;

  return (
    <PageReseau titre="Mes boutiques" sousTitre="Une boutique par type de clients, chacune avec ses articles." retour={{ href: espace, libelle: 'Mon espace' }}>
      {/* Formule */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-full bg-suguba-citron text-suguba-profond flex items-center justify-center"><Crown className="w-5 h-5" /></span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Formule {d.formule.nom}</p>
              <p className="text-xs text-slate-600">{d.boutiques.length} / {d.limite} boutique{d.limite > 1 ? 's' : ''} utilisée{d.boutiques.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          {d.planActif?.expireLe && <StatusPill ton="succes">Jusqu’au {date(d.planActif.expireLe)}</StatusPill>}
        </div>
        {d.demande && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Demande « {d.demande.formuleNom} » en attente</p>
            <p>Envoyez <strong>{enF(d.demande.prixMensuel)}</strong> par Orange Money ou Moov Money au <strong>{d.numeroPaiement}</strong> avec la référence <strong className="tracking-wider">{d.demande.reference}</strong>. Suguba active votre formule dès réception.</p>
          </div>
        )}
        {!d.disponible && <p className="text-xs text-amber-800">Les boutiques supplémentaires arrivent bientôt (mise à jour en cours chez Suguba).</p>}
      </Card>

      {/* Boutiques */}
      <div className="space-y-3">
        {d.boutiques.map((b) => (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0"><Store className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{b.nom}</p>
                <p className="text-xs text-slate-500">/boutique/{b.slug}{b.quartier ? ` · ${b.quartier}` : ''}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {b.principale ? 'Boutique principale' : `${(d.articles[b.id] || []).length} article(s) choisis`}
                </p>
              </div>
              {b.principale && <StatusPill ton="info">Principale</StatusPill>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button href={`/boutique/${b.slug}`} target="_blank" variant="ghost" size="sm"><ExternalLink className="w-4 h-4" />Voir</Button>
              {b.principale ? (
                <Button href={`${espace}/boutique`} variant="ghost" size="sm"><Settings2 className="w-4 h-4" />Gérer</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setSelection(selection === b.id ? null : b.id)}>
                  <ListChecks className="w-4 h-4" />Choisir les articles
                </Button>
              )}
            </div>
            {selection === b.id && (
              <SelecteurArticles
                catalogue={d.catalogue}
                choisis={d.articles[b.id] || []}
                onEnregistrer={async (ids) => {
                  try { await poster({ action: 'articles', boutiqueId: b.id, produits: ids }); toast('Articles enregistrés.', { ton: 'succes' }); setSelection(null); await charger(); }
                  catch (e) { toast((e as Error).message, { ton: 'erreur' }); }
                }}
              />
            )}
          </Card>
        ))}
      </div>

      {/* Nouvelle boutique */}
      {/* Sans la mise à jour de la base, créer une boutique échouerait : on ne le propose pas. */}
      {!d.disponible ? null : !pleine ? (
        creation.ouvert ? (
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Nouvelle boutique</h2>
            <Field label="Nom de la boutique" htmlFor="nb-nom" requis>
              <Input id="nb-nom" value={creation.nom} maxLength={80} placeholder="Ex. : Awa Mode & Beauté" onChange={(e) => setCreation({ ...creation, nom: e.target.value })} />
            </Field>
            <Field label="Quartier (facultatif)" htmlFor="nb-quartier">
              <NeighborhoodPicker id="nb-quartier" value={creation.quartier} onChange={(q) => setCreation({ ...creation, quartier: q === 'Autre quartier' ? '' : q })} placeholder="Choisir un quartier" />
            </Field>
            <div className="flex gap-2">
              <Button onClick={creer} disabled={creation.envoi || creation.nom.trim().length < 2} fullWidth>
                {creation.envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Créer la boutique
              </Button>
              <Button variant="ghost" onClick={() => setCreation({ ouvert: false, nom: '', quartier: '', envoi: false })}>Annuler</Button>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setCreation({ ...creation, ouvert: true })} variant="secondary" fullWidth><Plus className="w-4 h-4" />Créer une boutique</Button>
        )
      ) : (
        <p className="text-xs text-slate-600 text-center">Vous avez atteint la limite de votre formule. Passez à une formule supérieure pour ouvrir une autre boutique.</p>
      )}

      {/* Formules */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Les formules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {d.formules.map((f) => {
            const actuelle = f.id === d.formule.id;
            return (
              <div key={f.id} className={`rounded-2xl border p-3 space-y-2 ${actuelle ? 'border-suguba-profond bg-suguba-menthe' : 'border-slate-200'}`}>
                <p className="text-sm font-semibold text-slate-900">{f.nom}</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">{enF(f.prixMensuel)}<span className="text-xs font-normal text-slate-500"> / mois</span></p>
                <p className="text-xs text-slate-600">{f.boutiques} boutique{f.boutiques > 1 ? 's' : ''}</p>
                {actuelle ? (
                  <p className="text-xs font-semibold text-suguba-profond flex items-center gap-1"><Check className="w-3.5 h-3.5" />Votre formule</p>
                ) : f.prixMensuel > 0 && f.boutiques > d.limite && !d.demande && d.disponible ? (
                  <Button size="sm" onClick={() => choisirFormule(f)} fullWidth>Choisir</Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-slate-500 text-center">
        Besoin d’aide ? <Link href="https://wa.me/22389460000" className="underline">Écrivez à Suguba sur WhatsApp</Link>.
      </p>
    </PageReseau>
  );
}

function SelecteurArticles({ catalogue, choisis, onEnregistrer }: { catalogue: Article[]; choisis: string[]; onEnregistrer: (ids: string[]) => Promise<void> }) {
  const [ids, setIds] = useState<string[]>(choisis);
  const [filtre, setFiltre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const visibles = catalogue.filter((a) => !filtre || a.nom.toLowerCase().includes(filtre.toLowerCase()));
  const basculer = (id: string) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un article" aria-label="Rechercher un article" />
      <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {visibles.length === 0 && <li className="p-3 text-xs text-slate-500">Aucun article.</li>}
        {visibles.map((a) => {
          const coche = ids.includes(a.id);
          return (
            <li key={a.id}>
              <label className="flex items-center gap-3 p-2.5 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-suguba-profond" checked={coche} onChange={() => basculer(a.id)} />
                <span className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0"><ProductImage src={a.image || ''} alt="" fill className="object-cover" /></span>
                <span className="min-w-0 flex-1 text-xs"><span className="block font-semibold text-slate-900 truncate">{a.nom}</span><span className="text-slate-500">{enF(a.prix)}</span></span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button onClick={async () => { setEnvoi(true); await onEnregistrer(ids); setEnvoi(false); }} disabled={envoi} fullWidth>
        {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Enregistrer {ids.length} article(s)
      </Button>
    </div>
  );
}
