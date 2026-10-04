'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, Plus, Eye, Check, Crown, Clock, ListChecks, Settings2, RefreshCw } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, Skeleton, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import SelecteurArticles from '@/components/reseau/SelecteurArticles';
import { useToast } from '@/components/ui/Toast';
import { formatF } from '@/lib/montant';
import { pageMesArticles } from '@/lib/reseau/porte-boutique';

/**
 * Mes boutiques (2026-09-24) — revendeur ou fournisseur.
 *
 * Version gratuite : une boutique. Les formules Pro (réglées par l'admin)
 * en débloquent d'autres, chacune avec sa propre sélection d'articles, pour
 * viser des clients différents (ex. une boutique mode, une boutique maison).
 * La formule se paie par Mobile Money avec une référence ; Suguba l'active.
 *
 * Lot 6 du chantier boutique (2026-10-03) : la liste d'articles à cocher est
 * devenue src/components/reseau/SelecteurArticles.tsx, partagée avec « Mes rayons ».
 *
 * Lot 7 (2026-10-03), boutiques Pro au même niveau que la principale :
 *  - REVENDEUR : « Choisir les articles » mène à « Mes articles » de la boutique
 *    (?boutique=<id>) : y ajouter, ranger, mettre en coup de cœur, retirer. Son
 *    logo, sa couverture et son nom se changent par les crayons de sa vitrine
 *    (« Voir ») ;
 *  - FOURNISSEUR : la liste à cocher reste ici (le mode propriétaire côté
 *    fournisseur n'est pas dans ce chantier). Elle n'efface plus la sélection
 *    avant de la réécrire : une panne ne vide plus la boutique.
 *
 * Relecture du lot 7 (2026-10-03) : pour un fournisseur, « N article(s) choisis »
 * et le bouton « Enregistrer N article(s) » ne comptent plus un produit qui n'est
 * plus en vente (refusé, archivé) : la liste ne le montrait pas, il ne pouvait donc
 * pas être décoché. La route ne le renvoie plus, et l'enregistrement le retire.
 *
 * Relecture finale (2026-10-04) : la route renvoie `articles[<boutique>] = null`
 * quand la sélection d'une boutique n'a pas pu être lue. L'écran le DIT (« Articles
 * indisponibles pour le moment »), n'ouvre pas la liste à cocher et propose
 * « Réessayer ». Avant, la panne passait pour « 0 article(s) choisis » : la liste
 * du fournisseur s'ouvrait sans aucune coche, et « Enregistrer » retirait alors
 * tous les articles de la boutique.
 */

interface Boutique { id: string; slug: string; nom: string; quartier: string | null; principale: boolean; abonnes: number; statut: string }
interface Formule { id: string; nom: string; prixMensuel: number; boutiques: number }
interface Plan { id: string; formuleNom: string; boutiquesMax: number; prixMensuel: number; statut: string; reference: string; expireLe: string | null }
interface Article { id: string; nom: string; image: string | null; prix: number }
interface Donnees {
  /** `articles[id]` : null quand la sélection de cette boutique est illisible (jamais « vide »). */
  type: 'reseller' | 'supplier'; boutiques: Boutique[]; articles: Record<string, string[] | null>; catalogue: Article[];
  limite: number; formule: Formule; planActif: Plan | null; demande: Plan | null; disponible: boolean;
  formules: Formule[]; numeroPaiement: string;
}

const enF = formatF;
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
        {d.boutiques.map((b) => {
          // Sélection d'une boutique supplémentaire : une liste, ou rien de sûr
          // (null, ou clé absente). Jamais « [] » par défaut : voir l'en-tête.
          const choisis = d.articles[b.id];
          const illisible = !b.principale && !Array.isArray(choisis);
          return (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0"><Store className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{b.nom}</p>
                <p className="text-xs text-slate-500">/boutique/{b.slug}{b.quartier ? ` · ${b.quartier}` : ''}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {b.principale ? 'Boutique principale' : Array.isArray(choisis) ? `${choisis.length} article(s) choisis` : 'Articles indisponibles pour le moment'}
                </p>
              </div>
              {b.principale && <StatusPill ton="info">Principale</StatusPill>}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Même onglet (2026-10-03) : un nouvel onglet faisait sortir de l'application installée. */}
              <Button href={`/boutique/${b.slug}`} variant="ghost" size="sm"><Eye className="w-4 h-4" />Voir</Button>
              {b.principale ? (
                <Button href={`${espace}/boutique`} variant="ghost" size="sm"><Settings2 className="w-4 h-4" />Gérer</Button>
              ) : d.type === 'reseller' ? (
                <Button href={pageMesArticles(b.id)} variant="secondary" size="sm">
                  <ListChecks className="w-4 h-4" />Choisir les articles
                </Button>
              ) : illisible ? null : (
                <Button variant="secondary" size="sm" onClick={() => setSelection(selection === b.id ? null : b.id)}>
                  <ListChecks className="w-4 h-4" />Choisir les articles
                </Button>
              )}
              {illisible && (
                <Button variant="secondary" size="sm" onClick={() => { charger(); }}>
                  <RefreshCw className="w-4 h-4" />Réessayer
                </Button>
              )}
            </div>
            {illisible && (
              <p role="alert" className="text-xs text-amber-800">
                Les articles de cette boutique n’ont pas pu être lus. Rien n’a changé : réessayez avant de les modifier.
              </p>
            )}
            {!b.principale && d.type === 'reseller' && (
              <p className="text-xs text-slate-600">Logo, couverture et nom : touchez « Voir », puis les crayons de la boutique.</p>
            )}
            {selection === b.id && Array.isArray(choisis) && (
              <SelecteurArticles
                catalogue={d.catalogue}
                choisis={choisis}
                onEnregistrer={async (ids) => {
                  try { await poster({ action: 'articles', boutiqueId: b.id, produits: ids }); toast('Articles enregistrés.', { ton: 'succes' }); setSelection(null); await charger(); }
                  catch (e) { toast((e as Error).message, { ton: 'erreur' }); }
                }}
              />
            )}
          </Card>
          );
        })}
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
                {creation.envoi ? <SugubaLoader className="w-4 h-4" /> : <Check className="w-4 h-4" />}Créer la boutique
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
