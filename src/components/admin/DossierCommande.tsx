'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneCall, MessageCircle, CheckCircle2, Truck, Loader2, HelpCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { Info } from '@/components/admin/Panneau';
import NotesInternes from '@/components/admin/NotesInternes';
import { usePermission } from '@/components/admin/contexte';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import type { Order } from '@/types';

/**
 * Une commande et ce qu'on peut y faire (lots U2/U4, 2026-09-27) : appeler
 * ou relancer le client, confirmer, attribuer ou changer de livreur, renvoyer
 * le code de livraison, notes internes. Sert au panneau de la page Commandes
 * ET au panneau de « À traiter » : une seule version des gestes.
 */

export interface Commande {
  id: string; numero: string; produit: string; quantite: number; total: number; livraison: number; statut: string;
  client: string; telephone: string; ville: string | null; quartier: string | null; revendeur: string | null; livreur: string | null;
  panier: string | null; creeLe: string; codeRamassage: string | null; recupereeLe: string | null;
  repere: string | null; paiement: string | null; livreurId: string | null; remise: string;
}
export interface Livreur { id: string; fullName: string; vehicleType: string | null }

type Ton = 'succes' | 'attente' | 'danger' | 'neutre' | 'info';
export const STATUTS_COMMANDE: [string, string, Ton][] = [
  // Noms réels des statuts en base (migration-order-status.sql).
  ['pending_call', 'À confirmer', 'attente'], ['confirmed', 'À attribuer', 'info'], ['dispatched', 'Livreur en route', 'info'],
  ['in_transit', 'En livraison', 'info'], ['delivered', 'Livrée', 'succes'], ['cancelled', 'Annulée', 'danger'], ['returned', 'Retournée', 'neutre'],
];
const LIBELLE_PAIEMENT: Record<string, string> = { cash_on_delivery: 'Espèces à la livraison', cash: 'Espèces à la livraison', orange_money: 'Orange Money', moov: 'Moov Money', card: 'Carte', carte: 'Carte' };
export const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;
export const quand = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const statutCommande = (s: string) => STATUTS_COMMANDE.find(([v]) => v === s);
export const libellePaiement = (p: string | null) => LIBELLE_PAIEMENT[p || ''] || p || '—';
/** Un livreur Suguba peut lui être attribué (ou remplacé). */
export const attribuable = (c: Commande) => ['confirmed', 'dispatched'].includes(c.statut) && c.remise === 'livreur';

/** Livreurs actifs, chargés une fois à la demande. */
export function useLivreursActifs(actif: boolean) {
  const [livreurs, setLivreurs] = useState<Livreur[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    if (!actif || livreurs !== null) return;
    fetch('/api/admin/drivers/active', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Liste des livreurs illisible.'); return j; })
      .then((j) => setLivreurs(Array.isArray(j.drivers) ? j.drivers : []))
      .catch((e) => { setLivreurs([]); setErreur((e as Error).message); });
  }, [actif, livreurs]);
  return { livreurs, erreur };
}

export function ChoixLivreur({ id, livreurs, erreur, valeur, onChange }: {
  id: string; livreurs: Livreur[] | null; erreur: string; valeur: string; onChange: (v: string) => void;
}) {
  if (livreurs === null) return <Skeleton className="h-11" />;
  if (!livreurs.length) return <p className="text-sm text-slate-600">{erreur || 'Aucun livreur actif : vérifiez-en un dans « Livreurs ».'}</p>;
  return <ChoicePicker id={id} ariaLabel="Livreur" valeur={valeur || livreurs[0].id} onChange={onChange}
    choix={livreurs.map((l) => ({ valeur: l.id, libelle: l.fullName, detail: l.vehicleType || undefined }))} />;
}

/** Envoie une action Commandes ; renvoie la réponse (ou null si la connexion a lâché). */
export async function actionCommande(corps: Record<string, unknown>): Promise<{ ok: boolean; message: string; echecs: { numero: string; error: string }[] } | null> {
  try {
    const r = await fetch('/api/admin/commandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => ({}));
    const echecs = (j.resultats || []).filter((x: { ok: boolean }) => !x.ok);
    return { ok: r.ok, message: r.ok ? j.message || 'Enregistré.' : j.error || echecs[0]?.error || 'Action impossible.', echecs };
  } catch {
    return null;
  }
}

/** Le strict nécessaire des messages de relance WhatsApp (voir whatsapp-helper). */
function versOrder(c: Commande): Order {
  return {
    customerPhone: c.telephone, customerName: c.client, orderNumber: c.numero, productName: c.produit,
    totalAmount: c.total, neighborhood: c.quartier || '', landmark: c.repere || '',
  } as Order;
}

/** Lit une commande par son numéro (dossier ouvert depuis « À traiter »). */
export function useCommandeParNumero(numero: string | null) {
  const [commande, setCommande] = useState<Commande | null>(null);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setCommande(null);
    if (!numero) return;
    setErreur('');
    fetch(`/api/admin/commandes?q=${encodeURIComponent(numero)}`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Commande illisible.'); return d; })
      .then((d) => {
        const c = (d.commandes || []).find((x: Commande) => x.numero.toLowerCase() === numero.toLowerCase());
        if (!c) throw new Error('Commande introuvable.');
        setCommande(c);
      })
      .catch((e) => setErreur((e as Error).message));
  }, [numero, version]);
  const relire = useCallback(() => setVersion((v) => v + 1), []);
  return { commande, erreur, relire };
}

export default function DossierCommande({ commande, onFait }: { commande: Commande; onFait: () => void }) {
  const { toast } = useToast();
  const peutModifier = usePermission('commande.modifier');
  const peutGererLivraisons = usePermission('livraison.gerer');
  const peutAttribuer = Boolean(peutModifier || peutGererLivraisons);
  const { livreurs, erreur: erreurLivreurs } = useLivreursActifs(peutAttribuer && attribuable(commande));
  const [livreur, setLivreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [sms, setSms] = useState<{ ok: boolean; message: string } | null>(null);

  const agir = async (corps: Record<string, unknown>) => {
    setEnCours(true);
    const r = await actionCommande(corps);
    setEnCours(false);
    if (!r) { toast('Action non confirmée. Vérifiez votre connexion.', { ton: 'erreur' }); return; }
    toast(r.message, { ton: r.ok ? 'succes' : 'erreur', duree: r.ok ? 6000 : 8000 });
    if (r.ok) onFait();
  };

  const envoyerCode = async () => {
    setSms(null);
    try {
      const r = await fetch('/api/sms/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: commande.numero }) });
      const d = await r.json().catch(() => null);
      const ok = r.ok && d?.success === true;
      setSms({ ok, message: ok ? 'Demande acceptée par le service SMS.' : d?.error || 'Envoi non confirmé. Réessayez.' });
    } catch { setSms({ ok: false, message: 'Connexion interrompue. Réessayez.' }); }
  };

  const c = commande;
  const livreurChoisi = livreur || livreurs?.[0]?.id || '';
  return (
    <div className="space-y-4">
      {c.statut === 'pending_call' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button href={`tel:${c.telephone}`} variant="secondary" size="sm"><PhoneCall className="w-4 h-4" />Appeler</Button>
            <Button href={whatsappHelper.getUnreachableFollowUpLink(versOrder(c))} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="sm"><MessageCircle className="w-4 h-4" />Relance</Button>
            <Button href={whatsappHelper.getBambaraFollowUpLink(versOrder(c))} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="sm"><MessageCircle className="w-4 h-4" />Bambara</Button>
          </div>
          {peutModifier && (
            <Button fullWidth disabled={enCours} onClick={() => agir({ action: 'confirmer', orderId: c.id })}>
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Client joint : confirmer la commande
            </Button>
          )}
        </div>
      )}

      {attribuable(c) && peutAttribuer && (
        <Card padding="p-4" className="space-y-2 !bg-slate-50">
          <label htmlFor={`livreur-${c.id}`} className="block text-sm font-semibold text-slate-800">{c.statut === 'confirmed' ? 'Attribuer un livreur' : 'Changer de livreur'}</label>
          <ChoixLivreur id={`livreur-${c.id}`} livreurs={livreurs} erreur={erreurLivreurs} valeur={livreurChoisi} onChange={setLivreur} />
          <Button fullWidth disabled={enCours || !livreurChoisi} onClick={() => agir({ action: 'attribuer', orderIds: [c.id], driverId: livreurChoisi })}>
            {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}{c.statut === 'confirmed' ? 'Attribuer ce livreur' : 'Changer de livreur'}
          </Button>
        </Card>
      )}
      {c.remise !== 'livreur' && ['confirmed', 'dispatched'].includes(c.statut) && (
        <Card padding="p-3" className="!bg-suguba-menthe !border-transparent text-sm text-suguba-profond">
          {c.remise === 'retrait' ? 'Retrait chez le fournisseur' : 'Remise par le fournisseur'} : aucun livreur Suguba à attribuer.
        </Card>
      )}

      <dl>
        <Info libelle="Client">{c.client}</Info>
        <Info libelle="Téléphone"><a href={`tel:${c.telephone}`} className="text-suguba-profond hover:underline tabular-nums">{c.telephone}</a></Info>
        <Info libelle="Produit">{c.quantite} × {c.produit}</Info>
        <Info libelle="Total">{fcfa(c.total)}{c.livraison ? ` (dont livraison ${fcfa(c.livraison)})` : ''}</Info>
        <Info libelle="Paiement">{libellePaiement(c.paiement)}</Info>
        <Info libelle="Quartier">{[c.quartier, c.ville].filter(Boolean).join(', ') || '—'}</Info>
        {c.repere && <Info libelle="Repère">{c.repere}</Info>}
        <Info libelle="Revendeur">{c.revendeur || 'Vente directe'}</Info>
        <Info libelle="Livreur">{c.livreur || '—'}</Info>
        {c.codeRamassage && <Info libelle="Code de ramassage"><span className="tracking-widest tabular-nums">{c.codeRamassage}</span></Info>}
        {c.recupereeLe && <Info libelle="Récupérée le">{quand(c.recupereeLe)}</Info>}
      </dl>

      {!['delivered', 'cancelled', 'returned'].includes(c.statut) && (
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={envoyerCode}>Renvoyer le code de livraison au client</Button>
          {sms && <p role={sms.ok ? 'status' : 'alert'} className={`text-sm ${sms.ok ? 'text-slate-700' : 'text-rose-800'}`}>{sms.message}</p>}
        </div>
      )}
      <Link href={`/admin/diagnostic?type=commande&ref=${encodeURIComponent(c.numero)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-suguba-profond hover:underline">
        <HelpCircle className="w-4 h-4" />Pourquoi c’est bloqué ?
      </Link>
      {(c.statut === 'pending_call' || c.statut === 'confirmed') && (
        <NotesInternes dossier={`${c.statut === 'pending_call' ? 'commande_a_confirmer' : 'livraison_a_attribuer'}:${c.id}`} />
      )}
    </div>
  );
}
