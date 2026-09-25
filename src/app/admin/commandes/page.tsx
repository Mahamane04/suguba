'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, ShoppingCart } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';

/**
 * Toutes les commandes (§ page 45). Lecture et recherche ; les changements de
 * statut restent sur la vue globale, qui applique les règles de livraison et
 * de commission.
 */

const STATUTS: [string, string, 'succes' | 'attente' | 'danger' | 'neutre' | 'info'][] = [
  // Noms réels des statuts en base (migration-order-status.sql) : les anciens
  // 'assigned_driver' et 'in_delivery' ne correspondaient plus à rien, les
  // deux filtres restaient toujours vides (corrigé le 2026-09-24).
  ['pending_call', 'À confirmer', 'attente'], ['confirmed', 'Confirmée', 'info'], ['dispatched', 'Livreur en route', 'info'],
  ['in_transit', 'Récupérée · en livraison', 'info'], ['delivered', 'Livrée', 'succes'], ['cancelled', 'Annulée', 'danger'], ['returned', 'Retournée', 'neutre'],
];
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;

export default function CommandesAdminPage() {
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const [commandes, setCommandes] = useState<any[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState('');
  const [pret, setPret] = useState(false);
  const [retry, setRetry] = useState(0);
  const [smsPending, setSmsPending] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<Record<string, {ok:boolean;message:string}>>({});
  const envoyerCode = async (numero:string) => {
    if(smsPending) return;
    setSmsPending(numero);
    try {
      const response=await fetch('/api/sms/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:numero})});
      const data=await response.json().catch(()=>null);
      setSmsResult(old=>({...old,[numero]:{ok:response.ok && data?.success===true,message:response.ok && data?.success===true?'Demande acceptée par le service SMS.':data?.error || 'Envoi non confirmé. Réessayez.'}}));
    } catch {setSmsResult(old=>({...old,[numero]:{ok:false,message:'Connexion interrompue. Réessayez.'}}));}
    finally {setSmsPending(null);}
  };

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setQ(params.get('q') || ''); setStatut(params.get('statut') || '');
      setPage(Math.max(1, Number(params.get('page')) || 1)); setPret(true);
    };
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    if (!pret) return;
    setChargement(true); setErreur('');
    const controller = new AbortController();
    const params = new URLSearchParams({ statut, q: q.trim(), page: String(page) });
    window.history.replaceState(window.history.state, '', `?${params}`);
    const t = setTimeout(() => {
      fetch(`/api/admin/commandes?${params}`, { signal: controller.signal })
        .then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error || 'Recherche indisponible.'); return data; })
        .then(d => { if (!controller.signal.aborted) { setCommandes(d.commandes || []); setCompteurs(d.compteurs || {}); setTotal(d.total || 0); } })
        .catch(e => { if (!controller.signal.aborted) setErreur(e.message || 'Connexion interrompue. Réessayez.'); })
        .finally(() => { if (!controller.signal.aborted) setChargement(false); });
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [statut, q, page, pret, retry]);

  // Articles d'un même panier regroupés : c'est une seule commande pour le client.
  const groupes = useMemo(() => {
    const g: { cle: string; lignes: any[] }[] = [];
    const index = new Map<string, number>();
    for (const c of commandes) {
      const cle = c.panier || c.id;
      if (!index.has(cle)) { index.set(cle, g.length); g.push({ cle, lignes: [] }); }
      g[index.get(cle)!].lignes.push(c);
    }
    return g;
  }, [commandes]);

  return (
    <PageReseau titre="Commandes" sousTitre="Toutes les commandes, avec recherche." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }} large
      action={<Link href="/admin" className="text-xs font-bold text-slate-600 underline min-h-[32px] inline-flex items-center">Gérer sur la vue globale</Link>}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => { setStatut(''); setPage(1); }} className={`px-3.5 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${!statut ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Toutes</button>
        {STATUTS.map(([v, l]) => (
          <button key={v} onClick={() => { setStatut(v); setPage(1); }} className={`px-3.5 h-10 rounded-2xl text-xs font-bold whitespace-nowrap ${statut === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {l}{compteurs[v] ? ` · ${compteurs[v]}` : ''}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Numéro, client, téléphone, produit, code revendeur" className="pl-10" aria-label="Rechercher une commande" />
      </div>

      {erreur ? <div role="alert" className="rounded-2xl bg-rose-50 text-rose-800 p-4 space-y-2"><p>{erreur}</p><Button variant="ghost" onClick={() => setRetry(v => v + 1)}>Réessayer</Button></div> : chargement ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        : groupes.length === 0 ? <EmptyState icone={ShoppingBag} titre="Aucune commande" />
        : (
          <div className="space-y-2.5">
            {groupes.map(({ cle, lignes }) => {
              const tete = lignes[0];
              const total = lignes.reduce((s, l) => s + l.total, 0);
              return (
                <Card key={cle} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 break-words">{tete.client} · {tete.telephone}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(tete.creeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {tete.ville}{tete.quartier ? `, ${tete.quartier}` : ''}
                        {tete.revendeur ? ` · via ${tete.revendeur}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{fcfa(total)}</span>
                  </div>
                  {lignes.length > 1 && <StatusPill ton="info"><ShoppingCart className="w-3 h-3" />Panier de {lignes.length} articles</StatusPill>}
                  <div className="divide-y divide-slate-100">
                    {lignes.map((l) => {
                      const s = STATUTS.find(([v]) => v === l.statut);
                      return (
                        <div key={l.id}>
                          <div className="py-1.5 flex flex-wrap items-start justify-between gap-2 text-xs">
                            <span className="min-w-0 break-words text-slate-700"><strong className="text-slate-900">{l.numero}</strong> · {l.quantite} × {l.produit}</span>
                            <StatusPill ton={s?.[2] || 'neutre'}>{s?.[1] || l.statut}</StatusPill>
                          </div>
                          {!['delivered','cancelled','returned'].includes(l.statut) && <Button variant="ghost" size="sm" disabled={Boolean(smsPending)} onClick={()=>void envoyerCode(l.numero)}>{smsPending===l.numero ? 'Transmission…' : 'Demander le SMS au destinataire'}</Button>}
                          {smsResult[l.numero] && <p role={smsResult[l.numero].ok?'status':'alert'} className={`text-sm py-2 ${smsResult[l.numero].ok?'text-slate-700':'text-rose-800'}`}>{smsResult[l.numero].message}</p>}
                          {(l.codeRamassage || l.recupereeLe) && (
                            <p className="pb-1.5 text-xs text-slate-500">
                              {l.recupereeLe
                                ? `Récupérée chez le fournisseur le ${new Date(l.recupereeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                : <>Code de ramassage : <strong className="text-slate-900 tabular-nums tracking-widest">{l.codeRamassage}</strong></>}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      {!erreur && !chargement && <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-600">{total} panier(s) ou commande(s) · Page {page} sur {Math.max(1, Math.ceil(total / 50))}</p>
        <div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Précédente</Button><Button variant="ghost" disabled={page * 50 >= total} onClick={() => setPage(v => v + 1)}>Suivante</Button></div>
      </div>}
    </PageReseau>
  );
}
