'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Minus, Plus, Trash2, Loader2, Truck, Store, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { MARGE_BAS_FLOTTANT } from '@/lib/mise-en-page';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { changerQuantite, retirerDuPanier, usePanier, viderPanier } from '@/lib/panier';
import { sugubaStore, useQuartierClient, definirQuartierClient } from '@/lib/store';
import type { Order } from '@/types';

/**
 * Panier et validation (§ 29 et § 30 des écrans).
 *
 * Tous les montants viennent du serveur (/api/orders/cart-quote), recalculés
 * à chaque changement : le total affiché est celui qui sera facturé. Une
 * seule livraison par fournisseur ; si le panier mélange plusieurs
 * fournisseurs, le client le voit AVANT de valider (« 2 livraisons »).
 *
 * Coupure réseau pendant la validation : la clé de la tentative est gardée,
 * et un nouvel appui retrouve le même panier sans créer de doublon.
 */

interface LigneDevis {
  productId: string; nom: string; slug: string; image: string | null;
  quantite: number; prixUnitaire: number; montantArticles: number;
  fraisLivraison: number; remise: number; total: number;
}
interface Devis {
  lignes: LigneDevis[]; indisponibles: string[]; livraisons: number;
  articles: number; livraison: number; remise: number; total: number; codePromoValide: boolean;
}
interface Reglages { livraisonParVille: Record<string, number>; pointsRelais: { id: string; nom: string; frais: number; horaires?: string }[] }

const CLE_TENTATIVE = 'suguba_panier_tentative';
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;
const ACTIF = 'border-suguba-brand bg-suguba-brand/5 ring-1 ring-suguba-brand';
const INACTIF = 'border-slate-200 bg-white';

function nouvelleCle(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function PanierPage() {
  const router = useRouter();
  // Retour à la page précédente ; arrivé directement (lien partagé, onglet
  // neuf), il n'y a pas d'historique : on ramène à l'accueil.
  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };
  const { toast } = useToast();
  const articles = usePanier();
  const quartierMemorise = useQuartierClient();

  const [devis, setDevis] = useState<Devis | null>(null);
  const [devisEnCours, setDevisEnCours] = useState(false);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [mode, setMode] = useState<'domicile' | 'relais'>('domicile');
  const [relaisId, setRelaisId] = useState('');
  const [ville, setVille] = useState('Bamako');
  const [quartier, setQuartier] = useState('');
  const [repere, setRepere] = useState('');
  const [instructions, setInstructions] = useState('');
  const [promo, setPromo] = useState('');
  const [promoSoumis, setPromoSoumis] = useState('');
  const [tentative, setTentative] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [monte, setMonte] = useState(false);
  const requete = useRef(0);

  useEffect(() => { setMonte(true); }, []);
  useEffect(() => { if (quartierMemorise && !quartier) setQuartier(quartierMemorise); }, [quartierMemorise]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/settings/public').then((r) => (r.ok ? r.json() : null)).then((j) => j && setReglages(j)).catch(() => undefined);
  }, []);

  const relais = reglages?.pointsRelais.find((p) => p.id === relaisId) || reglages?.pointsRelais[0];

  // Devis serveur, relancé à chaque changement (articles, adresse, promo).
  useEffect(() => {
    if (articles.length === 0) { setDevis(null); return; }
    const numero = ++requete.current;
    setDevisEnCours(true);
    const minuterie = setTimeout(() => {
      fetch('/api/orders/cart-quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lignes: articles, city: ville, neighborhood: quartier,
          pickupPointId: mode === 'relais' ? relais?.id : undefined, promoCode: promoSoumis || undefined,
        }),
      })
        .then((r) => r.json())
        .then((d) => { if (numero === requete.current) setDevis(d); })
        .catch(() => undefined)
        .finally(() => { if (numero === requete.current) setDevisEnCours(false); });
    }, 250);
    return () => clearTimeout(minuterie);
  }, [articles, ville, quartier, mode, relais?.id, promoSoumis]);

  const villes = useMemo(() => {
    const liste = Object.entries(reglages?.livraisonParVille || { Bamako: 1500 });
    return liste
      .sort(([a], [b]) => (a === 'Bamako' ? -1 : b === 'Bamako' ? 1 : a.localeCompare(b)))
      .map(([v, frais]) => ({ valeur: v, libelle: v, detail: v === 'Bamako' ? 'Selon le quartier' : fcfa(Number(frais)) }));
  }, [reglages]);

  const telNormalise = telephone.replace(/[\s().-]/g, '');
  const erreurs = {
    nom: nom.trim().length < 2 ? 'Indiquez votre nom et prénom.' : undefined,
    tel: !/^\+?\d{8,15}$/.test(telNormalise) ? 'Numéro invalide : 8 chiffres minimum.' : undefined,
    quartier: mode === 'domicile' && !quartier.trim() ? 'Choisissez votre quartier.' : undefined,
    repere: mode === 'domicile' && !repere.trim() ? 'Un repère aide le livreur à vous trouver.' : undefined,
  };
  const voir = (e?: string) => (tentative ? e : undefined);
  const indisponibles = devis?.indisponibles || [];

  const valider = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTentative(true);
    if (Object.values(erreurs).some(Boolean)) {
      toast('Complétez les champs en rouge.', { ton: 'erreur' });
      return;
    }
    if (indisponibles.length > 0) {
      toast('Retirez d’abord les articles indisponibles.', { ton: 'erreur' });
      return;
    }

    const corps = {
      lignes: articles,
      customerName: nom, customerPhone: telNormalise,
      city: mode === 'relais' ? 'Bamako' : ville,
      neighborhood: mode === 'relais' ? 'Point Relais Partenaire' : quartier,
      landmark: mode === 'relais' ? relais?.nom || 'Point relais' : repere,
      deliveryNotes: instructions || undefined,
      pickupPointId: mode === 'relais' ? relais?.id : undefined,
      promoCode: promoSoumis || undefined,
    };

    // Même panier = même clé : une réponse perdue se rattrape sans doublon.
    let cle = nouvelleCle();
    try {
      const precedente = JSON.parse(sessionStorage.getItem(CLE_TENTATIVE) || 'null');
      if (precedente?.cle && JSON.stringify(precedente.corps) === JSON.stringify(corps)) cle = precedente.cle;
      sessionStorage.setItem(CLE_TENTATIVE, JSON.stringify({ cle, corps }));
    } catch { /* stockage bloqué : clé en mémoire */ }

    setEnvoi(true);
    try {
      const reponse = await fetch('/api/orders/cart', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': cle },
        body: JSON.stringify(corps),
      });
      const data = await reponse.json().catch(() => null);
      if (!reponse.ok || !data?.success || !Array.isArray(data.orders)) {
        if (data?.definitive) { try { sessionStorage.removeItem(CLE_TENTATIVE); } catch { /* ignoré */ } }
        toast(data?.error || 'Confirmation non reçue. Réessayez : votre panier ne sera pas commandé deux fois.', { ton: 'erreur' });
        return;
      }

      const commandes = data.orders as Order[];
      for (const c of commandes) sugubaStore.addOrderFromCloud(c);
      // Un SMS par code de livraison (un par fournisseur), pas un par article.
      const codesEnvoyes = new Set<string>();
      for (const c of commandes) {
        if (codesEnvoyes.has(c.deliveryOtp)) continue;
        codesEnvoyes.add(c.deliveryOtp);
        void fetch('/api/sms/send-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber: c.orderNumber }),
        }).catch(() => undefined);
      }
      try {
        sessionStorage.setItem('suguba_dernier_panier', JSON.stringify({ total: data.total, commandes }));
        sessionStorage.removeItem(CLE_TENTATIVE);
      } catch { /* ignoré */ }
      if (mode === 'domicile' && ville === 'Bamako') definirQuartierClient(quartier);
      viderPanier();
      router.push('/panier/confirmation');
    } catch {
      toast('Connexion perdue. Réessayez : votre panier ne sera pas commandé deux fois.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  if (!monte) {
    return (
      <div className="min-h-screen bg-slate-100"><Header />
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></main>
      </div>
    );
  }

  // Panier vide : rien à confirmer, donc aucune raison de cacher le menu du bas.
  if (articles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 pb-20 md:pb-0">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
          <EmptyState icone={ShoppingBag} titre="Votre panier est vide"
            texte="Ajoutez plusieurs articles depuis leur fiche, puis commandez tout en une fois."
            action={<Button href="/">Découvrir les produits</Button>} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <form id="formulaire-panier" onSubmit={valider} className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-40 md:pb-10 grid gap-5 md:grid-cols-[1fr_340px] md:items-start">
        <div className="space-y-4 min-w-0">
          {/* Le menu du bas est masqué pendant la commande : le retour doit
              rester visible et évident, en haut comme dans la barre du bas. */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={retour}
              className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 min-h-[40px] text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Continuer mes achats
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Mon panier</h1>
          </div>

          <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
            {articles.map((a) => {
              const ligne = devis?.lignes.find((l) => l.productId === a.productId);
              const indispo = indisponibles.includes(a.productId);
              return (
                <div key={a.productId} className="p-3 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {ligne?.image ? <img src={ligne.image} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" /> : <div className="w-16 h-16 rounded-2xl bg-slate-100 shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {ligne ? (
                      <Link href={`/p/${ligne.slug}`} className="block text-sm font-bold text-slate-900 line-clamp-2">{ligne.nom}</Link>
                    ) : indispo ? (
                      <p className="text-sm font-bold text-rose-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Article plus disponible</p>
                    ) : <Skeleton className="h-4 w-32" />}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                        <button type="button" onClick={() => changerQuantite(a.productId, a.quantity - 1)} aria-label="Diminuer la quantité" className="w-9 h-9 flex items-center justify-center text-slate-700">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-black tabular-nums">{a.quantity}</span>
                        <button type="button" onClick={() => changerQuantite(a.productId, a.quantity + 1)} disabled={a.quantity >= 50} aria-label="Augmenter la quantité" className="w-9 h-9 flex items-center justify-center text-slate-700 disabled:text-slate-300">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {ligne && <span className="text-sm font-black text-slate-900 tabular-nums">{fcfa(ligne.montantArticles)}</span>}
                        <button type="button" onClick={() => retirerDuPanier(a.productId)} aria-label="Retirer du panier" className="w-9 h-9 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card className="space-y-4">
            <p className="text-sm font-black text-slate-900">Vos coordonnées</p>
            <Field label="Nom et prénom" htmlFor="nom" erreur={voir(erreurs.nom)} requis>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" aria-invalid={Boolean(voir(erreurs.nom))} />
            </Field>
            <Field label="Téléphone (WhatsApp)" htmlFor="tel" erreur={voir(erreurs.tel)} aide="Suguba vous appelle pour confirmer." requis>
              <Input id="tel" type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" aria-invalid={Boolean(voir(erreurs.tel))} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <p className="text-sm font-black text-slate-900">Livraison</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de livraison">
              <button type="button" role="radio" aria-checked={mode === 'domicile'} onClick={() => setMode('domicile')} className={`rounded-2xl border p-3 text-left ${mode === 'domicile' ? ACTIF : INACTIF}`}>
                <Truck className="w-4 h-4 text-slate-700" />
                <span className="block text-xs font-black text-slate-900 mt-1">À domicile</span>
              </button>
              <button type="button" role="radio" aria-checked={mode === 'relais'} onClick={() => setMode('relais')} disabled={!reglages?.pointsRelais.length} className={`rounded-2xl border p-3 text-left disabled:opacity-50 ${mode === 'relais' ? ACTIF : INACTIF}`}>
                <Store className="w-4 h-4 text-slate-700" />
                <span className="block text-xs font-black text-slate-900 mt-1">Point relais</span>
              </button>
            </div>

            {mode === 'domicile' ? (
              <>
                <Field label="Ville" htmlFor="ville">
                  <ChoicePicker id="ville" valeur={ville} choix={villes} onChange={setVille} />
                </Field>
                <Field label="Quartier" htmlFor="quartier" erreur={voir(erreurs.quartier)} requis>
                  {ville === 'Bamako' ? (
                    <NeighborhoodPicker id="quartier" value={quartier} onChange={setQuartier} placeholder="Choisir mon quartier" invalide={Boolean(voir(erreurs.quartier))} />
                  ) : (
                    <Input id="quartier" value={quartier} onChange={(e) => setQuartier(e.target.value)} aria-invalid={Boolean(voir(erreurs.quartier))} />
                  )}
                </Field>
                <Field label="Repère" htmlFor="repere" erreur={voir(erreurs.repere)} aide="Ex. : près de la mosquée, portail bleu." requis>
                  <Input id="repere" value={repere} onChange={(e) => setRepere(e.target.value)} aria-invalid={Boolean(voir(erreurs.repere))} />
                </Field>
                <Field label="Instructions (facultatif)" htmlFor="instructions">
                  <Textarea id="instructions" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} />
                </Field>
              </>
            ) : (
              <div className="space-y-2" role="radiogroup" aria-label="Point relais">
                {reglages?.pointsRelais.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={relais?.id === p.id} onClick={() => setRelaisId(p.id)}
                    className={`w-full rounded-2xl border p-3 text-left flex items-start justify-between gap-3 ${relais?.id === p.id ? ACTIF : INACTIF}`}>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900">{p.nom}</span>
                      {p.horaires && <span className="block text-[11px] text-slate-500">{p.horaires}</span>}
                    </span>
                    <span className="text-xs font-black text-slate-900 shrink-0">{p.frais === 0 ? 'Gratuit' : fcfa(p.frais)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <Field label="Code promo (facultatif)" htmlFor="promo">
              <div className="flex gap-2">
                <Input id="promo" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
                <Button type="button" variant="ghost" onClick={() => setPromoSoumis(promo.trim())}>Appliquer</Button>
              </div>
            </Field>
            {promoSoumis && devis && (
              <p className={`text-xs font-bold ${devis.codePromoValide ? 'text-suguba-brand' : 'text-rose-600'}`}>
                {devis.codePromoValide ? `Code appliqué : -${fcfa(devis.remise)}` : 'Ce code n’est pas valable.'}
              </p>
            )}
          </Card>
          <Card className="md:hidden">
            <Recapitulatif devis={devis} enCours={devisEnCours} />
          </Card>
        </div>

        <aside className="hidden md:block">
          <Card className="space-y-3 sticky top-24">
            <Recapitulatif devis={devis} enCours={devisEnCours} />
            <Button type="submit" size="lg" fullWidth disabled={envoi || !devis || indisponibles.length > 0}>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmer la commande
            </Button>
            <p className="text-[11px] text-slate-500 text-center">Rien à payer maintenant · Payez à la livraison</p>
          </Card>
        </aside>
      </form>

      {/* Téléphone : total et validation toujours sous le pouce, dans une
          barre flottante décollée du bord (même style que le menu du bas
          qu'elle remplace) — collée tout en bas, elle passait sous la barre
          du navigateur et sous le geste d'accueil de l'iPhone. */}
      <div
        className="md:hidden fixed inset-x-3 z-40 bg-white border border-slate-200 rounded-3xl shadow-float px-3 py-2.5"
        style={{ bottom: MARGE_BAS_FLOTTANT }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={retour}
            aria-label="Retour"
            className="w-11 h-11 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">
              Total{devis && devis.livraisons > 1 ? ` · ${devis.livraisons} livraisons` : ''}
            </p>
            <p className="text-lg font-black text-slate-900 tabular-nums">
              {devis ? fcfa(devis.total) : '…'}{devisEnCours && <Loader2 className="inline w-3.5 h-3.5 ml-1 animate-spin text-slate-400" />}
            </p>
          </div>
          <Button type="submit" form="formulaire-panier" size="lg" disabled={envoi || !devis || indisponibles.length > 0}>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirmer
          </Button>
        </div>
      </div>
    </div>
  );
}

function Recapitulatif({ devis, enCours }: { devis: Devis | null; enCours: boolean }) {
  if (!devis) return <Skeleton className="h-28" />;
  return (
    <div className={`space-y-2 text-sm ${enCours ? 'opacity-60' : ''}`}>
      <p className="text-sm font-black text-slate-900">Récapitulatif</p>
      <div className="flex justify-between"><span className="text-slate-600">Articles</span><span className="font-bold tabular-nums">{fcfa(devis.articles)}</span></div>
      <div className="flex justify-between">
        <span className="text-slate-600">Livraison{devis.livraisons > 1 ? ` (${devis.livraisons} fournisseurs)` : ''}</span>
        <span className="font-bold tabular-nums">{devis.livraison === 0 ? 'Gratuite' : fcfa(devis.livraison)}</span>
      </div>
      {devis.remise > 0 && <div className="flex justify-between text-suguba-brand"><span>Remise</span><span className="font-bold tabular-nums">-{fcfa(devis.remise)}</span></div>}
      <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-black">Total</span><span className="font-black text-lg tabular-nums">{fcfa(devis.total)}</span></div>
      {devis.livraisons > 1 && (
        <p className="text-[11px] text-slate-500">Vos articles viennent de {devis.livraisons} fournisseurs : ils arrivent en {devis.livraisons} livraisons, chacune avec son code.</p>
      )}
    </div>
  );
}
