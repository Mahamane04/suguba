'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageReseau from '@/components/reseau/PageReseau';
import ChoicePicker from '@/components/ui/ChoicePicker';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import TableauAdmin from '@/components/admin/TableauAdmin';
import { Skeleton } from '@/components/ui/Surface';
import { usePermission, usePosteAdmin, useCibleUrl } from '@/components/admin/contexte';
import { VERIFICATIONS } from '@/lib/reseau/badges';
interface Demande { id: string; profileId: string; type: string; document: string | null; nom: string | null; telephone: string | null; creeLe: string; examineLe: string | null; examinePar?: string | null; note: string | null; statut: string }
const type = (d: Demande) => VERIFICATIONS.find(v => v.valeur === d.type)?.libelle || d.type;
export default function VerificationsAdminPage() {
  const peut = usePermission('verification.decider'); const { rafraichir } = usePosteAdmin(); const cible = useCibleUrl();
  const [demandes,setDemandes] = useState<Demande[]>([]); const [statut,setStatut] = useState('pending'); const [page,setPage] = useState(1);
  const [q,setQ] = useState(''); const [erreur,setErreur] = useState(''); const [chargement,setChargement] = useState(true);
  const [dossier,setDossier] = useState<Demande|null>(null); const [note,setNote] = useState(''); const [envoi,setEnvoi] = useState(false); const [retour,setRetour] = useState('');
  const requete = useRef(0);
  const charger = useCallback(async () => { const numero=++requete.current;setChargement(true);setErreur('');try {
    const r=await fetch(`/api/admin/verifications?statut=${statut}&page=${page}`,{cache:'no-store'});const j=await r.json();if(numero!==requete.current)return;if(!r.ok)throw Error(j.error || 'Vérifications indisponibles.');setDemandes(j.demandes);
  }catch(e){if(numero===requete.current)setErreur((e as Error).message);}finally{if(numero===requete.current)setChargement(false);}},[statut,page]);
  useEffect(()=>{void charger();},[charger]);
  const ouvrir=(d:Demande)=>{setDossier(d);setNote(d.note || '');setRetour('');};
  useEffect(()=>{if(cible && demandes.length){const d=demandes.find(x=>x.id===cible);if(d)ouvrir(d);}},[cible,demandes]);
  const decider=async(decision:string)=>{if(!dossier)return;setEnvoi(true);setRetour('');try{
    const r=await fetch('/api/admin/verifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({demandeId:dossier.id,decision,note})});const j=await r.json();if(!r.ok)throw Error(j.error || 'Décision impossible.');setDossier(null);await charger();rafraichir();
  }catch(e){setRetour((e as Error).message);}finally{setEnvoi(false);}};
  const lignes=demandes.filter(d=>`${d.nom} ${d.telephone} ${type(d)}`.toLowerCase().includes(q.toLowerCase()));
  const sansPiece=dossier && ['identity','selfie','business'].includes(dossier.type) && !dossier.document;
  return <PageReseau titre="Identité et documents" sousTitre="Examinez la preuve, consignez votre constat, puis prenez la décision." large>
    <div className="flex flex-wrap gap-3 items-center"><ChoicePicker ariaLabel="État des vérifications" valeur={statut} onChange={v=>{setStatut(v);setPage(1);}} choix={[{valeur:'pending',libelle:'À examiner'},{valeur:'approved',libelle:'Validées'},{valeur:'rejected',libelle:'À compléter / refusées'}]}/><input type="search" aria-label="Rechercher dans cette page" placeholder="Nom, téléphone, type — cette page" className="border rounded-xl p-3 flex-1 min-w-0" value={q} onChange={e=>setQ(e.target.value)}/><Button variant="ghost" onClick={charger}>Actualiser</Button></div>
    {erreur ? <div role="alert" className="bg-rose-50 text-rose-800 p-5 rounded-xl">{erreur} <Button variant="ghost" onClick={charger}>Réessayer</Button></div> : chargement ? <Skeleton className="h-40"/> : <>
      {lignes.length===0 ? <p className="p-8 bg-white rounded-2xl">{q?'Aucun résultat dans cette page.':'Aucun dossier dans cet état.'}{q && <button className="underline ml-3" onClick={()=>setQ('')}>Effacer la recherche</button>}</p> : <TableauAdmin titre="Dossiers de vérification" memoire="verification-examen" lignes={lignes} cleLigne={d=>d.id} colonnes={[
        {cle:'nom',titre:'Compte',rendu:d=><strong>{d.nom || 'Compte sans nom'}</strong>},
        {cle:'type',titre:'Vérification',rendu:type},
        {cle:'telephone',titre:'Téléphone',rendu:d=>d.telephone?<a className="underline" href={`tel:${d.telephone}`}>{d.telephone}</a>:'Non renseigné'},
        {cle:'date',titre:'Déposée le',rendu:d=>new Date(d.creeLe).toLocaleString('fr-FR')},
        {cle:'action',titre:'Dossier',rendu:d=><Button onClick={()=>ouvrir(d)}>{statut==='pending'?'Examiner':'Voir la décision'}</Button>}
      ]}/>}
      <div className="flex justify-between items-center"><Button variant="ghost" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Précédent</Button><span>Page {page} · 50 dossiers maximum</span><Button variant="ghost" disabled={demandes.length<50} onClick={()=>setPage(p=>p+1)}>Suivant</Button></div>
    </>}
    <Sheet ouvert={!!dossier} onFermer={()=>{if(!envoi)setDossier(null);}} titre={dossier?`${type(dossier)} — ${dossier.nom || 'Compte'}`:'Examen'} large>
      {dossier && <div className="space-y-5">
        <p>{VERIFICATIONS.find(v=>v.valeur===dossier.type)?.aide}</p>
        {dossier.telephone && <a className="inline-flex min-h-11 items-center rounded-xl bg-suguba-menthe px-4 font-semibold" href={`tel:${dossier.telephone}`}>Appeler {dossier.telephone}</a>}
        {dossier.type==='phone' && <p>Appelez la personne pour confirmer que ce numéro lui appartient. Consignez le résultat de l’appel.</p>}
        {dossier.document ? <a className="block underline font-semibold" href={dossier.document} target="_blank" rel="noopener noreferrer">Ouvrir le justificatif privé (lien temporaire)</a> : sansPiece ? <p role="alert" className="text-rose-800">Justificatif manquant ou indisponible : validation impossible. Actualisez ou demandez un nouveau dépôt.</p> : null}
        {dossier.statut==='pending' && peut ? <><label className="block font-semibold">Constat ou motif de refus<textarea className="block w-full border rounded-xl p-3 mt-2 font-normal" rows={4} value={note} onChange={e=>setNote(e.target.value)} maxLength={300}/></label><p className="text-sm text-slate-600">Le motif de refus est communiqué à la personne. Minimum 5 caractères.</p><div className="flex flex-wrap gap-3"><Button disabled={envoi || note.trim().length<5 || !!sansPiece} onClick={()=>decider('approved')}>Valider {type(dossier).toLowerCase()}</Button><Button variant="danger" disabled={envoi || note.trim().length<5} onClick={()=>decider('rejected')}>Refuser avec ce motif</Button></div></> : <div><p>Décision : {dossier.statut==='approved'?'Validée':dossier.statut==='rejected'?'À compléter / refusée':'En attente'}</p><p>{dossier.note || 'Aucun constat enregistré.'}</p>{dossier.examinePar && <p>Décision de {dossier.examinePar}</p>}{dossier.examineLe && <p>{new Date(dossier.examineLe).toLocaleString('fr-FR')}</p>}</div>}
        {retour && <p role="alert" className="text-rose-800">{retour}</p>}
      </div>}
    </Sheet>
  </PageReseau>;
}
