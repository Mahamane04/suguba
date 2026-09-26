'use client';

import React, { useCallback, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

interface Paiement {
  id: string; montant: number; reference: string; note: string | null;
  recuLe: string; annuleLe: string | null; motifAnnulation: string | null;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Paiements reçus d'une campagne ou d'une sponsorisation (2026-09-26,
 * Protection Suguba lot 1). Chaque paiement s'AJOUTE à l'historique avec sa
 * référence ; une erreur s'annule avec un motif, rien ne s'efface. Le total
 * affiché est celui calculé par la base.
 */
export default function PaiementsRecus({ cible, cibleId, du, recu, titre, onMaj }: {
  cible: 'campagne' | 'sponsorisation'; cibleId: string; du: number; recu: number; titre: string; onMaj: () => void;
}) {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState<Paiement[] | null>(null);
  const [ajout, setAjout] = useState(false);
  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [annulation, setAnnulation] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const regle = recu >= du && du > 0;

  const charger = useCallback(() => fetch(`/api/admin/paiements-recus?cible=${cible}&id=${encodeURIComponent(cibleId)}`, { cache: 'no-store' })
    .then((r) => r.json()).then((j) => setListe(j.paiements || [])).catch(() => setListe([])), [cible, cibleId]);

  const envoyer = async (corps: Record<string, unknown>, succes: string) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/paiements-recus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Enregistrement impossible.', { ton: 'erreur' }); return false; }
      toast(succes, { ton: 'succes' });
      await charger(); onMaj();
      return true;
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
      return false;
    } finally { setEnvoi(false); }
  };

  return (
    <div className={`rounded-2xl px-3 py-2 text-xs space-y-2 ${regle ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
      <p className="font-bold">
        {titre} · {fcfa(du)} · {regle ? 'réglé' : recu > 0 ? `${fcfa(recu)} reçus, reste ${fcfa(du - recu)}` : 'à encaisser avant activation'}
      </p>
      {!ouvert ? (
        <Button size="sm" variant="ghost" onClick={() => { setOuvert(true); charger(); }}>Paiements reçus</Button>
      ) : (
        <div className="space-y-2">
          {!liste ? <p>Chargement…</p> : liste.length === 0 ? <p>Aucun paiement enregistré.</p> : (
            <ul className="space-y-1.5">
              {liste.map((p) => (
                <li key={p.id} className={`rounded-xl bg-white/70 px-2.5 py-2 ${p.annuleLe ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={p.annuleLe ? 'line-through' : 'font-semibold'}>{fcfa(p.montant)} · réf. {p.reference}</span>
                    <span className="text-[11px]">{date(p.recuLe)}</span>
                  </div>
                  {p.note && <p className="text-[11px]">{p.note}</p>}
                  {p.annuleLe && <p className="text-[11px]">Annulé le {date(p.annuleLe)} : {p.motifAnnulation}</p>}
                  {!p.annuleLe && (annulation === p.id ? (
                    <div className="mt-1.5 space-y-1.5">
                      <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif de l’annulation" aria-label="Motif de l’annulation" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setAnnulation(null)}>Retour</Button>
                        <Button size="sm" disabled={envoi || motif.trim().length < 3}
                          onClick={async () => { if (await envoyer({ action: 'annuler', id: p.id, motif }, 'Paiement annulé.')) { setAnnulation(null); setMotif(''); } }}>
                          {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}Annuler ce paiement
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setAnnulation(p.id); setMotif(''); }} className="mt-1 min-h-9 text-[11px] font-semibold underline">
                      Erreur de saisie ? Annuler ce paiement
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {ajout ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Montant reçu (F)" htmlFor={`pr-montant-${cibleId}`}>
                  <Input id={`pr-montant-${cibleId}`} type="number" inputMode="numeric" min={1} value={montant} onChange={(e) => setMontant(e.target.value)} />
                </Field>
                <Field label="Référence" htmlFor={`pr-ref-${cibleId}`} aide="Reçu, transaction Mobile Money…">
                  <Input id={`pr-ref-${cibleId}`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
                </Field>
              </div>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (facultatif)" aria-label="Note" />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAjout(false)}>Retour</Button>
                <Button size="sm" disabled={envoi || !(Number(montant) > 0) || reference.trim().length < 3}
                  onClick={async () => {
                    if (await envoyer({ action: 'ajouter', cible, cibleId, montant: Number(montant), reference, note }, 'Paiement ajouté.')) {
                      setAjout(false); setReference(''); setNote('');
                    }
                  }}>
                  {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => { setAjout(true); setMontant(String(Math.max(0, du - recu) || '')); }}>
              <Plus className="w-3.5 h-3.5" />Ajouter un paiement reçu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
