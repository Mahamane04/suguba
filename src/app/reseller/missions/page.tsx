'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Target, Loader2, Clock, Gift, CheckCircle2, Camera, Send } from 'lucide-react';
import { Field, Input } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { compresserImage } from '@/lib/compression-image';
import { useCodeRevendeur } from '@/lib/partage';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
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
  /** Canal imposé par une campagne fournisseur (lot 2b), sinon 'tous'. */
  canal?: string;
  supplierId?: string | null;
  productId?: string | null;
}

interface Participation {
  missionId: string;
  avancement: number;
  statut: 'joined' | 'completed' | 'validated' | 'rejected';
}

interface Preuve {
  id: string; missionId: string; canal: string;
  statut: 'pending' | 'validated' | 'rejected'; motifRejet: string | null; envoyeeLe: string;
}

// Mêmes valeurs que CANAUX_PREUVE (src/lib/reseau/preuves-missions.ts, côté serveur).
const CANAUX = [
  { valeur: 'whatsapp_statut', libelle: 'Statut WhatsApp' },
  { valeur: 'whatsapp_groupe', libelle: 'Groupe WhatsApp' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
  { valeur: 'autre', libelle: 'Autre' },
];
const AVEC_PREUVE: TypeMission[] = ['share', 'post'];

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
  const [preuves, setPreuves] = useState<Preuve[]>([]);

  const charger = React.useCallback(() => {
    fetch('/api/reseller/missions/preuves', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setPreuves(j?.preuves || [])).catch(() => {});
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
                    <p className="text-sm font-bold text-slate-900">{m.titre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                    <p className="text-xs font-bold text-slate-600">
                      {p.avancement} / {m.objectif} {verbeType(m.type)} · {pourcent}%
                    </p>
                    {m.type === 'click' && (
                      <p className="text-xs text-slate-500">Chaque personne qui ouvre votre lien compte une seule fois ; vos propres clics ne comptent pas.</p>
                    )}
                    {m.supplierId && m.productId && p.statut === 'joined' && <PartagerCampagne mission={m} />}
                    {AVEC_PREUVE.includes(m.type) && (
                      <PreuvesMission mission={m} participation={p} preuves={preuves.filter((x) => x.missionId === m.id)} onEnvoyee={charger} />
                    )}
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

/**
 * Preuve de publication (lot 2a, 2026-09-26) : créer un lien ne compte plus
 * comme un partage. Le revendeur envoie la capture de sa publication ;
 * l'équipe Suguba la vérifie, et seule une preuve validée compte.
 */
function PreuvesMission({ mission, participation, preuves, onEnvoyee }: {
  mission: Mission; participation: Participation; preuves: Preuve[]; onEnvoyee: () => void;
}) {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const canalImpose = mission.canal && mission.canal !== 'tous' ? mission.canal : null;
  const [canal, setCanal] = useState(canalImpose || 'whatsapp_statut');
  const [lien, setLien] = useState('');
  const [capture, setCapture] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const enAttente = preuves.filter((x) => x.statut === 'pending').length;
  const manque = Math.max(0, mission.objectif - participation.avancement);
  const peutEnvoyer = participation.statut === 'joined' && enAttente < manque;

  const envoyer = async () => {
    if (!capture) return;
    setEnvoi(true);
    try {
      const f = new FormData();
      f.set('missionId', mission.id);
      f.set('canal', canal);
      if (lien.trim()) f.set('lien', lien.trim());
      f.set('capture', capture);
      const r = await fetch('/api/reseller/missions/preuves', { method: 'POST', body: f });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Envoi impossible.', { ton: 'erreur' }); return; }
      toast('Preuve envoyée : Suguba la vérifie avant de la compter.', { ton: 'succes' });
      setOuvert(false); setCapture(null); setLien('');
      onEnvoyee();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      {preuves.length > 0 && (
        <ul className="space-y-1">
          {preuves.slice(0, 5).map((x) => (
            <li key={x.id} className="text-xs flex items-center justify-between gap-2">
              <span className="text-slate-600">{x.canal} · {new Date(x.envoyeeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              <StatusPill ton={x.statut === 'validated' ? 'succes' : x.statut === 'rejected' ? 'danger' : 'attente'}>
                {x.statut === 'validated' ? 'Validée' : x.statut === 'rejected' ? `Refusée${x.motifRejet ? ` : ${x.motifRejet}` : ''}` : 'En vérification'}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
      {peutEnvoyer && (ouvert ? (
        <div className="rounded-2xl border border-slate-200 p-3 space-y-2.5">
          <p className="text-xs text-slate-600">Publiez d’abord, puis envoyez une capture où l’on voit votre publication. Une même capture ne compte qu’une fois.</p>
          {canalImpose ? (
            <p className="text-xs font-semibold text-slate-800">Cette campagne demande une publication sur : {CANAUX.find((c) => c.valeur === canalImpose)?.libelle}.</p>
          ) : (
            <Field label="Où avez-vous publié ?" htmlFor={`canal-${mission.id}`}>
              <ChoicePicker id={`canal-${mission.id}`} valeur={canal} onChange={(v) => setCanal(v)} choix={CANAUX} />
            </Field>
          )}
          <Field label="Lien de la publication (facultatif)" htmlFor={`lien-${mission.id}`} aide="Pour Facebook, Instagram ou TikTok.">
            <Input id={`lien-${mission.id}`} type="url" inputMode="url" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://" />
          </Field>
          <label className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50">
            <Camera className="w-4 h-4" /> {capture ? 'Capture ajoutée ✓ (changer)' : 'Ajouter la capture d’écran'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCapture(await compresserImage(f)); }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOuvert(false)} disabled={envoi}>Annuler</Button>
            <Button onClick={envoyer} disabled={envoi || !capture}>{envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Envoyer</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" fullWidth onClick={() => setOuvert(true)}>
          <Camera className="w-4 h-4" /> J’ai publié : envoyer la preuve
        </Button>
      ))}
      {participation.statut === 'joined' && !peutEnvoyer && enAttente > 0 && (
        <p className="text-xs text-slate-500">Vos preuves sont en vérification.</p>
      )}
    </div>
  );
}

/**
 * Page de la campagne (lot 2b) à partager : elle porte le code du revendeur,
 * donc les ventes qui en viennent lui sont attribuées.
 */
function PartagerCampagne({ mission }: { mission: Mission }) {
  const code = useCodeRevendeur();
  if (!code) return null;
  const url = `${window.location.origin}/campagne/${encodeURIComponent(mission.id)}?ref=${encodeURIComponent(code)}`;
  const texte = `${mission.titre}\n👉 ${url}`;
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(texte)}`} target="_blank" rel="noopener noreferrer"
      className="h-11 w-full rounded-2xl bg-suguba-wa hover:bg-[#1fbf5b] text-suguba-profond text-xs font-bold inline-flex items-center justify-center gap-2">
      <WhatsAppIcon className="w-4 h-4" /> Partager la page de la campagne
    </a>
  );
}
