'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, Check, X, Pause, Eye, MousePointerClick } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { EMPLACEMENTS } from '@/lib/reseau/sponsoring';

/**
 * Administration de la sponsorisation (§ 47 des écrans) : packs (prix, quotas,
 * durée — tout administrable) et demandes des fournisseurs.
 */

interface Pack {
  id: string; nom: string; prix: number; partagesVises: number;
  maxRevendeurs: number; dureeJours: number; actif: boolean;
}
interface Sponsorisation {
  id: string; libelle: string | null; emplacement: string; budget: number;
  statut: string; impressions: number; clics: number; finitLe: string | null;
}

const TON: Record<string, 'succes' | 'attente' | 'danger' | 'neutre'> = {
  active: 'succes', pending: 'attente', rejected: 'danger', paused: 'neutre', ended: 'neutre',
};
const LIBELLE_STATUT: Record<string, string> = {
  active: 'En cours', pending: 'En attente', rejected: 'Refusée', paused: 'En pause', ended: 'Terminée',
};

function nomEmplacement(valeur: string): string {
  return EMPLACEMENTS.find((e) => e.valeur === valeur)?.libelle || valeur;
}

export default function SponsorisationsAdminPage() {
  const { toast } = useToast();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sponsorisations, setSponsorisations] = useState<Sponsorisation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [prix, setPrix] = useState<Record<string, string>>({});

  const charger = React.useCallback(() => {
    return fetch('/api/admin/sponsorisations')
      .then((r) => r.json())
      .then((data) => {
        setPacks(data.packs || []);
        setSponsorisations(data.sponsorisations || []);
        setPrix(Object.fromEntries((data.packs || []).map((p: Pack) => [p.id, String(p.prix)])));
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const envoyer = async (corps: Record<string, unknown>, succes: string) => {
    const reponse = await fetch('/api/admin/sponsorisations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const data = await reponse.json();
    if (!reponse.ok) { toast(data.error || 'Action impossible.', { ton: 'erreur' }); return; }
    toast(succes, { ton: 'succes' });
    await charger();
  };

  return (
    <PageReseau
      titre="Sponsorisation"
      sousTitre="Packs, tarifs et demandes des fournisseurs."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      large
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Packs de visibilité</p>
              <p className="text-xs text-slate-500 mt-0.5">Le prix et les quotas restent entièrement modifiables ici.</p>
            </div>
            {packs.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun pack. Appliquez la migration réseau pour installer les packs de départ.</p>
            ) : (
              <div className="space-y-3">
                {packs.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">{p.nom}</p>
                      <StatusPill ton={p.actif ? 'succes' : 'neutre'}>{p.actif ? 'Actif' : 'Désactivé'}</StatusPill>
                    </div>
                    <p className="text-xs text-slate-500">
                      {p.dureeJours} jours · {p.partagesVises} partages visés · {p.maxRevendeurs} revendeurs max
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Field label="Prix (FCFA)" htmlFor={`prix-${p.id}`}>
                          <Input
                            id={`prix-${p.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={500}
                            value={prix[p.id] ?? ''}
                            onChange={(e) => setPrix((v) => ({ ...v, [p.id]: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <Button size="md" onClick={() => envoyer({ packId: p.id, prix: Number(prix[p.id]) }, 'Tarif mis à jour.')}>
                        Enregistrer
                      </Button>
                      <Button size="md" variant="ghost" onClick={() => envoyer({ packId: p.id, actif: !p.actif }, p.actif ? 'Pack désactivé.' : 'Pack activé.')}>
                        {p.actif ? 'Désactiver' : 'Activer'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {sponsorisations.length === 0 ? (
            <EmptyState icone={Megaphone} titre="Aucune demande" texte="Les demandes de sponsorisation des fournisseurs apparaîtront ici." />
          ) : (
            <div className="space-y-3">
              {sponsorisations.map((s) => (
                <Card key={s.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{s.libelle || 'Sponsorisation'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {nomEmplacement(s.emplacement)} · {s.budget.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                    <StatusPill ton={TON[s.statut] || 'neutre'}>{LIBELLE_STATUT[s.statut] || s.statut}</StatusPill>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{s.impressions} vues</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{s.clics} clics</span>
                  </p>

                  <div className="flex gap-2">
                    {s.statut !== 'active' && (
                      <Button size="sm" fullWidth onClick={() => envoyer({ sponsorisationId: s.id, statut: 'active' }, 'Sponsorisation activée.')}>
                        <Check className="w-3.5 h-3.5" />Activer
                      </Button>
                    )}
                    {s.statut === 'active' && (
                      <Button size="sm" variant="ghost" fullWidth onClick={() => envoyer({ sponsorisationId: s.id, statut: 'paused' }, 'Sponsorisation en pause.')}>
                        <Pause className="w-3.5 h-3.5" />Pause
                      </Button>
                    )}
                    {s.statut === 'pending' && (
                      <Button size="sm" variant="ghost" fullWidth onClick={() => envoyer({ sponsorisationId: s.id, statut: 'rejected' }, 'Demande refusée.')}>
                        <X className="w-3.5 h-3.5" />Refuser
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </PageReseau>
  );
}
