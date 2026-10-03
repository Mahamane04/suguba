'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUp, Heart, PackagePlus, RefreshCw, Store } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import BarreEnregistrement from '@/components/ui/BarreEnregistrement';
import LigneListe from '@/components/ui/LigneListe';
import ProductImage from '@/components/common/ProductImage';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import FeuilleArticle from '@/components/shop/proprietaire/FeuilleArticle';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import PartageBoutique, { versArticlesPartage } from '@/components/shop/proprietaire/PartageBoutique';
import BoutonAnnonce from '@/components/shop/proprietaire/BoutonAnnonce';
import FeuilleSelectionPro from '@/components/shop/proprietaire/FeuilleSelectionPro';
import ChargementPage from '@/components/common/ChargementPage';
import { formatF } from '@/lib/montant';
import {
  ARTICLES_MAX, COUPS_DE_COEUR_MAX, PASTILLE_ETAT, basculerCoupDeCoeur, memeRangement, mettreEnPremier, monterArticle,
  ordreDe, rangementDe, sansArticle, type ArticleBoutique, type Rangement,
} from '@/lib/boutique-ordre';
import { CATALOGUE_DEPUIS_BOUTIQUE, PAGE_MES_BOUTIQUES, PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

/**
 * Mes articles (lot 3 du chantier boutique, 2026-10-03).
 *
 * Demande du fondateur : des outils pour gérer sa boutique, dont « produits mis
 * en avant ». Avant : retirer un article obligeait à le retrouver dans tout le
 * catalogue, l'ordre de la vitrine était celui des ajouts, rien ne pouvait être
 * mis en avant, et le revendeur ne voyait nulle part ce que rapportait chaque
 * article de SA boutique.
 *
 * Ici, dans l'ordre de la vitrine : « Coups de cœur » (6 au plus, en tête de la
 * vitrine) puis « Autres articles ». Chaque ligne : prix affiché, « Vous gagnez
 * X F » (route privée), cœur et « Monter » (40 px, sans glisser-déposer, pensé
 * pour le pouce). Toucher une ligne ouvre « Cet article ».
 *
 * Rien n'est écrit avant « Enregistrer l'ordre » : une seule requête à la fois,
 * des UPDATE de position seulement (voir src/lib/boutique-ordre.ts). Si la
 * boutique a changé ailleurs (catalogue, autre onglet), le serveur refuse et la
 * page le dit : « Votre boutique a changé, rechargez ».
 *
 * Lot 4 (2026-10-03) : « Partager » ouvre « Partager ma boutique » (toute la
 * boutique, coups de cœur ou un rayon), avec les articles enregistrés de la page.
 *
 * Lot 5 (2026-10-03) : « Prévenir mes abonnés (N nouveautés) », sous les
 * compteurs, seulement quand des articles ont été ajoutés depuis la dernière
 * annonce et que la boutique a des abonnés (BoutonAnnonce lit lui-même la route
 * privée de l'annonce ; relu quand un article est retiré).
 *
 * Lot 7 (2026-10-03), boutiques Pro au même niveau : ?boutique=<id> ouvre la
 * même page pour une boutique SUPPLÉMENTAIRE (formule Pro). « Choisir les
 * articles » de « Mes boutiques » y mène. Même rangement, mêmes coups de cœur,
 * même gain par article ; la boutique visée est vérifiée par le serveur (celle
 * d'un autre compte : « Boutique introuvable »). Ce qui diffère :
 *  - « Ajouter des articles » ouvre une liste à cocher (le catalogue compose la
 *    boutique principale, qui porte les offres du revendeur) ;
 *  - le partage envoie l'adresse de la boutique, sans lien suivi ;
 *  - pas de « Prévenir mes abonnés » (annonce de la boutique principale) ;
 *  - retirer un article n'annonce pas la disparition d'une offre : une boutique
 *    Pro n'en porte pas.
 */

const VIDE: Rangement = { coups: [], autres: [] };

/** Boutique supplémentaire dont on gère les articles (renvoyée par la route privée). */
interface BoutiquePro { id: string; slug: string; nom: string; enseigne: boolean; statut: string }

export default function MesArticlesPage() {
  // useSearchParams exige une frontière Suspense pour le build de production.
  return <Suspense fallback={<ChargementPage libelle="Ouverture de vos articles…" />}><MesArticles /></Suspense>;
}

function MesArticles() {
  const { toast } = useToast();
  // null : la boutique principale. Sinon l'identifiant demandé — une simple demande,
  // la route vérifie qu'elle appartient à la session.
  const demandee = useSearchParams().get('boutique');
  // L'identifiant demandé est celui de SA boutique principale (adresse tapée à la
  // main) : la page se comporte alors exactement comme sans paramètre.
  const [principaleDemandee, setPrincipaleDemandee] = useState(false);
  const pro = demandee !== null && !principaleDemandee;
  const [boutiquePro, setBoutiquePro] = useState<BoutiquePro | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [choix, setChoix] = useState(false);
  const [articles, setArticles] = useState<ArticleBoutique[]>([]);
  const [enregistre, setEnregistre] = useState<Rangement>(VIDE);
  const [rangement, setRangement] = useState<Rangement>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [conflit, setConflit] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [partage, setPartage] = useState(false);

  // Dernière lecture lancée : Next.js garde la page et son état quand seule
  // l'adresse change (?boutique=) ; la réponse d'une boutique quittée est ignorée.
  const lecture = useRef(0);
  const charger = useCallback(async () => {
    const numero = ++lecture.current;
    setChargement(true);
    setErreurLecture(false);
    setIntrouvable(false);
    setBoutiquePro(null);
    try {
      const r = await fetch(`/api/reseller/boutique/articles${demandee !== null ? `?boutique=${encodeURIComponent(demandee)}` : ''}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (numero !== lecture.current) return;
      if (r.status === 404) { setIntrouvable(true); return; }
      const estPrincipale = demandee === null || d.principale === true;
      // Boutique Pro : sans son adresse ni son nom, la page ne saurait ni la montrer ni la partager.
      if (!r.ok || !Array.isArray(d.articles) || (!estPrincipale && !d.boutique?.slug)) { setErreurLecture(true); return; }
      const lus = rangementDe(d.articles);
      setPrincipaleDemandee(demandee !== null && estPrincipale);
      setBoutiquePro(estPrincipale ? null : d.boutique);
      setArticles(d.articles);
      setEnregistre(lus);
      setRangement(lus);
      setConflit(false);
      setErreurs([]);
      setMessage('');
    } catch {
      if (numero === lecture.current) setErreurLecture(true);
    } finally {
      if (numero === lecture.current) setChargement(false);
    }
  }, [demandee]);
  useEffect(() => { charger(); }, [charger]);

  // Boutique visée par les écritures : rien pour la principale (comme avant).
  const cible = pro ? { boutique: demandee } : {};

  const parId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const articlesPartage = useMemo(() => versArticlesPartage(articles), [articles]);
  // Boutique Pro : la feuille de partage reçoit la sienne (nom public, adresse).
  const boutiquePartage = useMemo(
    () => (boutiquePro ? { nom: boutiquePro.nom, enseigne: boutiquePro.enseigne, slug: boutiquePro.slug, statut: boutiquePro.statut } : undefined),
    [boutiquePro],
  );
  const modifie = !memeRangement(rangement, enregistre);
  const masques = articles.filter((a) => a.etat === 'retire' || a.etat === 'sans_gain').length;

  const changer = (suivant: Rangement) => { setRangement(suivant); setMessage(''); setErreurs([]); };
  const basculer = (id: string) => {
    const suivant = basculerCoupDeCoeur(rangement, id);
    if (!suivant) { toast(`${COUPS_DE_COEUR_MAX} coups de cœur au plus : retirez-en un d’abord.`, { ton: 'info' }); return; }
    changer(suivant);
  };

  const enregistrer = async () => {
    if (verrou.current) return; // une seule requête à la fois
    verrou.current = true;
    setEnvoi(true);
    setErreurs([]);
    setMessage('');
    const envoye = rangement;
    try {
      const r = await fetch('/api/reseller/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ordonner', ordre: ordreDe(envoye), coupsDeCoeur: envoye.coups, ...cible }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409) { setConflit(true); setErreurs([d.error || 'Votre boutique a changé, rechargez.']); return; }
      if (!r.ok) { setErreurs([d.error || 'Enregistrement impossible. Réessayez.']); return; }
      setEnregistre(envoye);
      setArticles((liste) => liste.map((a) => ({ ...a, coupDeCoeur: envoye.coups.includes(a.id) })));
      setMessage('Ordre enregistré : votre boutique est à jour.');
    } catch {
      setErreurs(['Connexion impossible. Vérifiez votre réseau, puis réessayez.']);
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  };

  /** Retrait confirmé dans la feuille : seul geste qui supprime la ligne. */
  const retirer = async (article: ArticleBoutique): Promise<boolean> => {
    try {
      const r = await fetch('/api/reseller/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: article.id, action: 'retirer', ...cible }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast(d.error || 'Retrait impossible. Réessayez.', { ton: 'erreur' });
        return false;
      }
      setArticles((liste) => liste.filter((a) => a.id !== article.id));
      setEnregistre((r0) => sansArticle(r0, article.id));
      setRangement((r0) => sansArticle(r0, article.id));
      toast(`« ${article.nom} » est retiré de votre boutique.`, { ton: 'succes' });
      return true;
    } catch {
      toast('Connexion impossible. Réessayez.', { ton: 'erreur' });
      return false;
    }
  };

  const articleOuvert = ouvert ? parId.get(ouvert) || null : null;
  const blocDe = (id: string) => (rangement.coups.includes(id) ? rangement.coups : rangement.autres);

  const ligne = (id: string, i: number) => {
    const a = parId.get(id);
    if (!a) return null;
    const coup = rangement.coups.includes(id);
    const pastille = PASTILLE_ETAT[a.etat];
    return (
      <li key={id} className="relative">
        <LigneListe
          visuel={(
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
              <ProductImage src={a.image || ''} alt="" fill sizes="48px" className="object-cover" compact />
            </div>
          )}
          titre={(
            // Toute la ligne ouvre « Cet article » (le bouton s'étend sur la ligne) ;
            // le cœur et « Monter » restent au-dessus.
            <button type="button" onClick={() => setOuvert(id)} aria-haspopup="dialog"
              className="block w-full truncate text-left after:content-[''] after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-suguba-profond">
              {a.nom}
            </button>
          )}
          meta={(
            <>
              {/* Relecture du lot 3 (2026-10-03) : à 390 px, « Plus en vente » laissait
                  ~45 px au prix, coupé en « 12 5… ». Le prix ne se coupe plus : il passe
                  sous la pastille quand la ligne est trop courte. */}
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                {pastille && <StatusPill ton={a.etat === 'epuise' ? 'attente' : 'neutre'}>{pastille}</StatusPill>}
                <span className="whitespace-nowrap tabular-nums">{a.prixVitrine != null ? formatF(a.prixVitrine) : '—'}</span>
              </span>
              <span className="block truncate font-semibold text-suguba-brand-dark">Vous gagnez {formatF(a.gain)}</span>
            </>
          )}
          action={(
            <div className="relative z-10 flex items-center gap-1">
              <button type="button" onClick={() => basculer(id)} aria-pressed={coup}
                aria-label={coup ? `Retirer ${a.nom} des coups de cœur` : `Mettre ${a.nom} en coup de cœur`}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${coup ? 'bg-suguba-menthe border-suguba-menthe text-suguba-brand-dark' : 'bg-white border-slate-200 text-slate-500 hover:bg-suguba-sauge'}`}>
                <Heart className="w-5 h-5" fill={coup ? 'currentColor' : 'none'} />
              </button>
              <button type="button" onClick={() => changer(monterArticle(rangement, id))} disabled={i === 0}
                aria-label={`Monter ${a.nom}`}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 bg-white text-suguba-profond hover:bg-suguba-sauge disabled:opacity-40 disabled:pointer-events-none">
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          )}
        />
      </li>
    );
  };

  const vide = !chargement && !erreurLecture && !introuvable && articles.length === 0;
  const vitrinePro = boutiquePro ? `/boutique/${encodeURIComponent(boutiquePro.slug)}` : null;

  // Boutique Pro : la liste à cocher. Un rangement pas encore enregistré serait
  // perdu à la relecture des articles : on le fait enregistrer d'abord.
  const ouvrirChoix = () => {
    if (modifie) { toast('Enregistrez d’abord l’ordre, ou annulez-le.', { ton: 'info' }); return; }
    setChoix(true);
  };

  return (
    <PageReseau
      titre="Mes articles"
      sousTitre={pro
        ? (boutiquePro ? `Boutique « ${boutiquePro.nom} » : son ordre et ses coups de cœur.` : 'Rangez cette boutique et choisissez ses coups de cœur.')
        : 'Rangez votre vitrine et choisissez vos coups de cœur.'}
      retour={pro
        ? (vitrinePro ? { href: vitrinePro, libelle: 'Ma boutique' } : { href: PAGE_MES_BOUTIQUES, libelle: 'Mes boutiques' })
        : { href: PORTE_MA_BOUTIQUE, libelle: 'Ma boutique' }}
      action={!vide && !erreurLecture && !introuvable && !chargement ? <BoutonAjouter petit onChoisir={pro ? ouvrirChoix : undefined} /> : undefined}
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>
      ) : introuvable ? (
        <EmptyState
          icone={Store}
          titre="Boutique introuvable"
          texte="Cette boutique n’existe pas, ou elle n’est pas à vous."
          action={<Button href={PAGE_MES_BOUTIQUES}>Mes boutiques</Button>}
        />
      ) : erreurLecture ? (
        <EmptyState erreur titre="Vos articles n’ont pas pu être lus" texte="Rien n’a changé dans votre boutique. Vérifiez votre réseau." onReessayer={charger} />
      ) : vide ? (
        <EmptyState
          icone={Store}
          titre={pro ? 'Aucun article dans cette boutique' : 'Aucun article dans votre boutique'}
          texte={pro
            ? 'Vos clients la voient vide. Choisissez les articles que vous voulez y vendre.'
            : 'Vos clients voient le catalogue Suguba en attendant vos articles. Choisissez ceux que vous voulez vendre.'}
          action={<BoutonAjouter onChoisir={pro ? ouvrirChoix : undefined} />}
        />
      ) : (
        <>
          <Card padding="px-4 py-3" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
            <span><strong className="text-slate-900 tabular-nums">{articles.length}/{ARTICLES_MAX}</strong> articles</span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-suguba-brand-dark" fill="currentColor" aria-hidden="true" />
              <strong className="text-slate-900 tabular-nums">{rangement.coups.length}/{COUPS_DE_COEUR_MAX}</strong> coups de cœur
            </span>
            <BoutonPartageWhatsApp type="button" size="sm" className="ml-auto" libelle="Partager"
              aria-label="Partager ma boutique" aria-haspopup="dialog" onClick={() => setPartage(true)} />
          </Card>

          {/* Lot 5 : rien ne s'affiche sans nouveauté à annoncer ni abonné. Boutique
              principale seulement : l'annonce part de ses articles, à ses abonnés. */}
          {!pro && <BoutonAnnonce rafraichir={articles.length} />}

          {masques > 0 && (
            <p role="status" className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950">
              <strong className="tabular-nums">{masques}</strong> article{masques > 1 ? 's' : ''} ne s’affiche{masques > 1 ? 'nt' : ''} plus dans votre boutique
              (plus en vente, ou sans gain pour le moment). {masques > 1 ? 'Touchez un article pour le retirer.' : 'Touchez-le pour le retirer.'}
            </p>
          )}

          {conflit && (
            <div role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-950">Votre boutique a changé ailleurs. Rechargez avant de ranger.</p>
              <Button type="button" variant="ghost" size="sm" onClick={charger} className="shrink-0"><RefreshCw className="w-4 h-4" />Recharger</Button>
            </div>
          )}

          <Card padding="px-4 pt-4 pb-1" className="space-y-1">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-suguba-brand-dark" fill="currentColor" aria-hidden="true" />Coups de cœur
              </h2>
              <p className="text-xs text-slate-600">En tête de votre boutique. {COUPS_DE_COEUR_MAX} au plus.</p>
            </div>
            {rangement.coups.length === 0 ? (
              <p className="py-3 text-sm text-slate-600">Touchez le cœur d’un article pour le mettre en avant.</p>
            ) : (
              <ul className="divide-y divide-slate-100">{rangement.coups.map((id, i) => ligne(id, i))}</ul>
            )}
          </Card>

          <Card padding="px-4 pt-4 pb-1" className="space-y-1">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Autres articles</h2>
              <p className="text-xs text-slate-600">Rangés par rayon dans votre boutique, dans cet ordre.</p>
            </div>
            {rangement.autres.length === 0 ? (
              <p className="py-3 text-sm text-slate-600">Tous vos articles sont des coups de cœur.</p>
            ) : (
              <ul className="divide-y divide-slate-100">{rangement.autres.map((id, i) => ligne(id, i))}</ul>
            )}
          </Card>

          <BarreEnregistrement
            modifie={modifie}
            envoi={envoi}
            onEnregistrer={enregistrer}
            onAnnuler={() => { setRangement(enregistre); setErreurs([]); }}
            libelle="Enregistrer l’ordre"
            erreurs={erreurs}
            message={message}
            bloque={conflit}
            barreDuBasPermanente
          />
        </>
      )}

      {/* Articles ENREGISTRÉS (ceux que montre la vitrine), pas le rangement en cours.
          Boutique Pro : la sienne (nom, adresse), partagée sans lien suivi. */}
      {(!pro || boutiquePartage) && (
        <PartageBoutique ouvert={partage} onFermer={() => setPartage(false)} articles={articlesPartage} boutique={boutiquePartage} suivi={!pro} />
      )}

      {boutiquePro && (
        <FeuilleSelectionPro
          ouvert={choix}
          onFermer={() => setChoix(false)}
          boutiqueId={boutiquePro.id}
          choisis={articles.map((a) => a.id)}
          onEnregistre={charger}
        />
      )}

      <FeuilleArticle
        article={articleOuvert}
        ouvert={Boolean(articleOuvert)}
        onFermer={() => setOuvert(null)}
        coupDeCoeur={Boolean(articleOuvert && rangement.coups.includes(articleOuvert.id))}
        premierDeSonBloc={Boolean(articleOuvert && blocDe(articleOuvert.id)[0] === articleOuvert.id)}
        coupsPleins={rangement.coups.length >= COUPS_DE_COEUR_MAX}
        onBasculerCoup={() => { if (articleOuvert) basculer(articleOuvert.id); }}
        onMettreEnPremier={() => { if (articleOuvert) changer(mettreEnPremier(rangement, articleOuvert.id)); }}
        onRetirer={() => (articleOuvert ? retirer(articleOuvert) : Promise.resolve(false))}
        pro={boutiquePro && vitrinePro ? { id: boutiquePro.id, vitrine: vitrinePro } : null}
      />
    </PageReseau>
  );
}

/**
 * « Ajouter des articles » : le catalogue pour la boutique principale ; pour une
 * boutique Pro (`onChoisir`), la liste à cocher, ouverte sur place.
 */
function BoutonAjouter({ petit = false, onChoisir }: { petit?: boolean; onChoisir?: () => void }) {
  const taille = petit ? 'sm' : undefined;
  return onChoisir ? (
    <Button type="button" size={taille} onClick={onChoisir} aria-haspopup="dialog"><PackagePlus className="w-4 h-4" />Ajouter des articles</Button>
  ) : (
    <Button href={CATALOGUE_DEPUIS_BOUTIQUE} size={taille}><PackagePlus className="w-4 h-4" />Ajouter des articles</Button>
  );
}
