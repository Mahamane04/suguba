'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Phone, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

interface DemandeDevis {
  id: string;
  numero: string;
  statut: 'demande' | 'proposee' | 'acceptee' | 'refusee_client' | 'refusee_fournisseur' | 'expiree';
  creeLe: string;
  produit: string;
  quantite: number;
  besoin: string;
  lieu: string;
  client: { nom: string; telephone: string | null; repere: string | null };
  viaRevendeur: boolean;
  proposition: { prixFournisseur: number; partRevendeur: number; totalClient: number; gainRevendeur: number; conditions: string | null; valableJusqu: string } | null;
  motifRefus: string | null;
  commande: string | null;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

type Filtre = 'a_repondre' | 'proposes' | 'termines';
const filtreDe = (d: DemandeDevis): Filtre => (d.statut === 'demande' ? 'a_repondre' : d.statut === 'proposee' ? 'proposes' : 'termines');
const PASTILLE: Record<DemandeDevis['statut'], { libelle: string; ton: 'succes' | 'attente' | 'info' | 'danger' | 'neutre' }> = {
  demande: { libelle: 'À répondre', ton: 'attente' },
  proposee: { libelle: 'Proposé · en attente du client', ton: 'info' },
  acceptee: { libelle: 'Accepté', ton: 'succes' },
  refusee_client: { libelle: 'Refusé par le client', ton: 'neutre' },
  refusee_fournisseur: { libelle: 'Vous avez refusé', ton: 'neutre' },
  expiree: { libelle: 'Expiré', ton: 'neutre' },
};

/**
 * Demandes de devis — espace fournisseur (2026-09-26, lot 1b). Le fournisseur
 * propose SON prix et la part du revendeur ; Suguba calcule le prix client,
 * que le client accepte ou refuse. Un devis accepté devient une commande
 * normale (Commandes à préparer).
 */
export default function DevisFournisseurPage() {
  const { toast } = useToast();
  const [devis, setDevis] = useState<DemandeDevis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>('a_repondre');
  const [ouvert, setOuvert] = useState<{ id: string; mode: 'proposer' | 'refuser' } | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await fetch('/api/supplier/devis', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lecture impossible.');
      setDevis(j.devis || []);
      setMigration(Boolean(j.migrationRequise));
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const groupes = useMemo(() => {
    const g: Record<Filtre, DemandeDevis[]> = { a_repondre: [], proposes: [], termines: [] };
    for (const d of devis) g[filtreDe(d)].push(d);
    return g;
  }, [devis]);
  const FILTRES: [Filtre, string][] = [
    ['a_repondre', `À répondre (${groupes.a_repondre.length})`],
    ['proposes', `Proposés (${groupes.proposes.length})`],
    ['termines', `Terminés (${groupes.termines.length})`],
  ];

  return (
    <PageReseau titre="Demandes de devis" sousTitre="Répondez avec votre prix : le client accepte ou refuse depuis son téléphone." retour={{ href: '/supplier', libelle: 'Tableau de bord' }}>
      {migration && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          Les devis seront disponibles après la mise à jour de la base par Suguba.
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTRES.map(([f, libelle]) => (
          <button key={f} type="button" onClick={() => setFiltre(f)} aria-pressed={filtre === f}
            className={`shrink-0 min-h-[40px] px-4 rounded-full text-xs font-semibold ${filtre === f ? 'bg-suguba-profond text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
            {libelle}
          </button>
        ))}
      </div>

      {chargement ? <Skeleton className="h-40" /> : erreur ? (
        <EmptyState icone={FileText} titre="Devis indisponibles" texte={erreur} />
      ) : groupes[filtre].length === 0 ? (
        <EmptyState icone={FileText} titre={filtre === 'a_repondre' ? 'Aucune demande en attente' : 'Rien ici'}
          texte={filtre === 'a_repondre' ? 'Pour recevoir des demandes, choisissez « Sur devis » dans une de vos offres.' : undefined} />
      ) : (
        <div className="space-y-3">
          {groupes[filtre].map((d) => (
            <Card key={d.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{d.produit}</p>
                  <p className="text-xs text-slate-500 font-mono">{d.numero} · {jour(d.creeLe)} · quantité {d.quantite}</p>
                </div>
                <StatusPill ton={PASTILLE[d.statut].ton}>{PASTILLE[d.statut].libelle}</StatusPill>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-line bg-slate-50 rounded-2xl p-3">{d.besoin}</p>
              <div className="text-xs text-slate-600 space-y-0.5">
                <p><strong className="text-slate-900">{d.client.nom}</strong> · {d.lieu}{d.client.repere ? ` · ${d.client.repere}` : ''}</p>
                {d.client.telephone && (
                  <a href={`tel:${d.client.telephone}`} className="inline-flex items-center gap-1 min-h-11 font-bold text-suguba-profond underline">
                    <Phone className="w-3.5 h-3.5" /> Appeler {d.client.telephone}
                  </a>
                )}
                {!d.client.telephone && d.statut === 'proposee' && (
                  <p>Le client répond à votre proposition depuis son reçu. Pour le joindre, passez par Suguba.</p>
                )}
                {d.viaRevendeur && <p className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Client apporté par un revendeur</p>}
              </div>

              {d.proposition && (
                <div className="text-xs text-slate-700 rounded-2xl border border-slate-200 p-3 space-y-0.5">
                  <p>Votre prix : <strong>{fcfa(d.proposition.prixFournisseur)}</strong> · part revendeur {fcfa(d.proposition.partRevendeur)}</p>
                  <p>Le client paie : <strong>{fcfa(d.proposition.totalClient)}</strong>{d.proposition.gainRevendeur ? ` · le revendeur gagne ${fcfa(d.proposition.gainRevendeur)}` : ''}</p>
                  <p>Valable jusqu’au {jour(d.proposition.valableJusqu)}</p>
                </div>
              )}
              {d.motifRefus && <p className="text-xs text-slate-600">Motif du refus : {d.motifRefus}</p>}
              {d.commande && <p className="text-xs font-bold text-emerald-800">Commande {d.commande} créée : suivez-la dans « Commandes à préparer ».</p>}

              {['demande', 'proposee'].includes(d.statut) && (ouvert?.id === d.id ? (
                ouvert.mode === 'proposer'
                  ? <FormProposition demande={d} onFini={(msg) => { setOuvert(null); if (msg) { toast(msg, { ton: 'succes' }); setFiltre('proposes'); charger(); } }} />
                  : <FormRefus demande={d} onFini={(ok) => { setOuvert(null); if (ok) { toast('Demande refusée. Le client est prévenu sur sa page.', { ton: 'info' }); charger(); } }} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setOuvert({ id: d.id, mode: 'proposer' })}>{d.statut === 'proposee' ? 'Modifier le prix' : 'Proposer un prix'}</Button>
                  <Button variant="ghost" onClick={() => setOuvert({ id: d.id, mode: 'refuser' })}>Refuser</Button>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}

function FormProposition({ demande, onFini }: { demande: DemandeDevis; onFini: (message: string | null) => void }) {
  const [prix, setPrix] = useState(demande.proposition ? String(demande.proposition.prixFournisseur) : '');
  const [part, setPart] = useState(demande.proposition ? String(demande.proposition.partRevendeur) : '0');
  const [conditions, setConditions] = useState(demande.proposition?.conditions || '');
  const [jours, setJours] = useState('7');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const envoyer = async () => {
    setErreur('');
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/devis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'proposer', quoteId: demande.id, prixTotal: Number(prix), partRevendeur: Number(part) || 0, conditions, validiteJours: Number(jours) }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErreur(j?.error || 'Envoi impossible.'); return; }
      onFini(`Devis envoyé : le client paiera ${fcfa(j.totalClient)}.`);
    } catch {
      setErreur('Connexion interrompue. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="rounded-2xl bg-suguba-sauge p-3 space-y-3">
      <Field label={`Votre prix pour ${demande.quantite > 1 ? `les ${demande.quantite}` : 'cette demande'} (FCFA)`} requis aide="Ce que vous touchez, tout compris (matériel, pose…).">
        <Input type="number" inputMode="numeric" min={500} step={500} value={prix} onChange={(e) => setPrix(e.target.value)} />
      </Field>
      <Field label="Part du revendeur (FCFA)" aide={demande.viaRevendeur ? 'Ce client vient d’un revendeur : sa part l’encourage à vous en apporter d’autres.' : 'Utilisée si un revendeur a apporté le client.'}>
        <Input type="number" inputMode="numeric" min={0} step={250} value={part} onChange={(e) => setPart(e.target.value)} />
      </Field>
      <Field label="Ce qui est compris" aide="Matériel, installation, garantie, délais. Aucun supplément ne pourra être ajouté ensuite.">
        <Textarea rows={3} maxLength={2000} value={conditions} onChange={(e) => setConditions(e.target.value)} />
      </Field>
      <Field label="Valable (jours)">
        <Input type="number" inputMode="numeric" min={1} max={60} value={jours} onChange={(e) => setJours(e.target.value)} />
      </Field>
      <p className="text-xs text-slate-600">Suguba ajoute sa part et la livraison (ou vos frais de remise) : le client voit le prix final avant d’accepter.</p>
      {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => onFini(null)} disabled={envoi}>Annuler</Button>
        <Button onClick={envoyer} disabled={envoi || !prix}>{envoi ? 'Envoi…' : 'Envoyer le devis'}</Button>
      </div>
    </div>
  );
}

function FormRefus({ demande, onFini }: { demande: DemandeDevis; onFini: (ok: boolean) => void }) {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const envoyer = async () => {
    setErreur('');
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/devis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refuser', quoteId: demande.id, motif }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErreur(j?.error || 'Action impossible.'); return; }
      onFini(true);
    } catch {
      setErreur('Connexion interrompue. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="rounded-2xl bg-slate-50 p-3 space-y-3">
      <Field label="Motif" requis aide="Vu par le client. Ex. : hors de ma zone, matériel indisponible.">
        <Input value={motif} maxLength={500} onChange={(e) => setMotif(e.target.value)} />
      </Field>
      {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => onFini(false)} disabled={envoi}>Annuler</Button>
        <Button variant="danger" onClick={envoyer} disabled={envoi || !motif.trim()}>{envoi ? 'Envoi…' : 'Refuser la demande'}</Button>
      </div>
    </div>
  );
}
