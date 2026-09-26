'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import Header from '@/components/common/Header';
import ProductImage from '@/components/common/ProductImage';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cleDuCompte, orderAccessKey } from '@/lib/order-access-client';
import { contenuQrRemise } from '@/lib/qr-remise';
import { dessinerRecu } from '@/lib/recu-image';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import type { RecuCommande } from '@/lib/recu-commande';
import { AlertTriangle, Camera, CheckCircle2, Circle, Clock, Download, LifeBuoy, Printer, Send, Truck, X } from 'lucide-react';
import type { ArticleRecu } from '@/lib/recu-commande';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const dateLongue = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * « Mon reçu Suguba » (2026-09-25) — reçu client confidentiel.
 *
 * Il réunit ce que le client doit garder : le QR de remise avec le code écrit
 * dessous (à présenter au livreur APRÈS vérification du colis), le détail de
 * la commande, et l'accès au SAV après livraison. Enregistrable en image (pour
 * le présenter sans connexion) et imprimable en PDF.
 *
 * Ouvert seulement avec la clé du reçu gardée sur l'appareil qui a passé la
 * commande (90 jours). Le suivi public (numéro + téléphone) ne l'ouvre pas.
 */
export default function RecuPage() {
  const params = useParams();
  const numero = decodeURIComponent(String(params?.orderNumber || ''));
  const { toast } = useToast();
  const [recu, setRecu] = useState<RecuCommande | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'sans-cle' | 'erreur' | 'ok'>('chargement');
  const [erreur, setErreur] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [transmettre, setTransmettre] = useState(false);
  const [sav, setSav] = useState(false);
  const [image, setImage] = useState(false);

  const charger = useCallback(async () => {
    // Compte client (C1) : sans clé sur ce téléphone, le propriétaire connecté en reçoit une.
    let cle = orderAccessKey(numero) || await cleDuCompte('commande', numero);
    if (!cle) { setEtat('sans-cle'); return; }
    setEtat('chargement');
    try {
      const lire = (k: string) => fetch('/api/orders/recu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: numero, accessKey: k }),
      });
      let r = await lire(cle);
      if (r.status === 403) {
        const autre = await cleDuCompte('commande', numero);
        if (autre && autre !== cle) { cle = autre; r = await lire(cle); }
      }
      const j = await r.json().catch(() => null);
      if (r.status === 403) { setEtat('sans-cle'); return; }
      if (!r.ok || !j?.recu) throw new Error(j?.error || 'Reçu indisponible. Réessayez.');
      setRecu(j.recu);
      setEtat('ok');
    } catch (e) {
      setErreur((e as Error).message);
      setEtat('erreur');
    }
  }, [numero]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!recu?.code) { setQr(null); return; }
    QRCode.toDataURL(contenuQrRemise(recu.orderNumber, recu.code), { width: 560, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(null));
  }, [recu]);

  const fichierImage = async () => {
    const blob = await dessinerRecu(recu!);
    return new File([blob], `recu-suguba-${recu!.orderNumber}.png`, { type: 'image/png' });
  };

  const telecharger = (f: File) => {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /** Sur téléphone : feuille de partage (« Enregistrer l'image »). Ailleurs : téléchargement. */
  const enregistrer = async () => {
    setImage(true);
    try {
      const f = await fichierImage();
      const tactile = window.matchMedia?.('(pointer: coarse)').matches;
      if (tactile && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: `Reçu Suguba ${recu!.orderNumber}` }).catch(() => undefined);
      } else {
        telecharger(f);
        toast('Reçu enregistré dans vos téléchargements.', { ton: 'succes' });
      }
    } catch {
      toast('Image impossible sur ce téléphone. Faites une capture d’écran du reçu.', { ton: 'erreur', duree: 7000 });
    } finally {
      setImage(false);
    }
  };

  const envoyerAuDestinataire = async () => {
    setImage(true);
    try {
      const f = await fichierImage();
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: `Reçu Suguba ${recu!.orderNumber}`, text: 'Votre reçu Suguba. Présentez le QR au livreur seulement après avoir vérifié le colis.' }).catch(() => undefined);
      } else {
        telecharger(f);
        toast('Image enregistrée : envoyez-la au destinataire.', { ton: 'info', duree: 6000 });
      }
      setTransmettre(false);
    } catch {
      toast('Image impossible sur ce téléphone.', { ton: 'erreur' });
    } finally {
      setImage(false);
    }
  };

  if (etat === 'sans-cle') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10 space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Ce reçu s’ouvre sur le téléphone qui a passé la commande</h1>
          <p className="text-sm text-slate-700">
            Pour protéger votre code de remise, le reçu n’est pas accessible avec le seul numéro de commande.
            Ouvrez ce lien sur le téléphone utilisé pour commander, ou demandez à la personne qui a commandé
            de vous transmettre le reçu.
          </p>
          <p className="text-sm text-slate-700">
            Commande passée avec votre compte client ? <a href={`/login?next=${encodeURIComponent(`/recu/${numero}`)}`} className="font-bold underline">Connectez-vous</a> : vos reçus s’ouvrent sur tous vos téléphones.
          </p>
          <div className="flex flex-col gap-2">
            <Button href={`/track/${encodeURIComponent(numero)}`}>Suivre la commande #{numero}</Button>
            <Button variant="ghost" href={whatsappHelper.getSupportChatLink(numero)}>Contacter Suguba</Button>
          </div>
        </main>
      </div>
    );
  }

  if (etat !== 'ok' || !recu) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10 space-y-4">
          {etat === 'chargement' ? (
            <p role="status" className="text-sm text-slate-600">Chargement de votre reçu…</p>
          ) : (
            <>
              <p role="alert" className="text-sm text-rose-800">{erreur}</p>
              <Button onClick={charger}>Réessayer</Button>
            </>
          )}
        </main>
      </div>
    );
  }

  const annulee = ['cancelled', 'returned'].includes(recu.status);
  const livres = recu.articles.filter((a) => a.status === 'delivered');

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 print:bg-white">
      <div className="print:hidden"><Header /></div>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-5 space-y-4 print:p-0 print:max-w-none">
        <article aria-label={`Reçu de la commande ${recu.orderNumber}`} className="bg-white rounded-3xl overflow-hidden border border-slate-200 print:border-0 print:rounded-none">
          <header className="bg-suguba-profond text-white px-5 py-4 flex items-start justify-between gap-3 print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900">
            <div>
              <p className="text-xl font-bold tracking-wide">SUGUBA</p>
              <p className="text-sm text-suguba-citron print:text-slate-700">Reçu de commande</p>
            </div>
            <div className="text-right">
              <p className="font-bold font-mono">N° {recu.orderNumber}</p>
              <p className="text-xs text-white/80 print:text-slate-600">{new Date(recu.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </header>

          <div className="p-5 space-y-5">
            {recu.code ? (
              <section aria-label="QR de remise" className="text-center space-y-2">
                {qr
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={qr} alt="QR de remise à présenter au livreur" width={260} height={260} className="mx-auto w-[260px] h-[260px] [image-rendering:pixelated]" />
                  : <div className="mx-auto w-[260px] h-[260px] bg-slate-100 rounded-2xl animate-pulse" />}
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Code de remise</p>
                <p className="font-mono text-xl font-bold tracking-[0.4em] text-slate-900" aria-live="polite">{recu.code}</p>
                <p className="rounded-2xl bg-amber-50 text-amber-900 text-sm p-3 flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {recu.modeRemise && recu.modeRemise !== 'livreur' ? 'Présentez ce QR au vendeur' : 'Présentez ce QR au livreur'}{' '}
                    <strong>uniquement après avoir vérifié {recu.articles.some((a) => a.etapes.length) ? 'que tout est fait' : 'votre colis'}</strong>. Ne l’envoyez pas à l’avance.
                  </span>
                </p>
              </section>
            ) : recu.livre ? (
              <p className="rounded-2xl bg-emerald-50 text-emerald-900 p-3 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" /> Livrée{recu.deliveredAt ? ` le ${dateLongue(recu.deliveredAt)}` : ''}
              </p>
            ) : annulee ? (
              <p className="rounded-2xl bg-slate-100 text-slate-700 p-3 text-sm font-bold">Commande annulée.</p>
            ) : (
              <p role="alert" className="rounded-2xl bg-slate-100 text-slate-700 p-3 text-sm">{recu.codeErreur || 'Code de remise indisponible pour le moment.'}</p>
            )}

            <section aria-label="Articles" className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Articles</h2>
              {recu.articles.map((a) => {
                const annule = ['cancelled', 'returned'].includes(a.status);
                return (
                  <div key={a.orderNumber} className={`flex items-center gap-3 ${annule ? 'opacity-60' : ''}`}>
                    {a.productImage && (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 print:hidden">
                        <ProductImage src={a.productImage} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{a.productName}{annule ? ' (annulé)' : ''}</p>
                      <p className="text-xs text-slate-500">{a.quantity} × {fcfa(a.unitPrice)}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fcfa(a.articles)}</p>
                  </div>
                );
              })}
            </section>

            <section aria-label="Montants" className="border-t border-slate-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600"><span>Articles</span><span className="tabular-nums">{fcfa(recu.totalArticles)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Livraison</span><span className="tabular-nums">{fcfa(recu.totalLivraison)}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base"><span>Total</span><span className="tabular-nums">{fcfa(recu.total)}</span></div>
              <p className={`mt-2 rounded-xl px-3 py-2 font-bold flex justify-between ${recu.payeEnLigne || recu.resteAPayer === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                <span>{recu.payeEnLigne ? 'Payé en ligne (Mobile Money)' : recu.resteAPayer > 0 ? 'À payer au livreur' : 'Réglé'}</span>
                {!recu.payeEnLigne && recu.resteAPayer > 0 && <span className="tabular-nums">{fcfa(recu.resteAPayer)}</span>}
              </p>
            </section>

            <section aria-label="Destinataire" className="border-t border-slate-100 pt-3 text-sm">
              <p className="text-xs text-slate-500">Destinataire</p>
              <p className="font-semibold text-slate-900">{recu.destinataire}</p>
              {recu.lieu && <p className="text-slate-600">{recu.lieu}</p>}
              {recu.modeRemise && recu.modeRemise !== 'livreur' && (
                <p className="mt-1 text-slate-700">
                  {recu.modeRemise === 'retrait' ? 'À retirer chez le vendeur' : 'Remis par le vendeur'} : il vous contacte pour le rendez-vous.
                </p>
              )}
            </section>

            {recu.articles.filter((a) => a.etapes.length > 0 && !['cancelled', 'returned'].includes(a.status)).map((a) => (
              <EtapesPrestation key={a.orderNumber} numero={numero} article={a} plusieurs={recu.articles.length > 1} onMaj={charger} />
            ))}

            <section aria-label="Assistance" className="border-t border-slate-100 pt-3 text-sm text-slate-700 space-y-1">
              <p>Une question ? Donnez le numéro <strong className="font-mono">{recu.orderNumber}</strong> au service client.</p>
              <p className="text-xs text-slate-500">Édité le {dateLongue(recu.editeLe)}. L’état à jour est dans votre suivi.</p>
            </section>
          </div>
        </article>

        <div className="space-y-2 print:hidden">
          <Button fullWidth onClick={enregistrer} disabled={image}>
            <Download className="w-4 h-4" /> {image ? 'Préparation…' : 'Enregistrer mon reçu'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimer / PDF</Button>
            <Button variant="secondary" href={`/track/${encodeURIComponent(recu.orderNumber)}`}><Truck className="w-4 h-4" /> Suivi</Button>
          </div>

          {recu.code && (transmettre ? (
            <div className="rounded-2xl bg-white border border-amber-300 p-4 space-y-3">
              <p className="text-sm text-slate-800">
                <strong>Ce reçu permet de confirmer la remise du colis.</strong> Envoyez-le seulement à la personne
                qui va réceptionner la commande, jamais au livreur.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setTransmettre(false)}>Annuler</Button>
                <Button onClick={envoyerAuDestinataire} disabled={image}><Send className="w-4 h-4" /> Envoyer</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" fullWidth onClick={() => setTransmettre(true)}>
              <Send className="w-4 h-4" /> Transmettre au destinataire
            </Button>
          ))}

          {livres.length > 0 && (
            <Button variant="ghost" fullWidth onClick={() => setSav(true)}>
              <LifeBuoy className="w-4 h-4" /> Signaler un problème avec un article
            </Button>
          )}

          <a href={whatsappHelper.getSupportChatLink(recu.orderNumber)} target="_blank" rel="noopener noreferrer"
            className="h-12 w-full rounded-2xl bg-suguba-wa hover:bg-[#20bd5a] text-suguba-profond text-sm font-bold inline-flex items-center justify-center gap-2">
            <WhatsAppIcon className="w-4 h-4" /> Contacter Suguba sur WhatsApp
          </a>
          <p className="text-center text-xs text-slate-500">
            <Link href="/track" className="underline">Mes reçus sur ce téléphone</Link>
          </p>
        </div>
      </main>

      {sav && <SignalerProbleme numero={numero} articles={livres} onFermer={() => setSav(false)} />}
    </div>
  );
}

const MOTIFS = [
  ['defectueux', 'Défectueux ou en panne'],
  ['endommage', 'Abîmé à la livraison'],
  ['non_conforme', 'Pas l’article commandé'],
  ['manquant', 'Article ou pièce manquant'],
  ['autre', 'Autre problème'],
] as const;
const SOUHAITS = [['echange', 'Échange'], ['reparation', 'Réparation'], ['remboursement', 'Remboursement']] as const;
const PHOTOS_MAX = 3;

/**
 * Photo réduite DANS le téléphone avant l'envoi (1600 px, JPEG) : une photo
 * d'appareil fait souvent 4 à 8 Mo, trop lourd sur une connexion mobile et
 * au-delà de la limite du serveur (5 Mo). Le serveur la réencode ensuite
 * (métadonnées et position GPS retirées).
 */
async function reduirePhoto(f: File): Promise<File> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const echelle = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const toile = document.createElement('canvas');
    toile.width = Math.round(img.naturalWidth * echelle);
    toile.height = Math.round(img.naturalHeight * echelle);
    toile.getContext('2d')!.drawImage(img, 0, 0, toile.width, toile.height);
    const blob = await new Promise<Blob>((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error('photo'))), 'image/jpeg', 0.82));
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Pastille({ actif, children, onClick }: { actif: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={actif} onClick={onClick}
      className={`min-h-11 px-3 rounded-2xl border text-sm text-left ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond bg-suguba-menthe font-semibold' : 'border-slate-200 bg-white'}`}>
      {children}
    </button>
  );
}

function SignalerProbleme({ numero, articles, onFermer }: {
  numero: string;
  articles: RecuCommande['articles'];
  onFermer: () => void;
}) {
  const [article, setArticle] = useState(articles[0]?.orderNumber || '');
  const [motif, setMotif] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [souhait, setSouhait] = useState('echange');
  const [detail, setDetail] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ fichier: File; apercu: string }[]>([]);
  const choisi = articles.find((a) => a.orderNumber === article);

  const ajouterPhotos = async (liste: FileList | null) => {
    if (!liste) return;
    setErreur('');
    const place = PHOTOS_MAX - photos.length;
    const nouvelles: { fichier: File; apercu: string }[] = [];
    for (const f of Array.from(liste).slice(0, place)) {
      try {
        const fichier = await reduirePhoto(f);
        nouvelles.push({ fichier, apercu: URL.createObjectURL(fichier) });
      } catch {
        setErreur('Une photo n’a pas pu être lue. Essayez-en une autre.');
      }
    }
    if (liste.length > place) setErreur(`${PHOTOS_MAX} photos au maximum.`);
    setPhotos((p) => [...p, ...nouvelles]);
  };
  const retirerPhoto = (i: number) => setPhotos((p) => {
    URL.revokeObjectURL(p[i].apercu);
    return p.filter((_, j) => j !== i);
  });

  const envoyer = async () => {
    setErreur('');
    if (!motif) { setErreur('Choisissez le problème rencontré.'); return; }
    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.set('orderNumber', article);
      donnees.set('accessKey', orderAccessKey(numero) || orderAccessKey(article) || '');
      donnees.set('motif', motif);
      donnees.set('quantite', String(quantite));
      donnees.set('souhait', souhait);
      donnees.set('detail', detail);
      for (const p of photos) donnees.append('photos', p.fichier);
      const r = await fetch('/api/orders/sav', { method: 'POST', body: donnees });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErreur(j?.error || 'Envoi impossible. Réessayez.'); return; }
      setTicket(j.ticketNumber);
    } catch {
      setErreur('Connexion interrompue. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Sheet ouvert onFermer={onFermer} titre="Signaler un problème" sousTitre="Votre demande arrive au service après-vente de Suguba."
      pied={ticket
        ? <Button fullWidth onClick={onFermer}>Fermer</Button>
        : <Button fullWidth onClick={envoyer} disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer ma demande'}</Button>}>
      {ticket ? (
        <div className="text-center space-y-2 py-4">
          <CheckCircle2 className="w-12 h-12 text-suguba-brand-dark mx-auto" />
          <p className="font-bold text-slate-900">Demande envoyée : {ticket}</p>
          <p className="text-sm text-slate-600">L’équipe SAV étudie votre demande et vous contacte au numéro de la commande. Gardez l’article et son emballage.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.length > 1 && (
            <div role="radiogroup" aria-label="Article concerné" className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Article concerné</p>
              {articles.map((a) => (
                <Pastille key={a.orderNumber} actif={article === a.orderNumber} onClick={() => { setArticle(a.orderNumber); setQuantite(1); }}>
                  {a.productName}
                </Pastille>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label="Problème" className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700">Le problème <span className="text-rose-600">*</span></p>
            <div className="grid grid-cols-1 gap-1.5">
              {MOTIFS.map(([v, l]) => <Pastille key={v} actif={motif === v} onClick={() => setMotif(v)}>{l}</Pastille>)}
            </div>
          </div>
          {choisi && choisi.quantity > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Quantité concernée</p>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => setQuantite((q) => Math.max(1, q - 1))} aria-label="Moins">−</Button>
                <span className="font-bold tabular-nums">{quantite} / {choisi.quantity}</span>
                <Button variant="secondary" size="sm" onClick={() => setQuantite((q) => Math.min(choisi.quantity, q + 1))} aria-label="Plus">+</Button>
              </div>
            </div>
          )}
          <div role="radiogroup" aria-label="Ce que vous souhaitez" className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700">Ce que vous souhaitez</p>
            <div className="flex flex-wrap gap-1.5">
              {SOUHAITS.map(([v, l]) => <Pastille key={v} actif={souhait === v} onClick={() => setSouhait(v)}>{l}</Pastille>)}
            </div>
          </div>
          <Field label="Détails (facultatif)" aide="Ce qui ne va pas, depuis quand…">
            <Textarea rows={3} maxLength={1000} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </Field>
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700">Photos (facultatif, {PHOTOS_MAX} au maximum)</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.apercu} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.apercu} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                  <button type="button" onClick={() => retirerPhoto(i)} aria-label={`Retirer la photo ${i + 1}`}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length < PHOTOS_MAX && (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-600 text-xs font-bold cursor-pointer hover:bg-slate-50">
                  <Camera className="w-5 h-5" />
                  Ajouter
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={(e) => { ajouterPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500">Montrez le problème et l’étiquette du colis. Les photos ne sont vues que par l’équipe SAV.</p>
          </div>
          <p className="text-xs text-slate-500">Une demande n’est pas une acceptation automatique : l’équipe l’étudie selon la politique de garantie.</p>
          {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}
        </div>
      )}
    </Sheet>
  );
}

const heureCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Étapes de la prestation (2026-09-26, lot 1c). Le vendeur déclare chaque
 * étape avec sa preuve ; le client la valide ici, ou signale un problème.
 * La remise finale (QR) n'est possible qu'une fois tout validé.
 */
function EtapesPrestation({ numero, article, plusieurs, onMaj }: { numero: string; article: ArticleRecu; plusieurs: boolean; onMaj: () => void }) {
  const { toast } = useToast();
  const [ouverte, setOuverte] = useState<{ position: number; mode: 'valider' | 'contester' } | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const validees = article.etapes.filter((e) => e.statut === 'validee').length;
  const livre = article.status === 'delivered';

  const repondre = async (position: number, decision: 'valider' | 'contester') => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/orders/etapes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: article.orderNumber, accessKey: orderAccessKey(numero) || orderAccessKey(article.orderNumber) || '', position, decision, motif }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Envoi impossible. Réessayez.', { ton: 'erreur' }); return; }
      toast(decision === 'valider' ? 'Étape validée. Merci !' : 'Problème signalé au vendeur et à Suguba.', { ton: decision === 'valider' ? 'succes' : 'info' });
      setOuverte(null); setMotif('');
      onMaj();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section aria-label="Étapes de la prestation" className="border-t border-slate-100 pt-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Étapes de la prestation{plusieurs ? ` · ${article.productName}` : ''}</h2>
        <p className="text-xs font-semibold text-slate-500 tabular-nums">{livre ? 'Terminé' : `${validees}/${article.etapes.length} validées`}</p>
      </div>
      <ol className="space-y-2">
        {article.etapes.map((e) => {
          const Icone = e.statut === 'validee' ? CheckCircle2 : e.statut === 'declaree' ? Clock : e.statut === 'contestee' ? AlertTriangle : Circle;
          const couleur = e.statut === 'validee' ? 'text-emerald-600' : e.statut === 'declaree' ? 'text-amber-600' : e.statut === 'contestee' ? 'text-rose-600' : 'text-slate-300';
          return (
            <li key={e.position} className={`rounded-2xl border p-3 space-y-2 ${e.statut === 'declaree' ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2.5">
                <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${couleur}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{e.libelle}</p>
                  <p className="text-xs text-slate-600">
                    {e.statut === 'validee' ? (e.valideePar === 'admin' ? 'Validée par Suguba' : 'Vous l’avez validée')
                      : e.statut === 'declaree' ? 'Le vendeur dit que c’est fait : à vous de vérifier'
                        : e.statut === 'contestee' ? 'Vous avez signalé un problème : le vendeur doit corriger'
                          : 'À faire par le vendeur'}
                  </p>
                </div>
              </div>
              {e.datePrevue && <p className="text-xs text-slate-800">Rendez-vous : <strong>{heureCourte(e.datePrevue)}</strong></p>}
              {e.note && e.statut !== 'a_faire' && <p className="text-xs text-slate-700 whitespace-pre-line">« {e.note} »</p>}
              {e.liensPhotos.length > 0 && (
                <div className="flex gap-2 print:hidden">
                  {e.liensPhotos.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${i + 1} de l’étape ${e.libelle}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {e.statut === 'contestee' && e.motifContestation && <p className="text-xs text-rose-800">Votre signalement : {e.motifContestation}</p>}

              {e.statut === 'declaree' && (ouverte?.position === e.position ? (
                ouverte.mode === 'valider' ? (
                  <div className="space-y-2 print:hidden">
                    <p className="text-xs text-slate-800">Vous confirmez que <strong>« {e.libelle} »</strong> est bien fait ? Vous ne pourrez plus revenir en arrière.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" onClick={() => setOuverte(null)} disabled={envoi}>Annuler</Button>
                      <Button onClick={() => repondre(e.position, 'valider')} disabled={envoi}>{envoi ? 'Envoi…' : 'Oui, je valide'}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 print:hidden">
                    <Field label="Qu’est-ce qui ne va pas ?" htmlFor={`motif-${article.orderNumber}-${e.position}`} requis>
                      <Textarea id={`motif-${article.orderNumber}-${e.position}`} rows={3} maxLength={1000} value={motif} onChange={(ev) => setMotif(ev.target.value)}
                        placeholder="Ex : l’installation ne marche pas, il manque une pièce…" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" onClick={() => setOuverte(null)} disabled={envoi}>Annuler</Button>
                      <Button onClick={() => repondre(e.position, 'contester')} disabled={envoi || motif.trim().length < 5}>{envoi ? 'Envoi…' : 'Envoyer'}</Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-2 print:hidden">
                  <Button onClick={() => { setOuverte({ position: e.position, mode: 'valider' }); setMotif(''); }}>C’est fait</Button>
                  <Button variant="ghost" onClick={() => { setOuverte({ position: e.position, mode: 'contester' }); setMotif(''); }}>Signaler un problème</Button>
                </div>
              ))}
            </li>
          );
        })}
      </ol>
      {!livre && (
        <p className="text-xs text-slate-500">
          Quand toutes les étapes sont validées, présentez votre QR au vendeur pour la réception finale.
        </p>
      )}
    </section>
  );
}
