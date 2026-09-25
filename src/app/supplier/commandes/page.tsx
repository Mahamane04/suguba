'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PackageCheck, KeyRound, Truck, CheckCircle2, Clock, Package, Handshake, Phone, QrCode } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import ProductImage from '@/components/common/ProductImage';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import OtpValidationModal from '@/components/driver/OtpValidationModal';
import type { Order } from '@/types';

/**
 * Commandes à préparer — espace fournisseur (2026-09-24).
 *
 * Le fournisseur ne voyait aucune commande de ses produits. Ici : ce qu'il
 * doit préparer, qui vient le récupérer, et le CODE DE RAMASSAGE à donner au
 * livreur seulement quand celui-ci a le colis en main. Ce code, saisi par le
 * livreur, prouve que le colis a quitté le dépôt (voir /api/driver/verify-pickup).
 */

interface Commande {
  id: string;
  numero: string;
  produit: string;
  image: string | null;
  quantite: number;
  montantFournisseur: number;
  statut: string;
  creeLe: string;
  livreeLe: string | null;
  recupereeLe: string | null;
  quartierClient: string | null;
  ville: string | null;
  livreur: string | null;
  codeRamassage: string | null;
  // Remise par le fournisseur lui-même (2026-09-26)
  modeRemise?: 'livreur' | 'fournisseur' | 'retrait';
  remisePriseEnCharge?: boolean;
  client?: { nom: string; telephone: string; repere: string | null } | null;
  montantClient?: number | null;
  payeEnLigne?: boolean;
}

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const heure = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Filtre = 'a_preparer' | 'en_route' | 'terminees';

function etape(c: Commande): { filtre: Filtre; libelle: string; ton: 'succes' | 'attente' | 'info' | 'danger' } {
  if (c.statut === 'cancelled') return { filtre: 'terminees', libelle: 'Annulée', ton: 'danger' };
  if (c.statut === 'returned') return { filtre: 'terminees', libelle: 'Retournée', ton: 'danger' };
  if (c.statut === 'delivered') return { filtre: 'terminees', libelle: c.modeRemise && c.modeRemise !== 'livreur' ? 'Remise faite' : 'Livrée', ton: 'succes' };
  if (c.modeRemise && c.modeRemise !== 'livreur') {
    if (c.statut === 'in_transit') return { filtre: 'en_route', libelle: 'Remise à faire par vous', ton: 'info' };
    if (c.statut === 'confirmed') return { filtre: 'a_preparer', libelle: 'Confirmée · à organiser', ton: 'attente' };
  }
  if (c.recupereeLe || c.statut === 'in_transit') return { filtre: 'en_route', libelle: 'Récupérée · en livraison', ton: 'info' };
  if (c.statut === 'dispatched') return { filtre: 'a_preparer', libelle: 'Livreur en route vers vous', ton: 'attente' };
  if (c.statut === 'confirmed') return { filtre: 'a_preparer', libelle: 'Confirmée · à préparer', ton: 'attente' };
  return { filtre: 'a_preparer', libelle: 'Client à confirmer', ton: 'attente' };
}

export default function CommandesFournisseurPage() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [ramassageActif, setRamassageActif] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('a_preparer');
  const [aRemettre, setARemettre] = useState<Commande | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [recharge, setRecharge] = useState(0);
  const { toast } = useToast();

  // « Organiser la remise » : la commande vous est assignée à la place d'un livreur.
  const organiser = async (c: Commande) => {
    setEnCours(c.id);
    try {
      const r = await fetch('/api/supplier/remise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prendre', orderId: c.id }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) toast(j?.error || 'Action impossible. Réessayez.', { ton: 'erreur' });
      else { toast('Remise organisée : contactez le client pour le rendez-vous.', { ton: 'succes' }); setFiltre('en_route'); setRecharge((n) => n + 1); }
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  useEffect(() => {
    let annule = false;
    const charger = () => fetch('/api/supplier/commandes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (annule) return;
        if (d.error) setErreur(d.error);
        setCommandes(d.commandes || []);
        setRamassageActif(d.ramassageActif !== false);
      })
      .catch(() => { if (!annule) setErreur('Connexion impossible. Réessayez.'); })
      .finally(() => { if (!annule) setChargement(false); });
    charger();
    // Le livreur arrive : on relit toutes les minutes pour voir le ramassage passer.
    const minuterie = setInterval(charger, 60_000);
    return () => { annule = true; clearInterval(minuterie); };
  }, [recharge]);

  const parFiltre = useMemo(() => {
    const groupes: Record<Filtre, Commande[]> = { a_preparer: [], en_route: [], terminees: [] };
    for (const c of commandes) groupes[etape(c).filtre].push(c);
    return groupes;
  }, [commandes]);

  const FILTRES: [Filtre, string][] = [
    ['a_preparer', `À préparer (${parFiltre.a_preparer.length})`],
    ['en_route', `En livraison (${parFiltre.en_route.length})`],
    ['terminees', `Terminées (${parFiltre.terminees.length})`],
  ];
  const visibles = parFiltre[filtre];

  return (
    <PageReseau titre="Commandes" sousTitre="Ce que vous devez préparer et remettre au livreur." retour={{ href: '/supplier', libelle: 'Tableau de bord' }}>
      <Card className="flex gap-3 items-start bg-suguba-sauge border-transparent">
        <KeyRound className="w-5 h-5 text-suguba-profond shrink-0 mt-0.5" />
        <p className="text-xs text-slate-700">
          Quand le livreur a le colis en main, <strong>donnez-lui le code de ramassage</strong> de la commande. Il le saisit
          dans son application : c’est la preuve que vous avez bien remis le colis. Ne le communiquez à personne d’autre.
        </p>
      </Card>
      {!ramassageActif && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          Les codes de ramassage apparaîtront après la mise à jour de la base par Suguba.
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
        <EmptyState icone={Package} titre="Commandes indisponibles" texte={erreur} />
      ) : visibles.length === 0 ? (
        <EmptyState icone={PackageCheck} titre={filtre === 'a_preparer' ? 'Rien à préparer pour le moment' : 'Aucune commande ici'}
          texte={filtre === 'a_preparer' ? 'Les nouvelles commandes de vos produits apparaîtront ici dès qu’un client aura commandé.' : undefined} />
      ) : (
        <div className="space-y-3">
          {visibles.map((c) => {
            const e = etape(c);
            return (
              <Card key={c.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={c.image || ''} alt={c.produit} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.produit}</p>
                    <p className="text-xs text-slate-500">#{c.numero} · {heure(c.creeLe)}</p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      Quantité <strong>{c.quantite}</strong> · vous recevez <strong>{enF(c.montantFournisseur)}</strong>
                    </p>
                  </div>
                  <StatusPill ton={e.ton}>{e.libelle}</StatusPill>
                </div>

                {c.codeRamassage && (
                  <div className="rounded-2xl bg-suguba-profond text-white p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white/70">Code de ramassage</p>
                      <p className="text-xs text-white/80">{c.livreur ? `À donner à ${c.livreur}` : 'À donner au livreur Suguba'}</p>
                    </div>
                    <p className="text-3xl font-semibold tracking-[0.3em] tabular-nums" aria-label={`Code ${c.codeRamassage.split('').join(' ')}`}>{c.codeRamassage}</p>
                  </div>
                )}

                {c.modeRemise && c.modeRemise !== 'livreur' && ['confirmed', 'in_transit'].includes(c.statut) && (
                  <div className="rounded-2xl bg-suguba-sauge p-3 space-y-2.5">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Handshake className="w-4 h-4 text-suguba-profond" />
                      {c.modeRemise === 'retrait' ? 'Le client vient chez vous' : 'Vous remettez vous-même'} — aucun livreur Suguba
                    </p>
                    {c.client && (
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <p><strong>{c.client.nom}</strong> · {c.quartierClient || c.ville}{c.client.repere ? ` · ${c.client.repere}` : ''}</p>
                        <a href={`tel:${c.client.telephone}`} className="inline-flex items-center gap-1 min-h-11 font-bold text-suguba-profond underline">
                          <Phone className="w-3.5 h-3.5" /> Appeler {c.client.telephone}
                        </a>
                      </div>
                    )}
                    <p className="text-xs text-slate-700">
                      {c.payeEnLigne
                        ? 'Déjà payé en ligne : rien à encaisser.'
                        : <>À encaisser au client : <strong>{enF(c.montantClient || 0)}</strong>, à remettre ensuite à la caisse Suguba.</>}
                    </p>
                    {c.statut === 'confirmed' ? (
                      <Button fullWidth onClick={() => organiser(c)} disabled={enCours === c.id}>
                        {enCours === c.id ? 'Un instant…' : 'Organiser la remise'}
                      </Button>
                    ) : c.remisePriseEnCharge ? (
                      <Button fullWidth onClick={() => setARemettre(c)}>
                        <QrCode className="w-4 h-4" /> Remettre au client (scanner son reçu)
                      </Button>
                    ) : null}
                  </div>
                )}

                <ul className="text-xs text-slate-600 space-y-1">
                  {(!c.modeRemise || c.modeRemise === 'livreur') && (
                    <li className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400" />Livraison vers {c.quartierClient || c.ville || 'le client'}</li>
                  )}
                  {c.livreur && <li className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-slate-400" />Livreur : {c.livreur}</li>}
                  {c.recupereeLe && <li className="flex items-center gap-2"><PackageCheck className="w-3.5 h-3.5 text-suguba-profond" />Récupérée le {heure(c.recupereeLe)}</li>}
                  {c.livreeLe && <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-suguba-profond" />Livrée le {heure(c.livreeLe)}</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <OtpValidationModal
        espace="fournisseur"
        isOpen={Boolean(aRemettre)}
        onClose={() => { setARemettre(null); setRecharge((n) => n + 1); }}
        order={aRemettre ? ({
          id: aRemettre.id,
          orderNumber: aRemettre.numero,
          totalAmount: aRemettre.montantClient || 0,
          paymentCollected: Boolean(aRemettre.payeEnLigne),
          customerName: aRemettre.client?.nom || 'le client',
          customerPhone: aRemettre.client?.telephone || '',
        } as unknown as Order) : null}
      />
    </PageReseau>
  );
}
