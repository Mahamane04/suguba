'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Check, X, Loader2, Save, Target, UserPlus } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Récompenses à verser (Finance).
 *
 * Validation HUMAINE obligatoire : une mission « 10 partages » se remplit en
 * dix clics, un parrainage se déclare avec n'importe quel numéro. Une fois
 * validée, la récompense entre dans le solde retirable du revendeur, et la
 * base garantit qu'elle ne peut être payée deux fois.
 */

interface Participation {
  id: string; mission: string; objectif: number; avancement: number;
  recompense: number; revendeur: string; code: string | null; termineLe: string | null;
}
interface Parrainage {
  id: string; type: 'customer' | 'reseller' | 'supplier'; telephone: string | null;
  parrain: string; code: string | null; creeLe: string; primePrevue: number;
}

const TYPE: Record<string, string> = { customer: 'Client', reseller: 'Revendeur', supplier: 'Fournisseur' };

export default function RecompensesAdminPage() {
  const { toast } = useToast();
  const [missions, setMissions] = useState<Participation[]>([]);
  const [parrainages, setParrainages] = useState<Parrainage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [primeClient, setPrimeClient] = useState('500');
  const [primeRevendeur, setPrimeRevendeur] = useState('2000');
  const [sauvegarde, setSauvegarde] = useState(false);

  const charger = React.useCallback(() => {
    return Promise.all([
      fetch('/api/admin/recompenses').then((r) => r.json()),
      fetch('/api/admin/reseau-reglages').then((r) => r.json()),
    ])
      .then(([rec, reg]) => {
        setMissions(rec.missions || []);
        setParrainages(rec.parrainages || []);
        if (reg.reglages) {
          setPrimeClient(String(reg.reglages.primeParrainageClient));
          setPrimeRevendeur(String(reg.reglages.primeParrainageRevendeur));
        }
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (type: 'mission' | 'parrainage', id: string, decision: string) => {
    setEnCours(id);
    try {
      const reponse = await fetch('/api/admin/recompenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, decision }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Action impossible.', { ton: 'erreur' }); return; }
      toast(data.verse > 0 ? `${Number(data.verse).toLocaleString('fr-FR')} F versés au revendeur.` : 'Décision enregistrée.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Action impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  const enregistrerPrimes = async () => {
    setSauvegarde(true);
    try {
      const reponse = await fetch('/api/admin/reseau-reglages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primeParrainageClient: primeClient, primeParrainageRevendeur: primeRevendeur }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      setPrimeClient(String(data.reglages.primeParrainageClient));
      setPrimeRevendeur(String(data.reglages.primeParrainageRevendeur));
      toast('Primes enregistrées.', { ton: 'succes' });
      await charger();
    } finally {
      setSauvegarde(false);
    }
  };

  return (
    <PageReseau
      titre="Récompenses"
      sousTitre="Missions atteintes et parrainages à valider avant versement."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      large
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : (
        <>
          <Card className="space-y-3">
            <p className="text-sm font-bold text-slate-900">Primes de parrainage</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Filleul client (FCFA)" htmlFor="prime-client">
                <Input id="prime-client" type="number" inputMode="numeric" min={0} step={50} value={primeClient} onChange={(e) => setPrimeClient(e.target.value)} />
              </Field>
              <Field label="Filleul revendeur (FCFA)" htmlFor="prime-revendeur">
                <Input id="prime-revendeur" type="number" inputMode="numeric" min={0} step={50} value={primeRevendeur} onChange={(e) => setPrimeRevendeur(e.target.value)} />
              </Field>
            </div>
            <Button variant="ghost" onClick={enregistrerPrimes} disabled={sauvegarde} fullWidth>
              {sauvegarde ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer les primes
            </Button>
          </Card>

          <section className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600 px-1 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Missions atteintes ({missions.length})</h2>
            {missions.length === 0 ? (
              <EmptyState icone={Gift} titre="Aucune mission à valider" />
            ) : missions.map((m) => (
              <Card key={m.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.mission}</p>
                    <p className="text-xs text-slate-500">{m.revendeur}{m.code ? ` · ${m.code}` : ''} · {m.avancement}/{m.objectif}</p>
                  </div>
                  <StatusPill ton="succes">{m.recompense.toLocaleString('fr-FR')} F</StatusPill>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" fullWidth disabled={enCours === m.id} onClick={() => decider('mission', m.id, 'rejected')}><X className="w-3.5 h-3.5" />Refuser</Button>
                  <Button size="sm" fullWidth disabled={enCours === m.id} onClick={() => decider('mission', m.id, 'validated')}>
                    {enCours === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Valider et verser
                  </Button>
                </div>
              </Card>
            ))}
          </section>

          <section className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600 px-1 flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" />Parrainages en attente ({parrainages.length})</h2>
            {parrainages.length === 0 ? (
              <EmptyState icone={UserPlus} titre="Aucun parrainage en attente" />
            ) : parrainages.map((p) => (
              <Card key={p.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.parrain}{p.code ? ` · ${p.code}` : ''}</p>
                    <p className="text-xs text-slate-500">
                      Filleul {TYPE[p.type] || p.type} · {p.telephone || 'par lien'} · {new Date(p.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <StatusPill ton="succes">{p.primePrevue.toLocaleString('fr-FR')} F</StatusPill>
                </div>
                <p className="text-xs text-slate-500">
                  Vérifiez que le filleul est réel : compte validé pour un revendeur, première commande livrée pour un client.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" fullWidth disabled={enCours === p.id} onClick={() => decider('parrainage', p.id, 'rejected')}><X className="w-3.5 h-3.5" />Refuser</Button>
                  <Button size="sm" fullWidth disabled={enCours === p.id} onClick={() => decider('parrainage', p.id, 'rewarded')}>
                    {enCours === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Valider et verser
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </PageReseau>
  );
}
