'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Target, Loader2, Clock, Gift, CheckCircle2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { joursRestants, libelleType, progression, verbeType, type TypeMission } from '@/lib/reseau/missions';

/**
 * Missions du revendeur (§ 11 des écrans).
 *
 * Trois onglets, comme demandé : disponibles, en cours, terminées. La
 * progression affichée vient du serveur — jamais d'un compteur local, qui
 * mentirait dès le premier rechargement.
 */

interface Mission {
  id: string;
  titre: string;
  description: string | null;
  type: TypeMission;
  objectif: number;
  recompense: number;
  recompenseLibelle: string | null;
  finitLe: string | null;
  participants: number;
}

interface Participation {
  missionId: string;
  avancement: number;
  statut: 'joined' | 'completed' | 'validated' | 'rejected';
}

type Onglet = 'disponibles' | 'encours' | 'terminees';

const ONGLETS: { valeur: Onglet; libelle: string }[] = [
  { valeur: 'disponibles', libelle: 'Disponibles' },
  { valeur: 'encours', libelle: 'En cours' },
  { valeur: 'terminees', libelle: 'Terminées' },
];

export default function MissionsRevendeurPage() {
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<Onglet>('disponibles');
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = React.useCallback(() => {
    return fetch('/api/reseller/missions')
      .then((r) => r.json())
      .then((data) => {
        setMissions(data.missions || []);
        setParticipations(data.participations || []);
      })
      .catch(() => { /* liste vide : l'écran affiche son état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const parMission = useMemo(
    () => new Map(participations.map((p) => [p.missionId, p])),
    [participations],
  );

  const visibles = useMemo(() => {
    return missions.filter((m) => {
      const p = parMission.get(m.id);
      if (onglet === 'disponibles') return !p;
      if (onglet === 'encours') return p?.statut === 'joined' || p?.statut === 'completed';
      return p?.statut === 'validated' || p?.statut === 'rejected';
    });
  }, [missions, parMission, onglet]);

  const rejoindre = async (missionId: string) => {
    setEnCours(missionId);
    try {
      const reponse = await fetch('/api/reseller/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Participation impossible.', { ton: 'erreur' }); return; }
      toast('Vous participez à cette mission.', { ton: 'succes' });
      setOnglet('encours');
      await charger();
    } catch {
      toast('Participation impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  const maintenant = new Date();

  return (
    <PageReseau
      titre="Missions"
      sousTitre="Des objectifs simples, une récompense à la clé."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      <div className="flex gap-2" role="tablist">
        {ONGLETS.map((o) => (
          <button
            key={o.valeur}
            role="tab"
            aria-selected={onglet === o.valeur}
            onClick={() => setOnglet(o.valeur)}
            className={`flex-1 h-10 rounded-2xl text-xs font-bold transition-colors ${
              onglet === o.valeur ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : visibles.length === 0 ? (
        <EmptyState
          icone={Target}
          titre={onglet === 'disponibles' ? 'Aucune mission pour le moment' : 'Rien dans cet onglet'}
          texte={
            onglet === 'disponibles'
              ? 'Les missions arrivent régulièrement : partager un produit, faire une vente, parrainer. Revenez bientôt.'
              : 'Rejoignez une mission disponible pour la voir apparaître ici.'
          }
          action={onglet !== 'disponibles' ? <Button onClick={() => setOnglet('disponibles')} variant="ghost">Voir les missions disponibles</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visibles.map((m) => {
            const p = parMission.get(m.id);
            const pourcent = p ? progression(p.avancement, m.objectif) : 0;
            const jours = joursRestants(m.finitLe, maintenant);
            return (
              <Card key={m.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{m.titre}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {libelleType(m.type)} · objectif {m.objectif} {verbeType(m.type)}
                    </p>
                  </div>
                  {p?.statut === 'completed' && <StatusPill ton="attente">À valider</StatusPill>}
                  {p?.statut === 'validated' && <StatusPill ton="succes">Validée</StatusPill>}
                  {p?.statut === 'rejected' && <StatusPill ton="danger">Refusée</StatusPill>}
                </div>

                {m.description && <p className="text-xs text-slate-600">{m.description}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill ton="succes">
                    <Gift className="w-3 h-3" />
                    {m.recompense > 0 ? `${m.recompense.toLocaleString('fr-FR')} F` : m.recompenseLibelle || 'Récompense'}
                  </StatusPill>
                  {jours != null && (
                    <StatusPill ton={jours <= 2 ? 'danger' : 'neutre'}>
                      <Clock className="w-3 h-3" />
                      {jours === 0 ? 'Dernier jour' : `${jours} jour${jours > 1 ? 's' : ''}`}
                    </StatusPill>
                  )}
                  <StatusPill ton="neutre">{m.participants} participant{m.participants > 1 ? 's' : ''}</StatusPill>
                </div>

                {p ? (
                  <div className="space-y-1.5">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-suguba-brand transition-all" style={{ width: `${pourcent}%` }} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-600">
                      {p.avancement} / {m.objectif} {verbeType(m.type)} · {pourcent}%
                    </p>
                  </div>
                ) : (
                  <Button onClick={() => rejoindre(m.id)} disabled={enCours === m.id} fullWidth>
                    {enCours === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Je participe
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageReseau>
  );
}
