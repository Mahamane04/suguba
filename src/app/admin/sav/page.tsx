'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useCallback, useEffect, useState } from 'react';
import CreateSavTicketModal from '@/components/admin/CreateSavTicketModal';
import ChoicePicker from '@/components/ui/ChoicePicker';
import Sheet from '@/components/ui/Sheet';
import ScannerQr from '@/components/driver/ScannerQr';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, StatCard, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import TableauAdmin, { type Colonne } from '@/components/admin/TableauAdmin';
import Panneau, { Info } from '@/components/admin/Panneau';
import { useCibleUrl, usePermission, usePosteAdmin } from '@/components/admin/contexte';
import { lireQrRemise } from '@/lib/qr-remise';
import { useSugubaStore } from '@/lib/store';
import { SavTicket } from '@/types';
import { LifeBuoy, Truck, Phone, MessageCircle, Plus, CheckCircle2, Bike, QrCode, Image as ImageIcon } from 'lucide-react';
import { FORMAT_DATE } from '@/lib/montant';

/**
 * Service après-vente (refait en U4, 2026-09-27 : tableau, panneau latéral).
 *
 * Les tickets viennent de /api/admin/sav, plus du store local : une
 * réclamation saisie ici était auparavant invisible à tout autre admin et
 * perdue au vidage du cache. Voir supabase/migration-sav.sql.
 */

type Filtre = 'open' | 'courier_dispatched' | 'resolved' | 'tous';
const STATUT_SAV: Record<string, [string, 'danger' | 'attente' | 'succes' | 'neutre']> = {
  open: ['Coursier à envoyer', 'danger'], courier_dispatched: ['Coursier en route', 'attente'],
  swapped: ['Échangé', 'succes'], resolved: ['Résolu', 'succes'], rejected: ['Refusé', 'neutre'],
};
const RESOLUTION: Record<string, string> = { swap_new: 'Échange contre un neuf (72 h)', repair: 'Réparation', refund: 'Remboursement' };
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', FORMAT_DATE.jour);
const pastille = (t: SavTicket) => { if (t.status === 'open' && t.issueDescription?.startsWith('[Incident de course')) return <StatusPill ton="attente">Incident à étudier</StatusPill>; const [l, ton] = STATUT_SAV[t.status] || [t.status, 'neutre']; return <StatusPill ton={ton}>{l}</StatusPill>; };

export default function AdminSavPage() {
  const state = useSugubaStore();
  const { toast } = useToast();
  const { rafraichir } = usePosteAdmin();
  const peutModifier = usePermission('commande.modifier');
  const cible = useCibleUrl();
  const [creation, setCreation] = useState(false);
  const [tickets, setTickets] = useState<SavTicket[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [livreurs, setLivreurs] = useState<Array<{ id: string; fullName: string }>>([]);
  const [livreurChoisi, setLivreurChoisi] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('open');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [decisionIncident, setDecisionIncident] = useState('');

  const deliveredOrders = state.orders.filter((o) => o.status === 'delivered');

  const chargerTickets = useCallback(() => {
    fetch('/api/admin/sav', { cache: 'no-store' })
      .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Réclamations illisibles.'); return j; })
      .then((json) => { setTickets(json.tickets || []); setErreur(''); })
      .catch((e) => { setErreur((e as Error).message); setTickets((t) => t ?? []); });
  }, []);

  useEffect(() => {
    chargerTickets();
    fetch('/api/admin/drivers/active')
      .then((res) => (res.ok ? res.json() : { drivers: [] }))
      .then((json) => setLivreurs(json.drivers || []))
      .catch(() => {});
  }, [chargerTickets]);

  // Lien direct (« À traiter ») : le bon onglet, le dossier ouvert.
  useEffect(() => {
    const t = cible && tickets?.find((x) => x.id === cible);
    if (!t) return;
    setFiltre(t.status === 'open' || t.status === 'courier_dispatched' || t.status === 'resolved' ? t.status : 'tous');
    setOuvert(t.id);
  }, [cible, tickets]);

  // Scanner un reçu client (2026-09-25) : retrouve la commande à partir du QR.
  // Seul le numéro de commande est lu ; le code de remise contenu dans le QR
  // n'est jamais affiché ni utilisé ici.
  const [scanOuvert, setScanOuvert] = useState(false);
  const [commandeScannee, setCommandeScannee] = useState<string | null>(null);
  const [erreurScan, setErreurScan] = useState('');
  const [filtreCommande, setFiltreCommande] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[] | 'chargement'>>({});

  const apresScan = (texte: string) => {
    const numero = lireQrRemise(texte)?.orderNumber || /\bSG-[A-Z0-9]{4,}\b/i.exec(texte)?.[0].toUpperCase() || null;
    if (!numero) { setErreurScan('Ce QR n’est pas un reçu Suguba.'); return; }
    setErreurScan('');
    setCommandeScannee(numero);
  };
  const fermerScan = () => { setScanOuvert(false); setCommandeScannee(null); setErreurScan(''); };

  const chargerPhotos = async (ticketId: string) => {
    setPhotos((p) => ({ ...p, [ticketId]: 'chargement' }));
    try {
      const r = await fetch(`/api/admin/sav/photos?ticketId=${encodeURIComponent(ticketId)}`);
      const j = await r.json();
      setPhotos((p) => ({ ...p, [ticketId]: Array.isArray(j.photos) ? j.photos : [] }));
    } catch {
      setPhotos((p) => ({ ...p, [ticketId]: [] }));
    }
  };

  // Les anciennes actions ignoraient la réponse du serveur : un échec passait inaperçu.
  const agir = async (corps: Record<string, unknown>, succes: string) => {
    setEnCours(true);
    try {
      const r = await fetch('/api/admin/sav', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Action impossible.', { ton: 'erreur', duree: 7000 }); return; }
      toast(succes, { ton: 'succes' });
      setOuvert(null);
      chargerTickets();
      rafraichir();
    } catch {
      toast('Action non confirmée. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(false);
    }
  };

  const tous = tickets || [];
  const parCommande = filtreCommande ? tous.filter((t) => t.orderNumber === filtreCommande) : tous;
  const liste = filtreCommande || filtre === 'tous' ? parCommande : parCommande.filter((t) => t.status === filtre);
  const nombre = (s: SavTicket['status']) => tous.filter((t) => t.status === s).length;
  const FILTRES: [Filtre, string][] = [
    ['open', `Coursier à envoyer (${nombre('open')})`], ['courier_dispatched', `Coursier en route (${nombre('courier_dispatched')})`],
    ['resolved', `Résolus (${nombre('resolved')})`], ['tous', `Tous (${tous.length})`],
  ];

  const colonnes: Colonne<SavTicket>[] = [
    { cle: 'numero', titre: 'Dossier', fixe: true, tri: (t) => t.createdAt, rendu: (t) => (
      <span className="block"><span className="block font-mono text-xs font-bold text-slate-900">{t.ticketNumber}</span><span className="block text-xs text-slate-500">{jour(t.createdAt)}</span></span>
    ) },
    { cle: 'commande', titre: 'Commande', tri: (t) => t.orderNumber, rendu: (t) => <span className="font-mono text-xs">{t.orderNumber}</span> },
    { cle: 'produit', titre: 'Produit', tri: (t) => t.productName, rendu: (t) => <span className="block min-w-[140px]">{t.productName}</span> },
    { cle: 'client', titre: 'Client', tri: (t) => t.customerName, rendu: (t) => (
      <span className="block"><span className="block font-semibold text-slate-900">{t.customerName}</span><span className="block text-xs text-slate-500 tabular-nums">{t.customerPhone}</span></span>
    ) },
    { cle: 'resolution', titre: 'Solution', cachee: true, rendu: (t) => t.issueDescription?.startsWith('[Incident de course') ? 'Incident de course — décision équipe' : RESOLUTION[t.resolutionType] || t.resolutionType },
    { cle: 'fournisseur', titre: 'Fournisseur', cachee: true, tri: (t) => t.supplierName || '', rendu: (t) => t.supplierName || '—' },
    { cle: 'coursier', titre: 'Coursier', tri: (t) => t.driverName || '', rendu: (t) => t.driverName || '—' },
    { cle: 'statut', titre: 'Statut', tri: (t) => t.status, rendu: pastille },
  ];

  const ticket = tous.find((t) => t.id === ouvert) || null;
  const choix = livreurChoisi || livreurs[0]?.id || '';

  return (
    <PageReseau titre="Service après-vente" large
      sousTitre="Pannes sous garantie, réclamations et échanges à domicile à Bamako."
      action={
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setScanOuvert(true)}><QrCode className="w-4 h-4" />Scanner un reçu</Button>
          {peutModifier && <Button size="sm" onClick={() => setCreation(true)}><Plus className="w-4 h-4" />Ouvrir un dossier SAV</Button>}
        </span>
      }>

      {filtreCommande && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-suguba-menthe border border-suguba-profond/20 px-4 py-2.5 text-sm">
          <span className="text-slate-900">Demandes de la commande <strong className="font-mono">{filtreCommande}</strong> ({parCommande.length})</span>
          <button type="button" onClick={() => setFiltreCommande(null)} className="min-h-[40px] px-3 font-bold text-suguba-profond underline">Tout afficher</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Dossiers à traiter" valeur={tickets ? nombre('open') : '—'} aide="À traiter en priorité" />
        <StatCard label="Coursier en route" valeur={tickets ? nombre('courier_dispatched') : '—'} aide="Échange en cours" />
        <StatCard label="Résolus" valeur={tickets ? nombre('resolved') : '—'} aide="Dossiers clos" />
      </div>

      {!filtreCommande && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Statut">
          {FILTRES.map(([f, libelle]) => (
            <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}
              className={`px-3.5 h-10 rounded-full text-sm font-semibold whitespace-nowrap ${filtre === f ? 'bg-suguba-profond text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>{libelle}</button>
          ))}
        </div>
      )}

      {erreur && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
      {tickets === null ? <Card padding="p-8" className="text-sm text-slate-500 text-center">Chargement des réclamations…</Card>
        : liste.length === 0 ? (
          <EmptyState icone={LifeBuoy} titre={filtreCommande ? 'Aucune demande SAV pour cette commande' : 'Rien dans cette file'}
            texte={filtre === 'open' && !filtreCommande ? 'Aucune réclamation n’attend de coursier.' : undefined} />
        ) : (
          <TableauAdmin<SavTicket> titre="Réclamations" memoire="sav" lignes={liste} colonnes={colonnes} cleLigne={(t) => t.id}
            onOuvrir={(t) => setOuvert(t.id)} cible={cible}
            carteMobile={(t) => (
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{t.productName}</p>
                  {pastille(t)}
                </div>
                <p className="text-xs text-slate-500 font-mono">{t.ticketNumber} · commande {t.orderNumber} · {jour(t.createdAt)}</p>
                <p className="text-xs text-slate-600">{t.customerName}</p>
              </div>
            )} />
        )}

      <Panneau ouvert={Boolean(ticket)} onFermer={() => setOuvert(null)}
        titre={ticket ? `Dossier SAV ${ticket.ticketNumber}` : ''}
        sousTitre={ticket ? `Commande ${ticket.orderNumber} · ${ticket.productName}` : undefined}>
        {ticket && (
          <>
            <div>{pastille(ticket)}</div>
            <dl>
              <Info libelle="Client">{ticket.customerName}</Info>
              <Info libelle="Téléphone"><a href={`tel:${ticket.customerPhone}`} className="text-suguba-profond hover:underline tabular-nums">{ticket.customerPhone}</a></Info>
              <Info libelle="Solution">{ticket.issueDescription?.startsWith('[Incident de course') ? 'Incident de course — décision équipe' : RESOLUTION[ticket.resolutionType] || ticket.resolutionType}</Info>
              {ticket.supplierName && <Info libelle="Fournisseur">{ticket.supplierName}</Info>}
              {ticket.driverName && <Info libelle="Coursier">{ticket.driverName}{ticket.driverPhone ? ` (${ticket.driverPhone})` : ''}</Info>}
              {ticket.status === 'courier_dispatched' && ticket.swapOtp && <Info libelle="Code secret d’échange"><span className="font-mono text-rose-700">{ticket.swapOtp}</span></Info>}
              <Info libelle="Ouvert le">{jour(ticket.createdAt)}</Info>
            </dl>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">Panne déclarée</p>
              <p className="text-sm text-slate-800 bg-slate-50 rounded-2xl p-3 whitespace-pre-line">{ticket.issueDescription}</p>
            </div>
            {/Photos jointes : \d/.test(ticket.issueDescription || '') && (
              photos[ticket.id] === undefined ? (
                <Button variant="ghost" size="sm" onClick={() => chargerPhotos(ticket.id)}><ImageIcon className="w-4 h-4" />Voir les photos du client</Button>
              ) : photos[ticket.id] === 'chargement' ? (
                <p className="text-sm text-slate-500"><SugubaLoader className="mr-2 inline-flex h-5 w-5 align-middle" />Chargement des photos…</p>
              ) : (photos[ticket.id] as string[]).length === 0 ? (
                <p className="text-sm text-slate-500">Photos introuvables.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {(photos[ticket.id] as string[]).map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Photo ${i + 1} du client`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${i + 1} du client`} className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                    </a>
                  ))}
                </div>
              )
            )}
            {ticket.notes && <p className="text-sm text-slate-600 italic">Notes : {ticket.notes}</p>}

            {ticket.status !== 'resolved' && ticket.status !== 'rejected' && (
              <div className="grid grid-cols-2 gap-2">
                <Button href={`tel:${ticket.customerPhone}`} variant="secondary" size="sm"><Phone className="w-4 h-4" />Appeler le client</Button>
                {!ticket.issueDescription?.startsWith('[Incident de course') && <Button variant="whatsapp" size="sm" target="_blank" rel="noopener noreferrer"
                  href={`https://api.whatsapp.com/send?phone=${ticket.customerPhone.replace(/\D/g, '')}&text=${encodeURIComponent(`Bonjour ${ticket.customerName}, votre dossier SAV ${ticket.ticketNumber} sur Suguba Mali a été pris en charge. Un livreur passe pour l’échange de votre ${ticket.productName}.`)}`}>
                  <MessageCircle className="w-4 h-4" />Suivi WhatsApp
                </Button>}
              </div>
            )}

            {peutModifier && ticket.status === 'open' && !ticket.issueDescription?.startsWith('[Incident de course') && (
              <Card padding="p-4" className="space-y-2 !bg-slate-50">
                <p className="text-sm font-semibold text-slate-800">Envoyer un coursier</p>
                {livreurs.length === 0 ? <p className="text-sm text-slate-600">Aucun livreur actif : vérifiez-en un dans « Livreurs ».</p> : (
                  <>
                    <ChoicePicker ariaLabel="Coursier" valeur={choix} onChange={setLivreurChoisi} choix={livreurs.map((d) => ({ valeur: d.id, libelle: d.fullName }))} />
                    <Button fullWidth disabled={enCours || !choix} onClick={() => agir({ ticketId: ticket.id, action: 'dispatch', driverId: choix }, 'Coursier envoyé.')}>
                      {enCours ? <SugubaLoader className="w-4 h-4" /> : <Truck className="w-4 h-4" />}Envoyer ce coursier
                    </Button>
                  </>
                )}
              </Card>
            )}
            {peutModifier && ticket.status === 'open' && ticket.issueDescription?.startsWith('[Incident de course') && <Card className="space-y-3"><label htmlFor="incident-decision" className="font-semibold text-sm">Décision de l’équipe</label><textarea id="incident-decision" value={decisionIncident} onChange={e => setDecisionIncident(e.target.value)} maxLength={1000} className="w-full border rounded-xl p-3" placeholder="Instructions communiquées au livreur et suite donnée"/><p className="text-xs text-slate-600">La clôture du signalement ne change pas la commande ni son règlement.</p><Button disabled={enCours || !decisionIncident.trim()} onClick={() => agir({ ticketId: ticket.id, action: 'resolve', notes: decisionIncident.trim() }, 'Signalement clos.')}>Enregistrer la décision et clore</Button></Card>}
            {peutModifier && ticket.status === 'courier_dispatched' && (
              <Button fullWidth disabled={enCours} onClick={() => agir({
                ticketId: ticket.id, action: 'resolve',
                notes: 'Échange neuf remis au client et pièce défectueuse retournée au fournisseur.',
              }, 'Dossier clos.')}>
                {enCours ? <SugubaLoader className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}Échange réussi : clore le dossier
              </Button>
            )}
            {ticket.status === 'courier_dispatched' && (
              <p className="text-xs text-slate-500 flex items-center gap-1"><Bike className="w-3.5 h-3.5" />Le coursier remet le produit neuf contre le code secret d’échange du client.</p>
            )}
          </>
        )}
      </Panneau>

      {creation && (
        <CreateSavTicketModal orders={deliveredOrders} isOpen={creation} onClose={() => setCreation(false)} onCreated={() => { chargerTickets(); rafraichir(); }} />
      )}

      <Sheet ouvert={scanOuvert} onFermer={fermerScan} titre="Scanner un reçu client"
        sousTitre="Retrouvez la commande à partir du QR du reçu Suguba.">
        {commandeScannee ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Commande <strong className="font-mono text-slate-900">{commandeScannee}</strong></p>
            <div className="grid gap-2">
              <Button href={`/admin/commandes?q=${encodeURIComponent(commandeScannee)}`} fullWidth>Voir la commande</Button>
              <Button variant="ghost" fullWidth onClick={() => { setFiltreCommande(commandeScannee); fermerScan(); }}>
                Ses demandes SAV ({tous.filter((t) => t.orderNumber === commandeScannee).length})
              </Button>
              <button type="button" onClick={() => setCommandeScannee(null)} className="min-h-[44px] text-sm font-bold text-slate-600">Scanner un autre reçu</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {scanOuvert && <ScannerQr onLecture={apresScan} />}
            {erreurScan && <p role="alert" className="text-sm font-semibold text-rose-700">{erreurScan}</p>}
            <p className="text-xs text-slate-500">Le scan sert seulement à retrouver la commande : il ne valide ni livraison ni retour.</p>
          </div>
        )}
      </Sheet>
    </PageReseau>
  );
}
