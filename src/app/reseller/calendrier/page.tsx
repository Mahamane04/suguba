'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Loader2, Check, Share2, Target, X } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { useSugubaStore } from '@/lib/store';
import { partagerProduit, useCodeRevendeur } from '@/lib/partage';
import { CANAUX } from '@/lib/reseau/codes';

/**
 * Calendrier de publication (§ 13 des écrans, § 14 du cahier des charges).
 *
 * Transformer le partage « quand j'y pense » en activité organisée. Suguba
 * ne publie jamais à la place du revendeur : le jour J, la publication
 * remonte en tête avec un bouton qui prépare le partage en un geste.
 */

interface Publication {
  id: string;
  date: string;
  canal: string;
  produit: string | null;
  titre: string;
  note: string | null;
  statut: 'planned' | 'published' | 'skipped';
}
interface Echeance { id: string; titre: string; date: string }

function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function libelleJour(date: string): string {
  const auj = aujourdhui();
  if (date === auj) return 'Aujourd’hui';
  const demain = new Date(); demain.setDate(demain.getDate() + 1);
  const d = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;
  if (date === d) return 'Demain';
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function CalendrierPage() {
  const { toast } = useToast();
  const state = useSugubaStore();
  const code = useCodeRevendeur();

  const [publications, setPublications] = useState<Publication[]>([]);
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [disponible, setDisponible] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [date, setDate] = useState(aujourdhui());
  const [titre, setTitre] = useState('');
  const [produit, setProduit] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [note, setNote] = useState('');

  const produits = useMemo(
    () => state.products.filter((p) => p.status === 'approved' && p.resellerCommission > 0 && p.publicPrice > 0),
    [state.products],
  );

  const charger = React.useCallback(() => {
    return fetch('/api/reseller/calendrier')
      .then((r) => r.json())
      .then((data) => {
        setPublications(data.publications || []);
        setEcheances(data.missions || []);
        setDisponible(data.disponible !== false);
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const jours = useMemo(() => {
    const parJour = new Map<string, { publications: Publication[]; echeances: Echeance[] }>();
    for (const p of publications) {
      if (!parJour.has(p.date)) parJour.set(p.date, { publications: [], echeances: [] });
      parJour.get(p.date)!.publications.push(p);
    }
    for (const e of echeances) {
      if (!parJour.has(e.date)) parJour.set(e.date, { publications: [], echeances: [] });
      parJour.get(e.date)!.echeances.push(e);
    }
    return [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [publications, echeances]);

  const planifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/reseller/calendrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, titre, produit: produit || null, canal, note }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Planification impossible.', { ton: 'erreur' }); return; }
      toast('Publication planifiée.', { ton: 'succes' });
      setTitre(''); setNote(''); setProduit(''); setFormulaire(false);
      await charger();
    } catch {
      toast('Planification impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const changerStatut = async (id: string, statut: 'published' | 'skipped') => {
    await fetch('/api/reseller/calendrier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    }).catch(() => undefined);
    await charger();
  };

  const publier = async (p: Publication) => {
    const article = produits.find((x) => x.slug === p.produit);
    if (article) {
      const resultat = await partagerProduit(
        { nom: article.name, prix: article.publicPrice, slug: article.slug, images: article.images },
        code,
      );
      if (resultat === 'annule') return;
    }
    await changerStatut(p.id, 'published');
    toast('Publication marquée comme faite.', { ton: 'succes' });
  };

  return (
    <PageReseau
      titre="Mon calendrier"
      sousTitre="Planifiez vos publications, ne ratez aucune échéance."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
      action={<Button size="sm" onClick={() => setFormulaire((v) => !v)}><Plus className="w-4 h-4" />Planifier</Button>}
    >
      {formulaire && (
        <Card>
          <form onSubmit={planifier} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="date" requis>
                <Input id="date" type="date" min={aujourdhui()} value={date} onChange={(e) => setDate(e.target.value)} required />
              </Field>
              <Field label="Canal" htmlFor="canal">
                <Select id="canal" value={canal} onChange={(e) => setCanal(e.target.value)}>
                  {CANAUX.filter((c) => c.valeur !== 'qr' && c.valeur !== 'autre').map((c) => (
                    <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Quoi publier" htmlFor="titre" requis>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required placeholder="Statut du vendredi : la TV 43 pouces" />
            </Field>
            <Field label="Produit (facultatif)" htmlFor="produit" aide="Le jour J, le partage de ce produit sera prêt en un geste.">
              <Select id="produit" value={produit} onChange={(e) => setProduit(e.target.value)}>
                <option value="">Aucun produit précis</option>
                {produits.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Note" htmlFor="note">
              <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
            </Field>
            <Button type="submit" disabled={envoi} fullWidth>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Planifier
            </Button>
          </form>
        </Card>
      )}

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : !disponible ? (
        <EmptyState icone={CalendarDays} titre="Calendrier pas encore disponible" texte="La mise à jour du réseau n’est pas encore appliquée sur ce serveur." />
      ) : jours.length === 0 ? (
        <EmptyState
          icone={CalendarDays}
          titre="Rien de planifié"
          texte="Publier un peu chaque jour vend plus que tout publier d’un coup. Planifiez vos statuts de la semaine."
          action={<Button onClick={() => setFormulaire(true)}>Planifier une publication</Button>}
        />
      ) : (
        <div className="space-y-4">
          {jours.map(([jour, contenu]) => (
            <section key={jour} className="space-y-2">
              <h2 className={`text-xs font-black uppercase tracking-wide px-1 ${jour === aujourdhui() ? 'text-suguba-brand' : jour < aujourdhui() ? 'text-slate-400' : 'text-slate-600'}`}>
                {libelleJour(jour)}
              </h2>
              {contenu.echeances.map((e) => (
                <Card key={`m-${e.id}`} padding="p-3" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Target className="w-4 h-4" /></div>
                  <p className="text-sm text-slate-800 min-w-0 flex-1 truncate">Fin de mission : <strong>{e.titre}</strong></p>
                </Card>
              ))}
              {contenu.publications.map((p) => (
                <Card key={p.id} padding="p-3" className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${p.statut === 'planned' ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{p.titre}</p>
                      <p className="text-[11px] text-slate-500">{CANAUX.find((c) => c.valeur === p.canal)?.libelle || p.canal}{p.note ? ` · ${p.note}` : ''}</p>
                    </div>
                    {p.statut === 'published' && <StatusPill ton="succes"><Check className="w-3 h-3" />Fait</StatusPill>}
                    {p.statut === 'skipped' && <StatusPill ton="neutre">Ignoré</StatusPill>}
                  </div>
                  {p.statut === 'planned' && jour <= aujourdhui() && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => changerStatut(p.id, 'skipped')}><X className="w-3.5 h-3.5" />Ignorer</Button>
                      <Button size="sm" fullWidth onClick={() => publier(p)}><Share2 className="w-3.5 h-3.5" />Publier maintenant</Button>
                    </div>
                  )}
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
