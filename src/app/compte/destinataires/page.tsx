'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import OngletsCompte from '@/components/compte/OngletsCompte';

interface Destinataire { id: string; nom: string; telephone: string; ville: string; quartier: string | null; repere: string | null; relation: string | null }

/**
 * Mes destinataires (2026-09-26, compte client — C2) : les proches pour qui
 * je commande souvent. Proposés au moment de commander (« Pour qui
 * commandez-vous ? »).
 */
export default function DestinatairesPage() {
  const { toast } = useToast();
  const [liste, setListe] = useState<Destinataire[] | null>(null);
  const [etat, setEtat] = useState<'ok' | 'deconnecte' | 'erreur'>('ok');
  const [ajout, setAjout] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [f, setF] = useState({ nom: '', telephone: '', quartier: '', repere: '', relation: '' });

  const charger = useCallback(() => fetch('/api/compte/destinataires', { cache: 'no-store' })
    .then(async (r) => {
      if (r.status === 401) { setEtat('deconnecte'); return; }
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setListe(j.destinataires || []);
    }).catch(() => setEtat('erreur')), []);
  useEffect(() => { charger(); }, [charger]);

  const envoyer = async (corps: Record<string, unknown>, succes: string) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/compte/destinataires', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Enregistrement impossible.', { ton: 'erreur' }); return false; }
      toast(succes, { ton: 'succes' });
      await charger();
      return true;
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
      return false;
    } finally { setEnvoi(false); }
  };

  return (
    <PageReseau titre="Mes destinataires" sousTitre="Les proches pour qui vous commandez." retour={{ href: '/', libelle: 'Accueil' }}>
      <OngletsCompte actif="/compte/destinataires" />
      {etat === 'deconnecte' ? (
        <EmptyState icone={Users} titre="Connectez-vous pour enregistrer vos destinataires"
          action={<Button href="/login?next=%2Fcompte%2Fdestinataires">Me connecter</Button>} />
      ) : etat === 'erreur' ? <EmptyState icone={Users} titre="Destinataires indisponibles" texte="Réessayez dans un instant." />
        : !liste ? <Skeleton className="h-40" />
        : (
          <>
            {ajout ? (
              <Card className="space-y-3">
                <Field label="Nom et prénom" htmlFor="d-nom" requis>
                  <Input id="d-nom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Ex : Aminata Diarra" maxLength={80} />
                </Field>
                <Field label="Téléphone" htmlFor="d-tel" requis aide="Le livreur l’appelle avant de passer.">
                  <Input id="d-tel" type="tel" inputMode="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} placeholder="Ex : 70 12 34 56" />
                </Field>
                <Field label="Lien (facultatif)" htmlFor="d-rel">
                  <Input id="d-rel" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} placeholder="Ex : Maman, bureau…" maxLength={40} />
                </Field>
                <Field label="Quartier" htmlFor="d-quartier">
                  <NeighborhoodPicker value={f.quartier} onChange={(v) => setF({ ...f, quartier: v })} />
                </Field>
                <Field label="Repère (facultatif)" htmlFor="d-repere">
                  <Input id="d-repere" value={f.repere} onChange={(e) => setF({ ...f, repere: e.target.value })} placeholder="Ex : près de la pharmacie" maxLength={200} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setAjout(false)}>Retour</Button>
                  <Button disabled={envoi} onClick={async () => {
                    if (await envoyer({ action: 'ajouter', destinataire: f }, 'Destinataire enregistré.')) { setAjout(false); setF({ nom: '', telephone: '', quartier: '', repere: '', relation: '' }); }
                  }}>
                    {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Enregistrer
                  </Button>
                </div>
              </Card>
            ) : (
              <Button fullWidth onClick={() => setAjout(true)}><Plus className="w-4 h-4" />Ajouter un destinataire</Button>
            )}
            {liste.length === 0 && !ajout ? (
              <EmptyState icone={Users} titre="Aucun destinataire" texte="Enregistrez vos proches : vous les choisirez en un geste au moment de commander." />
            ) : liste.length > 0 && (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {liste.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3 py-3">
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-slate-900">{d.nom}{d.relation ? ` · ${d.relation}` : ''}</span>
                        <span className="block text-xs text-slate-500">{[d.telephone, d.quartier, d.repere].filter(Boolean).join(' · ')}</span>
                      </span>
                      <button type="button" aria-label={`Supprimer ${d.nom}`} disabled={envoi}
                        onClick={() => { if (window.confirm(`Supprimer ${d.nom} de vos destinataires ?`)) envoyer({ action: 'supprimer', id: d.id }, 'Destinataire supprimé.'); }}
                        className="h-10 w-10 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-slate-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
    </PageReseau>
  );
}
