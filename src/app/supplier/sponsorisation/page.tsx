'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, Loader2, Eye, MousePointerClick } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Sponsorisation (§ 25 des écrans).
 *
 * Une demande n'est JAMAIS active immédiatement : elle part en attente et
 * Suguba l'active après encaissement. Sans cela, un simple clic suffirait à
 * s'afficher en une de l'accueil.
 */

interface Pack {
  id: string;
  nom: string;
  prix: number;
  partagesVises: number;
  maxRevendeurs: number;
  dureeJours: number;
  description: string | null;
}

interface Sponsorisation {
  id: string;
  sujetType: string;
  libelle: string | null;
  emplacement: string;
  budget: number;
  statut: string;
  finitLe: string | null;
  impressions: number;
  clics: number;
}

interface Emplacement { valeur: string; libelle: string; description: string }

const TON_STATUT: Record<string, 'succes' | 'attente' | 'danger' | 'neutre'> = {
  active: 'succes', pending: 'attente', rejected: 'danger', paused: 'neutre', ended: 'neutre',
};
const LIBELLE_STATUT: Record<string, string> = {
  active: 'En cours', pending: 'En attente', rejected: 'Refusée', paused: 'En pause', ended: 'Terminée',
};

export default function SponsorisationPage() {
  const { toast } = useToast();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sponsorisations, setSponsorisations] = useState<Sponsorisation[]>([]);
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const [packChoisi, setPackChoisi] = useState('');
  const [produitChoisi, setProduitChoisi] = useState('');
  const [emplacementChoisi, setEmplacementChoisi] = useState('');

  const charger = React.useCallback(() => {
    return fetch('/api/supplier/sponsorisation')
      .then((r) => r.json())
      .then((data) => {
        setPacks(data.packs || []);
        setSponsorisations(data.sponsorisations || []);
        setEmplacements(data.emplacements || []);
        setProduits(data.produits || []);
        if (data.packs?.[0]) setPackChoisi((v) => v || data.packs[0].id);
        if (data.emplacements?.[0]) setEmplacementChoisi((v) => v || data.emplacements[0].valeur);
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const demander = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produitChoisi) { toast('Choisissez le produit à sponsoriser.', { ton: 'erreur' }); return; }
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/supplier/sponsorisation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: packChoisi || null,
          sujetType: 'product',
          sujetRef: produitChoisi,
          emplacement: emplacementChoisi,
          libelle: produits.find((p) => p.id === produitChoisi)?.nom || null,
        }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Demande impossible.', { ton: 'erreur' }); return; }
      toast('Demande envoyée. Suguba vous contacte pour le règlement.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Demande impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PageReseau
      titre="Sponsorisation"
      sousTitre="Mettez vos produits en avant auprès du réseau."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-40" /></div>
      ) : packs.length === 0 ? (
        <EmptyState
          icone={Megaphone}
          titre="Sponsorisation pas encore disponible"
          texte="La mise à jour du réseau n’est pas encore appliquée sur ce serveur."
          action={<Button href="/supplier">Retour au tableau de bord</Button>}
        />
      ) : (
        <>
          <div className="space-y-3">
            {packs.map((p) => (
              <Card key={p.id} className={`space-y-2 ${packChoisi === p.id ? 'ring-2 ring-suguba-brand border-suguba-brand' : ''}`}>
                <button type="button" onClick={() => setPackChoisi(p.id)} className="w-full text-left space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{p.nom}</p>
                    <p className="text-lg font-bold text-suguba-brand-dark tabular-nums shrink-0">
                      {p.prix.toLocaleString('fr-FR')} F
                    </p>
                  </div>
                  {p.description && <p className="text-xs text-slate-600">{p.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill ton="neutre">{p.dureeJours} jours</StatusPill>
                    {p.partagesVises > 0 && <StatusPill ton="neutre">{p.partagesVises} partages visés</StatusPill>}
                    {p.maxRevendeurs > 0 && <StatusPill ton="neutre">{p.maxRevendeurs} revendeurs max</StatusPill>}
                  </div>
                </button>
              </Card>
            ))}
          </div>

          <Card className="space-y-4">
            <p className="text-sm font-bold text-slate-900">Demander une sponsorisation</p>
            <form onSubmit={demander} className="space-y-3">
              <Field label="Produit à mettre en avant" htmlFor="produit" requis>
                <ChoicePicker id="produit" valeur={produitChoisi} onChange={setProduitChoisi}
                  placeholder="Choisir un produit"
                  choix={produits.map((p) => ({ valeur: p.id, libelle: p.nom }))} />
              </Field>
              <Field label="Où l’afficher" htmlFor="emplacement"
                aide={emplacements.find((e) => e.valeur === emplacementChoisi)?.description}>
                <ChoicePicker id="emplacement" valeur={emplacementChoisi} onChange={setEmplacementChoisi}
                  choix={emplacements.map((e) => ({ valeur: e.valeur, libelle: e.libelle }))} />
              </Field>
              <Button type="submit" disabled={envoi} fullWidth>
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Envoyer la demande
              </Button>
              <p className="text-xs text-slate-500">
                Votre demande part en attente. Suguba vous contacte pour le règlement, puis l’active.
              </p>
            </form>
          </Card>

          {sponsorisations.length > 0 && (
            <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
              {sponsorisations.map((s) => (
                <div key={s.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.libelle || 'Sponsorisation'}</p>
                    <StatusPill ton={TON_STATUT[s.statut] || 'neutre'}>{LIBELLE_STATUT[s.statut] || s.statut}</StatusPill>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{s.impressions}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{s.clics}</span>
                    <span>{s.budget.toLocaleString('fr-FR')} F</span>
                  </p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </PageReseau>
  );
}
