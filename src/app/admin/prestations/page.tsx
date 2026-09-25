'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock, Hammer, Phone, RefreshCw } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

interface Etape {
  position: number;
  libelle: string;
  statut: 'a_faire' | 'declaree' | 'validee' | 'contestee';
  note: string | null;
  datePrevue: string | null;
  photos: number;
  declareeLe: string | null;
  valideePar: 'client' | 'admin' | null;
  motifContestation: string | null;
  noteAdmin: string | null;
}

interface Prestation {
  orderId: string;
  numero: string;
  produit: string;
  creeLe: string;
  client: { nom: string; telephone: string };
  fournisseur: string | null;
  etapes: Etape[];
  contestee: boolean;
  sansReponse: boolean;
  validees: number;
}

const jour = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Prestations à étapes — suivi admin (2026-09-26, lot 1c). Les parcours en
 * cours ; en tête, ceux où le client conteste une étape ou ne répond pas.
 * L'admin tranche après avoir appelé : il valide (à la place du client) ou
 * fait refaire l'étape, toujours avec une raison écrite, visible du
 * fournisseur.
 */
export default function PrestationsAdminPage() {
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [attenteHeures, setAttenteHeures] = useState(48);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await fetch('/api/admin/prestations', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lecture impossible.');
      setPrestations(j.prestations || []);
      setAttenteHeures(j.attenteHeures || 48);
      setMigration(Boolean(j.migrationRequise));
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const contestees = prestations.filter((p) => p.contestee).length;
  const sansReponse = prestations.filter((p) => p.sansReponse).length;

  return (
    <PageReseau
      titre="Prestations"
      sousTitre="Installations et services en plusieurs étapes, validées par le client."
      retour={{ href: '/admin', libelle: 'Console' }}
      action={
        <Button variant="ghost" size="sm" onClick={() => charger()} disabled={chargement}>
          <RefreshCw className={`w-4 h-4 ${chargement ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      }
    >
      {migration && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          Les prestations à étapes n’existent pas encore : exécutez le SQL des prestations dans Supabase.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="En cours" valeur={prestations.length} icone={Hammer} />
        <StatCard label="Contestées" valeur={contestees} icone={AlertTriangle} accent={contestees > 0} />
        <StatCard label={`Client muet depuis ${attenteHeures} h`} valeur={sansReponse} icone={Clock} />
      </div>

      {chargement && prestations.length === 0 ? <Skeleton className="h-40" /> : erreur ? (
        <EmptyState icone={Hammer} titre="Prestations indisponibles" texte={erreur} />
      ) : prestations.length === 0 ? (
        <EmptyState icone={Hammer} titre="Aucune prestation en cours"
          texte="Les offres avec des étapes apparaissent ici dès que le fournisseur organise la remise." />
      ) : (
        <div className="space-y-3">
          {prestations.map((p) => (
            <Card key={p.orderId} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{p.produit}</p>
                  <p className="text-xs text-slate-500 font-mono">#{p.numero} · {p.fournisseur || 'Fournisseur'}</p>
                </div>
                <StatusPill ton={p.contestee ? 'danger' : p.sansReponse ? 'attente' : 'info'}>
                  {p.contestee ? 'Contestée' : p.sansReponse ? 'Client sans réponse' : `${p.validees}/${p.etapes.length} validées`}
                </StatusPill>
              </div>
              <a href={`tel:${p.client.telephone}`} className="inline-flex items-center gap-1 min-h-11 text-xs font-bold text-suguba-profond underline">
                <Phone className="w-3.5 h-3.5" /> Client : {p.client.nom} · {p.client.telephone}
              </a>
              <ol className="space-y-2">
                {p.etapes.map((e) => <LigneEtape key={e.position} orderId={p.orderId} etape={e} onMaj={charger} />)}
              </ol>
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}

function LigneEtape({ orderId, etape, onMaj }: { orderId: string; etape: Etape; onMaj: () => void }) {
  const { toast } = useToast();
  const [action, setAction] = useState<'valider' | 'rouvrir' | null>(null);
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const Icone = etape.statut === 'validee' ? CheckCircle2 : etape.statut === 'declaree' ? Clock : etape.statut === 'contestee' ? AlertTriangle : Circle;
  const couleur = etape.statut === 'validee' ? 'text-emerald-600' : etape.statut === 'declaree' ? 'text-amber-600' : etape.statut === 'contestee' ? 'text-rose-600' : 'text-slate-300';

  const voirPhotos = async () => {
    const r = await fetch(`/api/admin/prestations?photos=${encodeURIComponent(orderId)}&position=${etape.position}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok) { toast(j?.error || 'Photos indisponibles.', { ton: 'erreur' }); return; }
    setPhotos(j.liens || []);
  };

  const trancher = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/prestations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, position: etape.position, action, note }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Action impossible.', { ton: 'erreur' }); return; }
      toast(action === 'valider' ? 'Étape validée. Le fournisseur est prévenu.' : 'Étape à refaire. Le fournisseur est prévenu.', { ton: 'succes' });
      setAction(null); setNote('');
      onMaj();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <li className="rounded-2xl border border-slate-200 p-3 space-y-2 text-xs">
      <div className="flex items-start gap-2">
        <Icone className={`w-4 h-4 shrink-0 ${couleur}`} aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p><strong className="text-slate-900">{etape.libelle}</strong>
            <span className="text-slate-600"> · {etape.statut === 'validee' ? `validée (${etape.valideePar === 'admin' ? 'Suguba' : 'client'})`
              : etape.statut === 'declaree' ? `déclarée${etape.declareeLe ? ` le ${jour(etape.declareeLe)}` : ''}, attend le client`
                : etape.statut === 'contestee' ? 'contestée par le client' : 'à faire'}</span>
          </p>
          {etape.datePrevue && <p className="text-slate-700">Rendez-vous : {jour(etape.datePrevue)}</p>}
          {etape.note && <p className="text-slate-700">Fournisseur : « {etape.note} »</p>}
          {etape.motifContestation && etape.statut === 'contestee' && <p className="text-rose-800">Client : « {etape.motifContestation} »</p>}
          {etape.noteAdmin && <p className="text-slate-600">Note Suguba : {etape.noteAdmin}</p>}
        </div>
      </div>
      {etape.photos > 0 && (photos ? (
        <div className="flex gap-2">
          {photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${i + 1} · ${etape.libelle}`} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <button type="button" onClick={voirPhotos} className="min-h-11 font-bold text-suguba-profond underline">Voir les {etape.photos} photo{etape.photos > 1 ? 's' : ''}</button>
      ))}
      {['declaree', 'contestee'].includes(etape.statut) && (action ? (
        <div className="space-y-2">
          <Field label={action === 'valider' ? 'Pourquoi valider à la place du client ?' : 'Ce que le fournisseur doit refaire'} htmlFor={`note-${orderId}-${etape.position}`} requis>
            <Textarea id={`note-${orderId}-${etape.position}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={action === 'valider' ? 'Ex : client appelé, travail conforme' : 'Ex : reprendre le câblage, le client sera présent jeudi'} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={envoi}>Annuler</Button>
            <Button onClick={trancher} disabled={envoi || note.trim().length < 5}>{envoi ? 'Envoi…' : action === 'valider' ? 'Valider l’étape' : 'Faire refaire'}</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAction('valider')}>Valider (après appel)</Button>
          <Button variant="ghost" size="sm" onClick={() => setAction('rouvrir')}>Faire refaire</Button>
        </div>
      ))}
    </li>
  );
}
