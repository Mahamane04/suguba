'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { usePermission } from '@/components/admin/contexte';
import { useFinance } from '@/lib/admin/useFinance';
const f=(v:number)=>`${Math.round(v).toLocaleString('fr-FR')} F`;
export default function RapportFinance({quotidien=false}:{quotidien?:boolean}){
  const peutExporter = usePermission('donnees.exporter');
  const aujourdHui=new Date().toISOString().slice(0,10);
  const [debut,setDebut]=useState(quotidien?aujourdHui:''); const [fin,setFin]=useState(quotidien?aujourdHui:'');
  const {data,error,refresh}=useFinance(debut,fin);
  const exporter=()=>{if(!data)return;const cellule=(x:unknown)=>`"${String(x??'Inconnu').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;
    const rows=[['Commande','Livrée le','Produit','Total','Livraison','Commission acquise commande','Marge commerciale avant autres coûts','Encaissement confirmé'],...data.lignes.map(o=>[o.numero,o.date,o.produit,o.total,o.livraison,o.commission,o.margeCommerciale,o.encaissee?'Oui':'Non'])];
    const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cellule).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`suguba-livraisons-${debut||'debut'}-${fin||aujourdHui}.csv`;a.click();URL.revokeObjectURL(url);};
  return <PageReseau titre={quotidien?'Rapport du soir':'Analyses financières'} sousTitre="Montants historiques et grand-livre serveur. Périodes en heure de Bamako (UTC)." large>
    <div className="flex flex-wrap gap-4 items-end"><label>Du<input aria-label="Début de période" type="date" value={debut} onChange={e=>setDebut(e.target.value)} className="block border rounded-xl p-3"/></label><label>Au<input aria-label="Fin de période" type="date" value={fin} onChange={e=>setFin(e.target.value)} className="block border rounded-xl p-3"/></label><Button variant="ghost" onClick={refresh}>Actualiser</Button>{peutExporter && <Button disabled={!data} onClick={exporter}>Exporter les livraisons (CSV)</Button>}<Link className="underline p-3" href={quotidien?'/admin/analytics':'/admin/reports/daily'}>{quotidien?'Toutes les analyses':'Rapport du jour'}</Link></div>
    {error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>:!data?<p role="status">Chargement des chiffres…</p>:<>
      <p className="text-sm text-slate-600">Actualisé le {new Date(data.misAJourLe).toLocaleString('fr-FR',{timeZone:'Africa/Bamako'})}. {debut||fin?'Période sélectionnée':'Toutes les dates'}.</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[
        ['Commandes créées',String(data.creees)],['Commandes livrées',String(data.livrees)],['Volume livré',f(data.volumeLivre)],['Encaissement confirmé sur ces livraisons',f(data.encaisseSurLivrees)],['Frais de livraison',f(data.livraison)],['Commissions de ces commandes',f(data.commissionsCommandes)],['Marge commerciale documentée',f(data.margeCommerciale)]
      ].map(([titre,valeur])=><div key={titre} className="rounded-2xl bg-white border p-5"><p className="text-sm text-slate-600">{titre}</p><p className="text-2xl font-bold mt-2">{valeur}</p></div>)}</div>
      <p className="rounded-xl bg-amber-50 p-4">Marge commerciale = articles − remise − coût fournisseur historique − commission revendeur. Elle ne représente pas le bénéfice net après livraison, paiement et charges. {data.margesInconnues>0?`${data.margesInconnues} marge(s) inconnue(s), exclue(s) du total faute de coût historique.`:''} {data.livraisonsSansDate>0?`${data.livraisonsSansDate} livraison(s) sans date : exclue(s) des périodes datées.`:''}</p>
      <h2 className="text-lg font-bold">Dossiers ouverts maintenant — toutes dates</h2><p>{data.enAttente} commande(s) à confirmer · {data.enLivraison} en livraison.</p>
      <h2 className="text-lg font-bold">Grand-livre des commissions — état actuel, toutes dates</h2><div className="grid sm:grid-cols-3 xl:grid-cols-6 gap-3">{Object.entries({pending:'En attente',locked:'Verrouillées',available:'Disponibles',reserved:'Réservées',paid:'Payées',reversed:'Annulées'}).map(([k,label])=><div className="border rounded-xl p-4 bg-white" key={k}><p>{label}</p><strong>{f(data.grandLivre[k])}</strong></div>)}</div>
      <Link href="/admin/retraits" className="underline">Examiner les retraits et commissions</Link>
    </>}
  </PageReseau>;
}
