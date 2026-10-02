'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Wallet, Lock } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import TableauAdmin, { type Colonne } from '@/components/admin/TableauAdmin';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import PaymentLogo, { moyenDepuisCode } from '@/components/ui/PaymentLogo';
import { useToast } from '@/components/ui/Toast';
import { useFinance } from '@/lib/admin/useFinance';
import { useCibleUrl, usePermission, usePosteAdmin } from '@/components/admin/contexte';
import { formatF, FORMAT_DATE } from '@/lib/montant';

/**
 * Retraits et commissions (lot U2, 2026-09-27) — sortis de l'ancienne vue
 * d'ensemble, où le menu pointait vers une ancre (#retraits) qui n'existait
 * pas. Mêmes actions qu'avant : virement Mobile Money via SasPay, remise en
 * espèces au guichet (par code), refus ; déblocage d'une commission avant la
 * fin de son délai de sécurité (motif demandé si c'est une avance de Suguba).
 */

interface RetraitAdmin {
  id: string; revendeur: string; montant: number; moyen: string;
  telephone: string; statut: string; creeLe: string;
  /** Retiré du solde, et frais payés par le revendeur (null pour les retraits d'avant le 2026-09-24). */
  montantDemande?: number | null; frais?: number | null;
  /** Lot C (2026-09-27) : un fournisseur retire aussi ce que Suguba lui doit. */
  beneficiaire?: 'revendeur' | 'fournisseur';
}

const LIBELLE_MOYEN: Record<string, string> = {
  orange_money: 'Orange Money', moov: 'Moov Money', mobi_cash: 'Mobi Cash',
  wave: 'Wave', cash: 'Espèces au guichet',
};
const fmt = formatF;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', FORMAT_DATE.jour);

export default function RetraitsAdminPage() {
  const {data:finance,error:erreurFinance,refresh:rafraichirFinance} = useFinance();
  const { confirmer, demander, toast } = useToast();
  const { rafraichir } = usePosteAdmin();
  const peutPayer = usePermission('finance.payer');
  const cible = useCibleUrl();
  const [retraits, setRetraits] = useState<RetraitAdmin[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [historique,setHistorique] = useState<RetraitAdmin[] | null>(null);
  const [pageHistorique,setPageHistorique] = useState(1);
  const [erreurHistorique,setErreurHistorique] = useState('');
  const [historiqueOuvert,setHistoriqueOuvert] = useState(false);
  const [revisionHistorique,setRevisionHistorique] = useState(0);
  useEffect(()=>{if(!historiqueOuvert)return;let actif=true;setHistorique(null);setErreurHistorique('');fetch(`/api/admin/payouts?historique=1&page=${pageHistorique}`).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);if(actif)setHistorique(j.retraits);}).catch(e=>{if(actif)setErreurHistorique(e.message);});return()=>{actif=false;};},[historiqueOuvert,pageHistorique,revisionHistorique]);
  const [code, setCode] = useState('');
  const [retourGuichet, setRetourGuichet] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const r = await fetch('/api/admin/payouts', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Retraits illisibles.');
      setRetraits(Array.isArray(j.retraits) ? j.retraits : []);
    } catch (e) {
      setErreur((e as Error).message || 'Connexion interrompue.');
      setRetraits((prev) => prev ?? []);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enAttente = (retraits || []).filter((r) => r.statut === 'pending');
  const enVirement = (retraits || []).filter((r) => r.statut === 'processing');

  const agir = async (r: RetraitAdmin, action: 'virer' | 'payer_especes' | 'rejeter') => {
    const questions = {
      virer: {
        titre: `Envoyer ${fmt(r.montant)} à ${r.revendeur} ?`,
        message: `Virement ${LIBELLE_MOYEN[r.moyen] || r.moyen} au ${r.telephone} via SasPay. Il sera marqué payé à la confirmation du réseau.`,
        confirmer: 'Envoyer le virement',
      },
      payer_especes: {
        titre: `Remettre ${fmt(r.montant)} en espèces à ${r.revendeur} ?`,
        message: `À confirmer une fois l’argent remis en main propre (code ${r.id}).`,
        confirmer: 'Argent remis',
      },
      rejeter: {
        titre: `Refuser le retrait de ${r.revendeur} ?`,
        message: `${fmt(r.montantDemande ?? r.montant)} retournent sur son solde disponible.`,
        confirmer: 'Refuser',
      },
    }[action];
    if (!(await confirmer({ ...questions, danger: action === 'rejeter' }))) return;

    setEnCours(r.id);
    try {
      const res = action === 'virer'
        ? await fetch('/api/payouts/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ withdrawalId: r.id }) })
        : await fetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        toast(action === 'virer' ? 'Virement transmis à SasPay.' : action === 'payer_especes' ? 'Retrait marqué payé.' : 'Retrait refusé, solde rendu.', { ton: 'succes' });
      } else if (j.validationRequise) {
        // Double validation (A3) : un collègue doit approuver avant l'envoi.
        toast(j.error || 'Double validation requise : un collègue doit approuver dans « Validations ».', { ton: 'info', duree: 8000 });
      } else {
        toast(j.error || 'Action impossible.', { ton: 'erreur', duree: 7000 });
      }
    } catch {
      toast('Erreur réseau.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
      charger();
      rafraichir();
      void rafraichirFinance();
      setRevisionHistorique(v=>v+1);
    }
  };

  const payerAuGuichet = (e: React.FormEvent) => {
    e.preventDefault();
    const saisi = code.trim().toUpperCase();
    if (!saisi) return;
    const r = enAttente.find((x) => x.id.toUpperCase() === saisi);
    if (!r) { setRetourGuichet(`Aucun retrait en attente avec le code ${saisi}.`); return; }
    if (r.moyen !== 'cash') { setRetourGuichet(`Le retrait ${saisi} est demandé en ${LIBELLE_MOYEN[r.moyen] || r.moyen} : il se paie par virement, pas au guichet.`); return; }
    setRetourGuichet('');
    setCode('');
    void agir(r, 'payer_especes');
  };

  const debloquer = async (commissionId: string) => {
    const envoyer = (motif?: string) => fetch('/api/admin/unlock-commission', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commissionId, motif }),
    });
    setEnCours(commissionId);
    try {
      let res = await envoyer();
      let j = await res.json().catch(() => ({}));
      // Espèces pas encore reversées : c'est une AVANCE de Suguba, motif obligatoire.
      if (res.status === 409 && j.motifRequis) {
        const motif = await demander({ titre: 'Avancer cette commission ?', message: j.error, libelle: 'Motif de l’avance', min: 5, confirmer: 'Débloquer' });
        if (!motif) return;
        res = await envoyer(motif);
        j = await res.json().catch(() => ({}));
      }
      toast(res.ok && j.success ? 'Commission débloquée : le revendeur peut la retirer.' : j.error || 'Déblocage impossible.', { ton: res.ok && j.success ? 'succes' : 'erreur', duree: 7000 });
    } catch {
      toast('Erreur réseau.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
      void rafraichirFinance();
    }
  };

  const colonnes: Colonne<RetraitAdmin>[] = [
    { cle: 'revendeur', titre: 'Bénéficiaire', fixe: true, tri: (r) => r.revendeur, rendu: (r) => (
      <span className="inline-flex flex-col">
        <span className="font-bold text-slate-900">{r.revendeur}</span>
        <span className="text-xs text-slate-500">{r.beneficiaire === 'fournisseur' ? 'Fournisseur' : 'Revendeur'}</span>
      </span>
    ) },
    { cle: 'montant', titre: 'À verser', droite: true, tri: (r) => r.montant, rendu: (r) => <span className="font-bold">{fmt(r.montant)}</span> },
    { cle: 'frais', titre: 'Demandé · frais', cachee: true, droite: true, rendu: (r) => (r.frais ?? 0) > 0 ? `${fmt(r.montantDemande ?? r.montant)} · ${fmt(r.frais as number)}` : '—' },
    { cle: 'moyen', titre: 'Moyen', tri: (r) => r.moyen, rendu: (r) => (
      <span className="inline-flex items-center gap-2"><PaymentLogo moyen={r.moyen === 'cash' ? 'especes' : moyenDepuisCode(r.moyen)} taille="sm" />{LIBELLE_MOYEN[r.moyen] || r.moyen}</span>
    ) },
    { cle: 'telephone', titre: 'Téléphone', rendu: (r) => (r.moyen !== 'cash' ? <span className="tabular-nums">{r.telephone}</span> : '—') },
    { cle: 'code', titre: 'Code', rendu: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { cle: 'date', titre: 'Demandé le', tri: (r) => r.creeLe, rendu: (r) => jour(r.creeLe) },
    ...(peutPayer ? [{ cle: 'actions', titre: 'Actions', fixe: true, droite: true, rendu: (r: RetraitAdmin) => (
      <span className="inline-flex gap-2 justify-end">
        {r.moyen === 'cash'
          ? <Button size="sm" disabled={enCours === r.id} onClick={() => agir(r, 'payer_especes')}>Argent remis</Button>
          : <Button size="sm" disabled={enCours === r.id || r.moyen === 'mobi_cash'} onClick={() => agir(r, 'virer')}>Envoyer le virement</Button>}
        <Button size="sm" variant="danger" disabled={enCours === r.id} onClick={() => agir(r, 'rejeter')}>Refuser</Button>
      </span>
    ) } as Colonne<RetraitAdmin>] : []),
  ];

  const verrouillees = finance?.verrouillees || [];
  type Commission = (typeof verrouillees)[number];

  return (
    <PageReseau titre="Retraits et commissions" large
      sousTitre="Payer les revendeurs et les fournisseurs : virement Orange Money, Moov Money ou Wave via SasPay, ou espèces au guichet."
      action={<Button variant="ghost" size="sm" onClick={() => { setRetraits(null); charger(); void rafraichirFinance(); setRevisionHistorique(v=>v+1); }} aria-label="Actualiser"><RefreshCw className="w-4 h-4" /></Button>}>

      {peutPayer === false && (
        <Card padding="p-4" className="!bg-slate-50 text-sm text-slate-700">Lecture seule : votre rôle ne permet pas de payer ni de refuser un retrait.</Card>
      )}

      {peutPayer && (
        <Card padding="p-4" className="space-y-2.5">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Building2 className="w-4 h-4 text-slate-600" />Guichet : retrait en espèces par code</p>
          <form onSubmit={payerAuGuichet} className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <label htmlFor="code-retrait" className="sr-only">Code du retrait</label>
            <input id="code-retrait" type="text" placeholder="Code du retrait (ex. : WTH-K7M3P9)" value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full sm:flex-1 h-12 sm:h-11 px-3.5 bg-white border border-slate-300 rounded-2xl text-base sm:text-sm font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-suguba-profond" />
            <Button type="submit">Payer en espèces</Button>
          </form>
          {retourGuichet && <p role="alert" className="text-sm font-semibold text-rose-700">{retourGuichet}</p>}
        </Card>
      )}

      <section className="space-y-2" aria-labelledby="titre-retraits">
        <h2 id="titre-retraits" className="text-sm font-bold text-slate-900">Retraits en attente{retraits ? ` (${enAttente.length})` : ''}</h2>
        {erreur && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
        {erreur ? null : retraits === null ? <Skeleton className="h-40" />
          : enAttente.length === 0 ? <EmptyState icone={Wallet} titre="Aucun retrait en attente" texte="Les nouvelles demandes des revendeurs et des fournisseurs apparaîtront ici." />
          : <TableauAdmin titre="Retraits en attente" memoire="retraits" lignes={enAttente} colonnes={colonnes} cleLigne={(r) => r.id} cible={cible} />}
        {enVirement.length > 0 && (
          <Card padding="p-4" className="text-sm text-slate-600 space-y-1">
            <p>{enVirement.length} virement{enVirement.length > 1 ? 's' : ''} en cours chez SasPay : marqué{enVirement.length > 1 ? 's' : ''} payé{enVirement.length > 1 ? 's' : ''} automatiquement à la confirmation du réseau.</p>
            {peutPayer && enVirement.map((r) => (
              <button key={r.id} type="button" disabled={enCours === r.id} onClick={() => agir(r, 'virer')} className="block min-h-[40px] text-suguba-profond font-semibold underline">
                Vérifier ou reprendre {r.id} ({fmt(r.montant)} pour {r.revendeur})
              </button>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3"><Button variant="ghost" onClick={()=>setHistoriqueOuvert(v=>!v)}>{historiqueOuvert?'Fermer l’historique':'Historique des retraits payés et refusés'}</Button>
        {historiqueOuvert && (erreurHistorique ? <p role="alert" className="text-rose-800">{erreurHistorique}</p> : historique === null ? <Skeleton className="h-24"/> : <><TableauAdmin titre="Historique des retraits" memoire="historique-retraits" lignes={historique} cleLigne={r=>r.id} colonnes={[...colonnes.filter(c=>c.cle!=='actions').map(c=>c.cle==='montant'?{...c,titre:'Montant'}:c),{cle:'statut',titre:'État',rendu:(r:RetraitAdmin)=>r.statut==='completed'?'Payé':'Refusé'}]}/><div className="flex gap-4 items-center"><Button variant="ghost" disabled={pageHistorique===1} onClick={()=>setPageHistorique(p=>p-1)}>Précédent</Button><span>Page {pageHistorique}</span><Button variant="ghost" disabled={historique.length<200} onClick={()=>setPageHistorique(p=>p+1)}>Suivant</Button></div></>)}
      </section>
      <section className="space-y-2" aria-labelledby="titre-commissions">
        <h2 id="titre-commissions" className="text-sm font-bold text-slate-900 flex items-center gap-2"><Lock className="w-4 h-4" />Commissions dans leur délai de sécurité ({finance ? verrouillees.length : '—'})</h2>
        <p className="text-xs text-slate-500">Débloquer avant terme rend la commission retirable tout de suite. Si les espèces de la commande ne sont pas encore reversées, c’est une avance de Suguba : un motif est demandé.</p>
        {erreurFinance ? <p role="alert" className="text-rose-800">{erreurFinance} <button onClick={rafraichirFinance}>Réessayer</button></p> : !finance ? <Skeleton className="h-24" /> : verrouillees.length === 0 ? (
          <Card padding="p-4" className="text-sm text-slate-500">Aucune commission verrouillée en ce moment.</Card>
        ) : (
          <TableauAdmin<Commission> titre="Commissions verrouillées" memoire="commissions-verrouillees" lignes={verrouillees} cleLigne={(c) => c.id}
            colonnes={[
              { cle: 'revendeur', titre: 'Revendeur', fixe: true, tri: (c) => c.resellerName, rendu: (c) => <span className="font-bold text-slate-900">{c.resellerName}</span> },
              { cle: 'montant', titre: 'Montant', droite: true, tri: (c) => c.amount, rendu: (c) => fmt(c.amount) },
              { cle: 'produit', titre: 'Produit', rendu: (c) => c.productName },
              { cle: 'delai', titre: 'Délai', rendu: (c) => c.safetyWindowDays == null ? 'Selon la commande' : `J+${c.safetyWindowDays}` },
              { cle: 'deblocage', titre: 'Déblocage prévu', tri: (c) => c.unlockAt || '', rendu: (c) => c.unlockAt ? new Date(c.unlockAt).toLocaleDateString('fr-FR', FORMAT_DATE.complet) : 'Non renseigné' },
              ...(peutPayer ? [{ cle: 'action', titre: 'Action', fixe: true, droite: true, rendu: (c: Commission) => (
                <Button size="sm" variant="ghost" disabled={enCours === c.id} onClick={() => debloquer(c.id)}>Débloquer avant terme</Button>
              ) }] : []),
            ]} />
        )}
      </section>
    </PageReseau>
  );
}
