'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, PackagePlus, Pencil, Plus, Rows3, Store } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import BarreEnregistrement from '@/components/ui/BarreEnregistrement';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import FeuilleRayon from '@/components/shop/proprietaire/FeuilleRayon';
import PartageBoutique from '@/components/shop/proprietaire/PartageBoutique';
import type { ArticleACocher } from '@/components/reseau/SelecteurArticles';
import { PASTILLE_ETAT, type ArticleBoutique } from '@/lib/boutique-ordre';
import {
  RAYONS_MAX, deplacerRayon, lireReglages, memesRayons, poserRayon, refusRayon, type RayonMaison,
} from '@/lib/boutique-reglages';
import { rayonsDeLaVitrine, versArticlesPartage } from '@/lib/partage-boutique';
import { CATALOGUE_DEPUIS_BOUTIQUE, PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

/**
 * Mes rayons (lot 6 du chantier boutique, 2026-10-03).
 *
 * Demande du fondateur : des outils pour gérer sa boutique, dont « catégories /
 * rayons ». Avant : les rayons de la vitrine étaient les catégories des
 * fournisseurs, dans l'ordre des articles. Ici le revendeur crée SES rayons
 * (« Pagnes », « Pour la fête »… 8 au plus, 24 caractères), y range ses articles
 * et décide de leur ordre (▲▼, 40 px, sans glisser-déposer). Ils s'affichent en
 * premier dans sa boutique ; les articles qu'il n'a pas rangés restent dans les
 * rayons automatiques, rappelés en dessous.
 *
 * Rien n'est écrit avant « Enregistrer mes rayons » : une seule requête (PATCH
 * /api/reseller/boutique {reglages: {rayons}}), validée par le serveur
 * (src/lib/boutique-reglages.ts). Ranger en rayons ne touche JAMAIS à la sélection
 * d'articles (reseller_shop_items, qui porte les offres du revendeur) : supprimer
 * un rayon ne retire aucun article.
 *
 * Avant le SQL (colonne stores.reglages absente) : aucune tuile ne mène ici, et
 * la page, ouverte par son adresse, dit simplement que les rayons arrivent.
 */

type Lecture = 'chargement' | 'erreur' | 'sans_boutique' | 'option_absente' | 'pret';

interface BoutiqueLue {
  slug: string;
  /** Nom que voient les clients (calculé par le serveur) ; null si le profil est illisible. */
  nom: string | null;
  enseigne: boolean;
  statut: string;
}

interface Brouillon {
  /** Indice du rayon modifié ; null : nouveau rayon. */
  indice: number | null;
  /** Remonte la feuille à chaque ouverture : nom et coches repartent de l'écran. */
  ouverture: number;
}

const BOUTON_ORDRE = 'w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 bg-white text-suguba-profond hover:bg-suguba-sauge disabled:opacity-40 disabled:pointer-events-none';

export default function MesRayonsPage() {
  const { confirmer } = useToast();
  const [lecture, setLecture] = useState<Lecture>('chargement');
  const [boutique, setBoutique] = useState<BoutiqueLue | null>(null);
  const [articles, setArticles] = useState<ArticleBoutique[]>([]);
  const [enregistres, setEnregistres] = useState<RayonMaison[]>([]);
  const [rayons, setRayons] = useState<RayonMaison[]>([]);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const ouvertures = useRef(0);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [partage, setPartage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLecture('chargement');
    try {
      const [reponseBoutique, reponseArticles] = await Promise.all([
        fetch('/api/reseller/boutique?creer=non', { cache: 'no-store' }),
        fetch('/api/reseller/boutique/articles', { cache: 'no-store' }),
      ]);
      const lue = await reponseBoutique.json().catch(() => ({}));
      if (!reponseBoutique.ok) { setLecture('erreur'); return; }
      if (!lue.boutique) { setLecture('sans_boutique'); return; }
      // Base pas encore mise à jour : l'option n'existe pas, ce n'est pas une panne.
      if (!lue.options?.reglages) { setLecture('option_absente'); return; }
      const lus = await reponseArticles.json().catch(() => ({}));
      if (!reponseArticles.ok || !Array.isArray(lus.articles)) { setLecture('erreur'); return; }
      const liste = lus.articles as ArticleBoutique[];
      // Un article retiré de la boutique depuis ne compte plus dans son rayon.
      const presents = new Set(liste.map((a) => a.id));
      const maison = lireReglages(lue.boutique.reglages).rayons.map((r) => ({ ...r, ids: r.ids.filter((id) => presents.has(id)) }));
      setBoutique({ slug: lue.boutique.slug, nom: lue.vitrine?.nom || null, enseigne: Boolean(lue.vitrine?.enseigne), statut: lue.boutique.statut || 'active' });
      setArticles(liste);
      setEnregistres(maison);
      setRayons(maison);
      setErreurs([]);
      setMessage('');
      setLecture('pret');
    } catch {
      setLecture('erreur');
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const modifie = !memesRayons(rayons, enregistres);
  const articlesPartage = useMemo(() => versArticlesPartage(articles), [articles]);
  // Ce que la vitrine montrera avec les rayons À L'ÉCRAN : rayons maison non vides
  // d'abord, puis les rayons automatiques (hors coups de cœur et articles masqués).
  const vitrine = useMemo(() => rayonsDeLaVitrine(articlesPartage, rayons), [articlesPartage, rayons]);
  const nombreDe = (cle: string) => vitrine.find((c) => c.cle === cle)?.nombre ?? 0;
  const automatiques = vitrine.filter((c) => !rayons.some((r) => r.cle === c.cle));
  const enLigne = boutique?.statut === 'active';
  // Un seul rayon serait la boutique entière ; et un rayon pas encore enregistré n'a pas d'adresse.
  const partageable = enLigne && !modifie && vitrine.length >= 2;

  const changer = (suivant: RayonMaison[]) => { setRayons(suivant); setMessage(''); setErreurs([]); };
  const ouvrir = (indice: number | null) => { ouvertures.current += 1; setBrouillon({ indice, ouverture: ouvertures.current }); };

  const rayonOuvert = brouillon && brouillon.indice !== null ? rayons[brouillon.indice] || null : null;
  const articlesACocher: ArticleACocher[] = useMemo(() => {
    if (!brouillon) return [];
    return articles.map((a) => {
      const ailleurs = rayons.find((r, i) => i !== brouillon.indice && r.ids.includes(a.id));
      return {
        id: a.id, nom: a.nom, image: a.image, prix: a.prixVitrine,
        note: ailleurs ? `Dans « ${ailleurs.nom} »` : a.coupDeCoeur ? 'Coup de cœur, affiché en tête' : PASTILLE_ETAT[a.etat],
      };
    });
  }, [articles, rayons, brouillon]);

  const supprimer = async () => {
    if (!brouillon || brouillon.indice === null || !rayonOuvert) return;
    const indice = brouillon.indice;
    const ok = await confirmer({
      titre: `Supprimer le rayon « ${rayonOuvert.nom} » ?`,
      message: 'Ses articles restent dans votre boutique, rangés par catégorie. Rien n’est retiré de la vente.',
      confirmer: 'Supprimer',
      annuler: 'Garder',
      danger: true,
    });
    if (!ok) return;
    changer(rayons.filter((_, i) => i !== indice));
    setBrouillon(null);
  };

  const enregistrer = async () => {
    if (verrou.current) return; // une seule requête à la fois
    verrou.current = true;
    setEnvoi(true);
    setErreurs([]);
    setMessage('');
    const envoye = rayons;
    try {
      const r = await fetch('/api/reseller/boutique', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reglages: { rayons: envoye.map(({ nom, ids }) => ({ nom, ids })) } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.boutique) { setErreurs([d.error || 'Enregistrement impossible. Réessayez.']); return; }
      // Ce que le serveur a gardé (articles hors de la boutique retirés) fait foi.
      const gardes = lireReglages(d.boutique.reglages).rayons;
      setEnregistres(gardes);
      setRayons((actuels) => (actuels === envoye ? gardes : actuels));
      setMessage('Rayons enregistrés : votre boutique est à jour.');
    } catch {
      setErreurs(['Connexion impossible. Vérifiez votre réseau, puis réessayez.']);
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  };

  const pret = lecture === 'pret';
  const sansArticle = pret && articles.length === 0;
  const plein = rayons.length >= RAYONS_MAX;

  return (
    <PageReseau
      titre="Mes rayons"
      sousTitre="Rangez vos articles par rayon, comme dans un magasin."
      retour={{ href: PORTE_MA_BOUTIQUE, libelle: 'Ma boutique' }}
      action={pret && !sansArticle && rayons.length > 0 && !plein ? (
        <Button type="button" size="sm" onClick={() => ouvrir(null)} aria-haspopup="dialog"><Plus className="w-4 h-4" />Créer un rayon</Button>
      ) : undefined}
    >
      {lecture === 'chargement' ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>
      ) : lecture === 'erreur' ? (
        <EmptyState erreur titre="Vos rayons n’ont pas pu être lus" texte="Rien n’a changé dans votre boutique. Vérifiez votre réseau." onReessayer={charger} />
      ) : lecture === 'sans_boutique' ? (
        <EmptyState icone={Store} titre="Votre boutique n’est pas encore ouverte"
          texte="Ouvrez-la d’abord : vous pourrez ensuite y ranger vos articles."
          action={<Button href={PORTE_MA_BOUTIQUE}>Ouvrir ma boutique</Button>} />
      ) : lecture === 'option_absente' ? (
        <EmptyState icone={Rows3} titre="Les rayons arrivent bientôt"
          texte="En attendant, vos articles sont rangés par catégorie dans votre boutique."
          action={<Button href={PORTE_MA_BOUTIQUE}>Voir ma boutique</Button>} />
      ) : sansArticle ? (
        <EmptyState icone={Store} titre="Aucun article à ranger"
          texte="Choisissez d’abord les articles de votre boutique : vous les rangerez ensuite par rayon."
          action={<Button href={CATALOGUE_DEPUIS_BOUTIQUE}><PackagePlus className="w-4 h-4" />Ajouter des articles</Button>} />
      ) : (
        <>
          <Card padding="px-4 py-3" className="space-y-1">
            <p className="text-sm text-slate-700"><strong className="text-slate-900 tabular-nums">{rayons.length}/{RAYONS_MAX}</strong> rayons</p>
            <p className="text-xs text-slate-600">Vos rayons s’affichent en premier dans votre boutique, dans cet ordre.</p>
          </Card>

          {rayons.length === 0 ? (
            <EmptyState icone={Rows3} titre="Aucun rayon pour l’instant"
              texte="Créez « Pagnes », « Pour la fête »… et choisissez leurs articles."
              action={<Button type="button" onClick={() => ouvrir(null)} aria-haspopup="dialog"><Plus className="w-4 h-4" />Créer un rayon</Button>} />
          ) : (
            <Card padding="px-4 pt-4 pb-1" className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">Mes rayons</h2>
              <ul className="divide-y divide-slate-100">
                {rayons.map((r, i) => {
                  const nombre = nombreDe(r.cle);
                  return (
                    <li key={r.cle} className="py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900 truncate">{r.nom}</p>
                          {nombre > 0 ? (
                            <p className="text-xs text-slate-600"><span className="tabular-nums">{nombre}</span> article{nombre > 1 ? 's' : ''} dans ma boutique</p>
                          ) : (
                            <>
                              <StatusPill ton="attente">Pas affiché</StatusPill>
                              <p className="text-xs text-slate-600">
                                {r.ids.length === 0 ? 'Aucun article dans ce rayon.' : 'Ses articles sont en coups de cœur, ou ne s’affichent plus.'}
                              </p>
                            </>
                          )}
                        </div>
                        <button type="button" className={BOUTON_ORDRE} disabled={i === 0} aria-label={`Monter le rayon ${r.nom}`}
                          onClick={() => changer(deplacerRayon(rayons, i, -1))}>
                          <ArrowUp className="w-5 h-5" />
                        </button>
                        <button type="button" className={BOUTON_ORDRE} disabled={i === rayons.length - 1} aria-label={`Descendre le rayon ${r.nom}`}
                          onClick={() => changer(deplacerRayon(rayons, i, 1))}>
                          <ArrowDown className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => ouvrir(i)} aria-haspopup="dialog" aria-label={`Modifier le rayon ${r.nom}`}>
                          <Pencil className="w-4 h-4" />Modifier
                        </Button>
                        {partageable && nombre > 0 && (
                          <BoutonPartageWhatsApp type="button" size="sm" libelle="Partager" aria-label={`Partager le rayon ${r.nom}`}
                            aria-haspopup="dialog" onClick={() => setPartage(r.cle)} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {plein && <p className="pb-3 text-xs text-slate-600">{RAYONS_MAX} rayons au plus : supprimez-en un pour en créer un autre.</p>}
            </Card>
          )}

          {automatiques.length > 0 && (
            <Card padding="px-4 pt-4 pb-1" className="space-y-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Rayons automatiques</h2>
                <p className="text-xs text-slate-600">Les articles que vous n’avez pas rangés, par catégorie. Affichés après vos rayons.</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {automatiques.map((c) => (
                  <li key={c.cle} className="py-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.libelle}</p>
                      <p className="text-xs text-slate-600"><span className="tabular-nums">{c.nombre}</span> article{c.nombre > 1 ? 's' : ''}</p>
                    </div>
                    {partageable && c.cle && (
                      <BoutonPartageWhatsApp type="button" size="sm" className="shrink-0" libelle="Partager" aria-label={`Partager le rayon ${c.libelle}`}
                        aria-haspopup="dialog" onClick={() => setPartage(c.cle)} />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <BarreEnregistrement
            modifie={modifie}
            envoi={envoi}
            onEnregistrer={enregistrer}
            onAnnuler={() => { setRayons(enregistres); setErreurs([]); }}
            libelle="Enregistrer mes rayons"
            erreurs={erreurs}
            message={message}
            note={modifie ? 'Vos clients voient ces rayons dès l’enregistrement. Aucun article n’est retiré de votre boutique.' : undefined}
            barreDuBasPermanente
          />
        </>
      )}

      {pret && brouillon && (
        <FeuilleRayon
          key={brouillon.ouverture}
          ouvert
          onFermer={() => setBrouillon(null)}
          creation={brouillon.indice === null}
          nomInitial={rayonOuvert?.nom || ''}
          idsInitial={rayonOuvert?.ids || []}
          articles={articlesACocher}
          refus={(nom) => refusRayon(rayons, brouillon.indice, nom)}
          onValider={(rayon) => { changer(poserRayon(rayons, brouillon.indice, rayon)); setBrouillon(null); }}
          onSupprimer={brouillon.indice === null ? undefined : supprimer}
        />
      )}

      {/* Rayons ENREGISTRÉS (ceux que montre la vitrine) : le bouton n'apparaît que sans modification en attente. */}
      {pret && boutique && enLigne && (
        <PartageBoutique
          ouvert={partage !== null}
          onFermer={() => setPartage(null)}
          boutique={boutique.nom ? { nom: boutique.nom, enseigne: boutique.enseigne, slug: boutique.slug, statut: boutique.statut, rayons: enregistres } : undefined}
          articles={articlesPartage}
          choixInitial={partage}
        />
      )}
    </PageReseau>
  );
}
