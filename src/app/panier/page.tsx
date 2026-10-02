'use client';

import { rememberOrderAccess } from '@/lib/order-access-client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { changerQuantite, retirerDuPanier, usePanier, viderPanier } from '@/lib/panier';
import { sugubaStore, useSugubaStore, useQuartierClient, definirQuartierClient } from '@/lib/store';
import type { Order } from '@/types';
import { formatF } from '@/lib/montant';
import {
  BarreCommande, CodePromoCommande, CoordonneesCommande, EnteteCommande, GarantiesCommande,
  LivraisonCommande, RecalculEnCours, SectionCommande, TEXTE_PAIEMENT, type ReglagesLivraison,
} from '@/components/commande/FormulaireCommande';
import { avisCodePromo, erreursCommande, premierChampEnErreur, telephoneNormalise, type ModeReception } from '@/lib/formulaire-commande';

/**
 * Panier et validation (§ 29 et § 30 des écrans).
 *
 * Tous les montants viennent du serveur (/api/orders/cart-quote), recalculés
 * à chaque changement : le total affiché est celui qui sera facturé. Une
 * seule livraison par fournisseur ; si le panier mélange plusieurs
 * fournisseurs, le client le voit AVANT de valider (« 2 livraisons »).
 *
 * PUB-10 (audit UI/UX du 2026-10-02) : même formulaire que l'achat direct
 * (components/commande/FormulaireCommande) — étapes numérotées, mêmes libellés,
 * mêmes aides, erreur qui mène au champ fautif, code promo replié, barre du bas
 * masquée pendant la saisie. Corrigés au passage : un devis en erreur cassait la
 * page, le minimum de vente n'était pas tenu, le point relais était proposé pour
 * un article remis par son vendeur, et une demande interrompue n'était pas
 * proposée à la reprise. Un panier d'une seule commande mène au même écran
 * « Commande reçue » que l'achat direct.
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

const CLE_TENTATIVE = 'suguba_panier_tentative';
const fcfa = formatF;

function nouvelleCle(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type CorpsPanier = Record<string, unknown> & { customerName: string };

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
  const state = useSugubaStore();
  const quartierMemorise = useQuartierClient();

  const [devis, setDevis] = useState<Devis | null>(null);
  const [devisEnCours, setDevisEnCours] = useState(false);
  const [erreurDevis, setErreurDevis] = useState('');
  const [reglages, setReglages] = useState<ReglagesLivraison | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [mode, setMode] = useState<ModeReception>('home_delivery');
  const [relaisId, setRelaisId] = useState('');
  const [ville, setVille] = useState('Bamako');
  const [quartier, setQuartier] = useState('');
  // Position GPS exacte du client (2026-09-24), voir /p/[slug]/commander.
  const [positionClient, setPositionClient] = useState<{ lat: number; lng: number } | null>(null);
  const [repere, setRepere] = useState('');
  const [instructions, setInstructions] = useState('');
  const [promoSaisi, setPromoSaisi] = useState('');
  const [promoSoumis, setPromoSoumis] = useState('');
  const [tentative, setTentative] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [monte, setMonte] = useState(false);
  // Demande envoyée dont la réponse n'est pas arrivée (coupure) : reprenable sans doublon.
  const [enSuspens, setEnSuspens] = useState<{ cle: string; corps: CorpsPanier } | null>(null);
  const requete = useRef(0);

  useEffect(() => {
    setMonte(true);
    try {
      const precedente = JSON.parse(sessionStorage.getItem(CLE_TENTATIVE) || 'null');
      if (precedente?.cle && precedente?.corps) setEnSuspens(precedente);
    } catch { /* stockage illisible */ }
  }, []);
  useEffect(() => { if (quartierMemorise && !quartier) setQuartier(quartierMemorise); }, [quartierMemorise]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/settings/public').then((r) => (r.ok ? r.json() : null)).then((j) => j && setReglages(j)).catch(() => undefined);
  }, []);

  // Fiche de chaque article (minimum de vente, stock, qui le remet), si le catalogue est chargé.
  const produits = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products]);
  const minimum = (id: string) => Math.max(1, Number(produits.get(id)?.quantiteMin) || 1);
  const maximum = (id: string) => {
    const stock = produits.get(id)?.stockQuantity;
    return Math.max(minimum(id), Math.min(50, typeof stock === 'number' && stock > 0 ? stock : 50));
  };
  // Le minimum du vendeur est tenu dans le panier aussi (le serveur le refusait seulement à l'envoi).
  useEffect(() => {
    for (const a of articles) if (a.quantity < minimum(a.productId)) changerQuantite(a.productId, minimum(a.productId));
  }, [articles, produits]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un article remis par son vendeur ne peut pas passer par un point relais.
  const remiseVendeurDansPanier = articles.some((a) => {
    const m = produits.get(a.productId)?.modeRemise;
    return Boolean(m && m !== 'livreur');
  });
  useEffect(() => { if (remiseVendeurDansPanier) setMode('home_delivery'); }, [remiseVendeurDansPanier]);

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
          positionClient: mode === 'pickup_point' ? null : positionClient,
          pickupPointId: mode === 'pickup_point' ? relais?.id : undefined, promoCode: promoSoumis || undefined,
        }),
      })
        .then(async (r) => {
          const d = await r.json().catch(() => null);
          if (numero !== requete.current) return;
          // Un devis refusé (503, article retiré…) cassait la page : on le dit, sans total périmé.
          if (!r.ok || !d || !Array.isArray(d.lignes)) {
            setDevis(null);
            setErreurDevis(d?.error || 'Le total n’a pas pu être calculé. Vérifiez la connexion.');
            return;
          }
          setErreurDevis('');
          setDevis(d);
        })
        .catch(() => { if (numero === requete.current) setErreurDevis('Le total n’a pas pu être calculé. Vérifiez la connexion.'); })
        .finally(() => { if (numero === requete.current) setDevisEnCours(false); });
    }, 250);
    return () => clearTimeout(minuterie);
  }, [articles, ville, quartier, positionClient, mode, relais?.id, promoSoumis]);

  const erreurs = erreursCommande({ nom, telephone, mode, quartier, repere });
  const erreursVisibles = tentative ? erreurs : {};
  const indisponibles = devis?.indisponibles || [];
  const avisPromo = avisCodePromo({
    soumis: promoSoumis, reconnu: !devis || !promoSoumis ? null : devis.codePromoValide, remise: devis?.remise ?? 0, formater: fcfa,
  });

  const envoyer = async (corps: CorpsPanier, cle: string) => {
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/orders/cart', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': cle },
        body: JSON.stringify(corps),
      });
      const data = await reponse.json().catch(() => null);
      if (!reponse.ok || !data?.success || !Array.isArray(data.orders)) {
        if (data?.definitive) {
          try { sessionStorage.removeItem(CLE_TENTATIVE); } catch { /* ignoré */ }
          setEnSuspens(null);
        }
        toast(data?.error || 'Confirmation non reçue. Réessayez : votre panier ne sera pas commandé deux fois.', { ton: 'erreur' });
        return;
      }

      const commandes = data.orders as Order[];
      for (const c of commandes) { sugubaStore.addOrderFromCloud(c); rememberOrderAccess(c.orderNumber, cle); }
      try {
        sessionStorage.setItem('suguba_dernier_panier', JSON.stringify({ total: data.total, commandes }));
        sessionStorage.removeItem(CLE_TENTATIVE);
      } catch { /* ignoré */ }
      setEnSuspens(null);
      viderPanier();
      // Une seule commande : le même écran « Commande reçue » que l'achat direct.
      router.push(commandes.length === 1 ? `/order-success/${commandes[0].orderNumber}` : '/panier/confirmation');
    } catch {
      toast('Connexion perdue. Réessayez : votre panier ne sera pas commandé deux fois.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const valider = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTentative(true);
    const premierChamp = premierChampEnErreur(erreurs);
    if (premierChamp) {
      const champ = document.getElementById(premierChamp);
      champ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      champ?.focus({ preventScroll: true });
      return;
    }
    if (indisponibles.length > 0) {
      toast('Retirez d’abord les articles indisponibles.', { ton: 'erreur' });
      return;
    }
    if (!devis) {
      toast(erreurDevis || 'Le total est en cours de calcul, réessayez dans un instant.', { ton: 'info' });
      return;
    }

    const retrait = mode === 'pickup_point' ? relais : undefined;
    const corps: CorpsPanier = {
      lignes: articles,
      customerName: nom.trim(), customerPhone: telephoneNormalise(telephone),
      city: retrait ? 'Bamako' : ville,
      neighborhood: retrait ? 'Point Relais Partenaire' : quartier,
      landmark: retrait ? retrait.nom || 'Point relais' : repere.trim(),
      deliveryNotes: retrait ? `Retrait en Point Relais : ${retrait.nom}` : instructions.trim() || undefined,
      pickupPointId: retrait?.id,
      promoCode: promoSoumis || undefined,
      positionClient: retrait ? undefined : positionClient || undefined,
    };

    // Même panier = même clé : une réponse perdue se rattrape sans doublon.
    let cle = nouvelleCle();
    try {
      const precedente = JSON.parse(sessionStorage.getItem(CLE_TENTATIVE) || 'null');
      if (precedente?.cle && JSON.stringify(precedente.corps) === JSON.stringify(corps)) cle = precedente.cle;
      sessionStorage.setItem(CLE_TENTATIVE, JSON.stringify({ cle, corps }));
    } catch { /* stockage bloqué : clé en mémoire */ }
    await envoyer(corps, cle);
  };

  if (!monte) {
    return (
      <div className="min-h-screen bg-slate-50"><Header />
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></main>
      </div>
    );
  }

  // Panier vide : rien à confirmer, donc aucune raison de cacher le menu du bas.
  if (articles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-4">
          {enSuspens && <ReprisePanier corps={enSuspens.corps} envoi={envoi} onReprendre={() => envoyer(enSuspens.corps, enSuspens.cle)} />}
          <EmptyState icone={ShoppingBag} titre="Votre panier est vide"
            texte="Ajoutez plusieurs articles depuis leur fiche, puis commandez tout en une fois."
            action={<Button href="/">Découvrir les produits</Button>} />
        </main>
        <BottomNav />
      </div>
    );
  }

  const libelleTotal = `Total à la livraison${devis && devis.livraisons > 1 ? ` · ${devis.livraisons} livraisons` : ''}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <EnteteCommande titre="Mon panier" onRetour={retour} libelleRetour="Continuer mes achats" />

      <form id="formulaire-panier" onSubmit={valider} noValidate
        className="max-w-5xl mx-auto px-4 py-4 md:py-8 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] gap-4 md:gap-6 items-start pb-36 md:pb-10">
        <div className="space-y-4 min-w-0">
          {enSuspens && <ReprisePanier corps={enSuspens.corps} envoi={envoi} onReprendre={() => envoyer(enSuspens.corps, enSuspens.cle)} />}

          <SectionCommande numero={1} titre={articles.length > 1 ? `Vos articles (${articles.length})` : 'Votre article'} complete={indisponibles.length === 0}>
            <ul className="divide-y divide-slate-100 -my-1">
              {articles.map((a) => {
                const ligne = devis?.lignes.find((l) => l.productId === a.productId);
                const indispo = indisponibles.includes(a.productId);
                const mini = minimum(a.productId);
                const maxi = maximum(a.productId);
                return (
                  <li key={a.productId} className="py-3 flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {ligne?.image ? <img src={ligne.image} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" /> : <div className="w-16 h-16 rounded-2xl bg-slate-100 shrink-0" />}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {ligne ? (
                        <Link href={`/p/${ligne.slug}`} className="block text-sm font-bold text-slate-900 line-clamp-2">{ligne.nom}</Link>
                      ) : indispo ? (
                        <p className="text-sm font-bold text-rose-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Article plus disponible</p>
                      ) : <Skeleton className="h-4 w-32" />}
                      {mini > 1 && <p className="text-xs text-slate-600">Minimum : {mini}</p>}
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                          <button type="button" onClick={() => changerQuantite(a.productId, Math.max(mini, a.quantity - 1))} disabled={a.quantity <= mini}
                            aria-label="Diminuer la quantité" className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">{a.quantity}</span>
                          <button type="button" onClick={() => changerQuantite(a.productId, Math.min(maxi, a.quantity + 1))} disabled={a.quantity >= maxi}
                            aria-label="Augmenter la quantité" className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {ligne && <span className="text-sm font-bold text-slate-900 tabular-nums">{fcfa(ligne.montantArticles)}</span>}
                          <button type="button" onClick={() => retirerDuPanier(a.productId)} aria-label={`Retirer ${ligne?.nom || 'cet article'} du panier`}
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCommande>

          <SectionCommande numero={2} titre="Vos coordonnées" complete={!erreurs.nom && !erreurs.tel}>
            <CoordonneesCommande nom={nom} onNom={setNom} telephone={telephone} onTelephone={setTelephone} erreurs={erreursVisibles}
              onDestinataire={(c) => { setNom(c.nom); setTelephone(c.telephone); if (c.quartier) setQuartier(c.quartier); setRepere(c.repere || ''); }} />
          </SectionCommande>

          <SectionCommande numero={3} titre="Livraison" complete={mode === 'pickup_point' ? Boolean(relais) : !erreurs.quartier && !erreurs.repere}>
            <LivraisonCommande reglages={reglages} mode={mode} onMode={setMode}
              relaisImpossible={remiseVendeurDansPanier ? 'Un de vos articles est remis par son vendeur : la commande se reçoit à domicile.' : null}
              ville={ville} onVille={(v) => { setVille(v); setQuartier(''); setPositionClient(null); }}
              quartier={quartier} onQuartier={(q) => { setQuartier(q); definirQuartierClient(q); }} onPosition={setPositionClient}
              repere={repere} onRepere={setRepere} instructions={instructions} onInstructions={setInstructions}
              relaisChoisiId={relais?.id} onRelais={setRelaisId} erreurs={erreursVisibles} />
          </SectionCommande>

          <CodePromoCommande saisi={promoSaisi} onSaisi={setPromoSaisi} onAppliquer={() => setPromoSoumis(promoSaisi.trim())} avis={avisPromo} />
        </div>

        <aside className="md:sticky md:top-20 space-y-3">
          <Card padding="p-4 sm:p-5" className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Récapitulatif</h2>
            {devis ? <Recapitulatif devis={devis} enCours={devisEnCours} />
              : erreurDevis && !devisEnCours ? <p role="alert" className="text-sm font-semibold text-rose-700">{erreurDevis}</p>
              : <div className="space-y-2" aria-busy="true"><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-7" /></div>}
            <p className="text-xs text-slate-500">{TEXTE_PAIEMENT}</p>
            <Button type="submit" size="lg" fullWidth loading={envoi} disabled={!devis || indisponibles.length > 0} className="hidden md:inline-flex">
              Confirmer la commande
            </Button>
          </Card>
          <GarantiesCommande />
        </aside>
      </form>

      <BarreCommande formulaire="formulaire-panier" libelle={libelleTotal}
        total={devis ? fcfa(devis.total) : '…'} envoi={envoi} desactive={!devis || indisponibles.length > 0} />
    </div>
  );
}

function Recapitulatif({ devis, enCours }: { devis: Devis; enCours: boolean }) {
  return (
    <dl className={`space-y-2 text-sm ${enCours ? 'opacity-60' : ''}`}>
      <div className="flex justify-between gap-3"><dt className="text-slate-600">Articles</dt><dd className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{fcfa(devis.articles)}</dd></div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-600">Livraison{devis.livraisons > 1 ? ` (${devis.livraisons} fournisseurs)` : ''}</dt>
        <dd className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{devis.livraison === 0 ? 'Gratuite' : fcfa(devis.livraison)}</dd>
      </div>
      {devis.remise > 0 && <div className="flex justify-between gap-3 text-suguba-brand-dark"><dt className="font-semibold">Remise</dt><dd className="font-bold tabular-nums whitespace-nowrap">−{fcfa(devis.remise)}</dd></div>}
      <div className="flex justify-between items-baseline gap-3 pt-3 border-t border-slate-100">
        <dt className="font-bold text-slate-900">Total{enCours && <RecalculEnCours />}</dt>
        <dd className="text-xl font-bold text-slate-900 tabular-nums whitespace-nowrap">{fcfa(devis.total)}</dd>
      </div>
      {devis.livraisons > 1 && (
        <p className="text-xs text-slate-500">Vos articles viennent de {devis.livraisons} fournisseurs : ils arrivent en {devis.livraisons} livraisons, chacune avec son code.</p>
      )}
    </dl>
  );
}

/** Même bandeau que l'achat direct : une demande partie sans réponse se reprend sans doublon. */
function ReprisePanier({ corps, envoi, onReprendre }: { corps: CorpsPanier; envoi: boolean; onReprendre: () => void }) {
  return (
    <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900 space-y-2">
      <p>Une commande pour {corps.customerName} est conservée dans cet onglet. Reprenez-la pour retrouver sa confirmation sans créer de doublon.</p>
      <Button type="button" onClick={onReprendre} loading={envoi}>Reprendre ma commande</Button>
    </div>
  );
}
