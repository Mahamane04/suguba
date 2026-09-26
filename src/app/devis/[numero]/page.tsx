'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { devisAccessKey, rememberOrderAccess } from '@/lib/order-access-client';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { CheckCircle2, Clock, FileText, QrCode, XCircle } from 'lucide-react';
import FilMessages from '@/components/messagerie/FilMessages';

interface DevisClient {
  numero: string;
  statut: 'demande' | 'proposee' | 'acceptee' | 'refusee_client' | 'refusee_fournisseur' | 'expiree';
  creeLe: string;
  produit: { nom: string; slug: string | null; image: string | null };
  quantite: number;
  besoin: string;
  prix: { articles: number; livraison: number; modeLivraison: string; total: number } | null;
  conditions: string | null;
  valableJusqu: string | null;
  motifRefus: string | null;
  orderNumber: string | null;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/**
 * Devis du client (2026-09-26, lot 1b). Ouvert seulement sur le téléphone qui
 * l'a demandé (clé gardée 90 jours). Accepter crée la commande au prix du
 * devis et ouvre directement son reçu QR.
 */
export default function DevisClientPage() {
  const params = useParams();
  const router = useRouter();
  const numero = decodeURIComponent(String(params?.numero || ''));
  const [devis, setDevis] = useState<DevisClient | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'sans-cle' | 'erreur' | 'ok'>('chargement');
  const [erreur, setErreur] = useState('');
  const [confirmer, setConfirmer] = useState<'accepter' | 'refuser' | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    const cle = devisAccessKey(numero);
    if (!cle) { setEtat('sans-cle'); return; }
    try {
      const r = await fetch('/api/devis/lire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero, accessKey: cle }) });
      const j = await r.json().catch(() => null);
      if (r.status === 403) { setEtat('sans-cle'); return; }
      if (!r.ok || !j?.devis) throw new Error(j?.error || 'Devis indisponible.');
      setDevis(j.devis);
      // Devis accepté : la même clé ouvre le reçu de la commande.
      if (j.devis.orderNumber) rememberOrderAccess(j.devis.orderNumber, cle);
      setEtat('ok');
    } catch (e) {
      setErreur((e as Error).message);
      setEtat('erreur');
    }
  }, [numero]);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (decision: 'accepter' | 'refuser') => {
    const cle = devisAccessKey(numero);
    if (!cle) return;
    setEnvoi(true);
    setErreur('');
    try {
      const r = await fetch('/api/devis/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero, accessKey: cle, decision }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErreur(j?.error || 'Action impossible. Réessayez.'); return; }
      if (decision === 'accepter' && j?.order?.orderNumber) {
        rememberOrderAccess(j.order.orderNumber, cle);
        router.push(`/recu/${encodeURIComponent(j.order.orderNumber)}`);
        return;
      }
      setConfirmer(null);
      charger();
    } catch {
      setErreur('Connexion interrompue. Réessayez : rien ne sera fait deux fois.');
    } finally {
      setEnvoi(false);
    }
  };

  if (etat === 'sans-cle') {
    return (
      <div className="min-h-screen bg-slate-50"><Header />
        <main className="mx-auto max-w-xl px-4 py-10 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">Ce devis s’ouvre sur le téléphone qui l’a demandé</h1>
          <p className="text-sm text-slate-700">Ouvrez ce lien sur le téléphone utilisé pour la demande, ou contactez Suguba avec le numéro {numero}.</p>
          <Button variant="ghost" href={whatsappHelper.getSupportChatLink(numero)}>Contacter Suguba</Button>
        </main>
      </div>
    );
  }
  if (etat !== 'ok' || !devis) {
    return (
      <div className="min-h-screen bg-slate-50"><Header />
        <main className="mx-auto max-w-xl px-4 py-10 space-y-3">
          {etat === 'chargement' ? <p role="status" className="text-sm text-slate-600">Chargement du devis…</p>
            : <><p role="alert" className="text-sm text-rose-800">{erreur}</p><Button onClick={charger}>Réessayer</Button></>}
        </main>
      </div>
    );
  }

  const ETATS: Record<DevisClient['statut'], { icone: React.ReactNode; titre: string; texte: string }> = {
    demande: { icone: <Clock className="w-5 h-5 text-amber-600" />, titre: 'Demande envoyée', texte: 'Le vendeur étudie votre besoin et peut vous appeler pour le préciser. Sa proposition s’affichera ici.' },
    proposee: { icone: <FileText className="w-5 h-5 text-suguba-profond" />, titre: 'Proposition reçue', texte: devis.valableJusqu ? `Valable jusqu’au ${jour(devis.valableJusqu)}.` : '' },
    acceptee: { icone: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, titre: 'Devis accepté', texte: 'Votre commande est enregistrée. Suguba vous appelle pour la confirmer.' },
    refusee_client: { icone: <XCircle className="w-5 h-5 text-slate-500" />, titre: 'Devis refusé', texte: 'Vous avez refusé cette proposition.' },
    refusee_fournisseur: { icone: <XCircle className="w-5 h-5 text-slate-500" />, titre: 'Le vendeur ne peut pas donner suite', texte: devis.motifRefus ? `Motif : ${devis.motifRefus}` : '' },
    expiree: { icone: <Clock className="w-5 h-5 text-slate-500" />, titre: 'Proposition expirée', texte: 'Faites une nouvelle demande pour obtenir un prix à jour.' },
  };
  const e = ETATS[devis.statut];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-5 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 font-mono">Devis {devis.numero}</p>
          <h1 className="text-xl font-bold text-slate-900">{devis.produit.nom}</h1>
          <p className="text-xs text-slate-500">Demandé le {jour(devis.creeLe)} · quantité {devis.quantite}</p>
        </div>

        <section className="rounded-3xl bg-white border border-slate-200 p-4 space-y-1">
          <p className="font-bold text-slate-900 flex items-center gap-2">{e.icone} {e.titre}</p>
          {e.texte && <p className="text-sm text-slate-600">{e.texte}</p>}
        </section>

        {devis.prix && (
          <section aria-label="Prix proposé" className="rounded-3xl bg-white border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600"><span>Prix</span><span className="tabular-nums">{fcfa(devis.prix.articles)}</span></div>
            <div className="flex justify-between text-slate-600">
              <span>{devis.prix.modeLivraison === 'fournisseur' ? 'Remise par le vendeur' : devis.prix.modeLivraison === 'retrait' ? 'Retrait chez le vendeur' : 'Livraison'}</span>
              <span className="tabular-nums">{devis.prix.livraison ? fcfa(devis.prix.livraison) : 'Gratuit'}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-100 pt-2"><span>Total</span><span className="tabular-nums">{fcfa(devis.prix.total)}</span></div>
            <p className="text-xs text-slate-500">Payé à la remise, en espèces ou par Mobile Money. Rien à payer maintenant.</p>
            {devis.conditions && (
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-900 mb-1">Ce qui est compris</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{devis.conditions}</p>
              </div>
            )}
          </section>
        )}

        <details className="rounded-2xl bg-white border border-slate-200 p-4 text-sm">
          <summary className="font-bold text-slate-900 cursor-pointer">Votre demande</summary>
          <p className="mt-2 text-slate-700 whitespace-pre-line">{devis.besoin}</p>
        </details>

        {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}

        {devis.statut === 'proposee' && (confirmer ? (
          <div className="rounded-3xl bg-white border border-suguba-profond p-4 space-y-3">
            <p className="text-sm text-slate-800">
              {confirmer === 'accepter'
                ? <>Accepter ce devis pour <strong>{fcfa(devis.prix?.total || 0)}</strong> ? Votre commande sera enregistrée et Suguba vous appellera pour la confirmer.</>
                : 'Refuser cette proposition ? Vous pourrez faire une nouvelle demande.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirmer(null)} disabled={envoi}>Retour</Button>
              <Button variant={confirmer === 'refuser' ? 'danger' : 'primary'} onClick={() => decider(confirmer)} disabled={envoi}>
                {envoi ? 'Un instant…' : confirmer === 'accepter' ? 'Oui, j’accepte' : 'Oui, refuser'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Button fullWidth onClick={() => setConfirmer('accepter')}>Accepter le devis</Button>
            <Button fullWidth variant="ghost" onClick={() => setConfirmer('refuser')}>Refuser</Button>
          </div>
        ))}

        {devis.statut === 'acceptee' && devis.orderNumber && (
          <Button fullWidth href={`/recu/${encodeURIComponent(devis.orderNumber)}`}>
            <QrCode className="w-4 h-4" /> Mon reçu avec QR code
          </Button>
        )}
        {['expiree', 'refusee_client', 'refusee_fournisseur'].includes(devis.statut) && devis.produit.slug && (
          <Button fullWidth variant="secondary" href={`/p/${devis.produit.slug}/devis`}>Faire une nouvelle demande</Button>
        )}

        {/* Échanger avec le vendeur dans le dossier (Protection Suguba, lot 3). */}
        {['demande', 'proposee', 'acceptee'].includes(devis.statut) && (
          <details className="rounded-2xl bg-white border border-slate-200 p-4 text-sm">
            <summary className="font-bold text-slate-900 cursor-pointer">Échanger avec le vendeur</summary>
            <div className="mt-3"><FilDevisClient numero={devis.numero} /></div>
          </details>
        )}

        <a href={whatsappHelper.getSupportChatLink(devis.numero)} target="_blank" rel="noopener noreferrer"
          className="h-12 w-full rounded-2xl bg-suguba-wa hover:bg-[#20bd5a] text-suguba-profond text-sm font-bold inline-flex items-center justify-center gap-2">
          <WhatsAppIcon className="w-4 h-4" /> Une question ? Écrivez à Suguba
        </a>
        <p className="text-center text-xs text-slate-500"><Link href="/track" className="underline">Mes devis et reçus sur ce téléphone</Link></p>
      </main>
    </div>
  );
}

/** Messages du devis, avec la clé gardée sur ce téléphone. */
function FilDevisClient({ numero }: { numero: string }) {
  const appel = useCallback(async (action: 'lire' | 'envoyer', texte?: string) => {
    const r = await fetch('/api/devis/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, accessKey: devisAccessKey(numero), action, texte }),
    });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  }, [numero]);
  const charger = useCallback(async () => { const { ok, j } = await appel('lire'); if (!ok) throw new Error(j.error); return j.messages || []; }, [appel]);
  const envoyer = useCallback(async (texte: string) => {
    const { ok, j } = await appel('envoyer', texte);
    return ok ? { avertissement: j.avertissement } : { error: j.error || 'Envoi impossible.' };
  }, [appel]);
  return <FilMessages charger={charger} envoyer={envoyer} placeholder="Précisez votre besoin, un créneau, une question…" />;
}
