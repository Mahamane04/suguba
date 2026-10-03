'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Heart, PackagePlus, RefreshCw, Store } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import BarreEnregistrement from '@/components/ui/BarreEnregistrement';
import LigneListe from '@/components/ui/LigneListe';
import ProductImage from '@/components/common/ProductImage';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import FeuilleArticle from '@/components/shop/proprietaire/FeuilleArticle';
import { formatF } from '@/lib/montant';
import {
  ARTICLES_MAX, COUPS_DE_COEUR_MAX, PASTILLE_ETAT, basculerCoupDeCoeur, memeRangement, mettreEnPremier, monterArticle,
  ordreDe, rangementDe, sansArticle, type ArticleBoutique, type Rangement,
} from '@/lib/boutique-ordre';
import { CATALOGUE_DEPUIS_BOUTIQUE, PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

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
 */

const VIDE: Rangement = { coups: [], autres: [] };

export default function MesArticlesPage() {
  const { toast } = useToast();
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

  const charger = useCallback(async () => {
    setChargement(true);
    setErreurLecture(false);
    try {
      const r = await fetch('/api/reseller/boutique/articles', { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(d.articles)) { setErreurLecture(true); return; }
      const lus = rangementDe(d.articles);
      setArticles(d.articles);
      setEnregistre(lus);
      setRangement(lus);
      setConflit(false);
      setErreurs([]);
      setMessage('');
    } catch {
      setErreurLecture(true);
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const parId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
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
        body: JSON.stringify({ action: 'ordonner', ordre: ordreDe(envoye), coupsDeCoeur: envoye.coups }),
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
        body: JSON.stringify({ productId: article.id, action: 'retirer' }),
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

  const vide = !chargement && !erreurLecture && articles.length === 0;

  return (
    <PageReseau
      titre="Mes articles"
      sousTitre="Rangez votre vitrine et choisissez vos coups de cœur."
      retour={{ href: PORTE_MA_BOUTIQUE, libelle: 'Ma boutique' }}
      action={!vide && !erreurLecture ? (
        <Button href={CATALOGUE_DEPUIS_BOUTIQUE} size="sm"><PackagePlus className="w-4 h-4" />Ajouter des articles</Button>
      ) : undefined}
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>
      ) : erreurLecture ? (
        <EmptyState erreur titre="Vos articles n’ont pas pu être lus" texte="Rien n’a changé dans votre boutique. Vérifiez votre réseau." onReessayer={charger} />
      ) : vide ? (
        <EmptyState
          icone={Store}
          titre="Aucun article dans votre boutique"
          texte="Vos clients voient le catalogue Suguba en attendant vos articles. Choisissez ceux que vous voulez vendre."
          action={<Button href={CATALOGUE_DEPUIS_BOUTIQUE}><PackagePlus className="w-4 h-4" />Ajouter des articles</Button>}
        />
      ) : (
        <>
          <Card padding="px-4 py-3" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
            <span><strong className="text-slate-900 tabular-nums">{articles.length}/{ARTICLES_MAX}</strong> articles</span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-suguba-brand-dark" fill="currentColor" aria-hidden="true" />
              <strong className="text-slate-900 tabular-nums">{rangement.coups.length}/{COUPS_DE_COEUR_MAX}</strong> coups de cœur
            </span>
          </Card>

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
      />
    </PageReseau>
  );
}
