'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Heart, LayoutGrid, QrCode as IconeQr, Store } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import {
  RAYON_COUPS_DE_COEUR, adresseBoutique, articlesAAnnoncer, choixDePartage, texteBoutique, versArticlesPartage,
  type ArticlePartage, type ChoixPartage,
} from '@/lib/partage-boutique';

export { versArticlesPartage };

// Le QR (paquet qrcode) n'est chargé qu'au toucher de « QR ».
const QrCode = dynamic(() => import('@/components/common/QrCode'), { ssr: false });

/**
 * « Partager ma boutique » (lot 4 du chantier boutique, 2026-10-03) : la feuille
 * ouverte par le bandeau de la vitrine, la carte de l'accueil, « Mes articles »,
 * « Statistiques » et l'étape « Partager ma boutique » (Mes clients y mène par
 * ?partager=1).
 *
 *  - Gros boutons de choix : toute ma boutique, mes coups de cœur, puis chaque
 *    rayon avec son nombre d'articles ;
 *  - message prérempli : l'enseigne, 3 articles à leur vrai prix (formatF),
 *    « vous payez à la livraison », le lien ;
 *  - lien SUIVI /go/<code>, réutilisé pour un même canal (route privée
 *    /api/reseller/boutique/partage) et préparé dès qu'un choix est touché : au
 *    moment d'envoyer, il est déjà là. S'il n'est pas prêt ou si le suivi est
 *    indisponible, on partage l'adresse brute : jamais un partage retardé pour un
 *    compteur ;
 *  - actions : WhatsApp (principale), Copier, QR (lien de canal « qr »).
 *
 * Boutique et articles sont passés par l'écran qui l'ouvre (la vitrine les a déjà)
 * ou lus à l'ouverture. Rien de privé n'y figure : ni gain, ni prix de gros. Le
 * cache des liens vit avec la feuille (jamais gardé dans le navigateur : sur un
 * téléphone partagé, ce serait le lien d'un autre compte).
 */

export interface BoutiqueAPartager {
  /** Nom que voient les clients : l'enseigne, ou « Awa D. ». */
  nom: string;
  enseigne: boolean;
  slug: string;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée. */
  statut?: string;
}

type CanalBoutique = 'whatsapp' | 'qr';
type Lecture = 'chargement' | 'pret' | 'erreur';

const ICONES: Record<string, React.ElementType> = { tout: Store, [RAYON_COUPS_DE_COEUR]: Heart };

export default function PartageBoutique({
  ouvert,
  onFermer,
  boutique: boutiqueFournie,
  articles: articlesFournis,
  onLienPret,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Absente : lue à l'ouverture (/api/reseller/boutique?creer=non, sans rien créer). */
  boutique?: BoutiqueAPartager | null;
  /** Absents : lus à l'ouverture (/api/reseller/boutique/articles). */
  articles?: ArticlePartage[] | null;
  /** Un lien suivi de la boutique existe : l'étape « Partager ma boutique » est faite. */
  onLienPret?: () => void;
}) {
  const { toast } = useToast();
  const [boutiqueLue, setBoutiqueLue] = useState<BoutiqueAPartager | null>(null);
  const [lectureBoutique, setLectureBoutique] = useState<Lecture>('chargement');
  const [articlesLus, setArticlesLus] = useState<ArticlePartage[] | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Lien par choix et par canal : en cours, prêt, ou en échec (l'adresse brute est
  // alors utilisée, et seul un nouveau toucher relance : jamais de relance en boucle).
  const cache = useRef(new Map<string, 'en_cours' | 'pret' | 'echec'>());

  const boutique = boutiqueFournie ?? boutiqueLue;
  const articles = articlesFournis ?? articlesLus;
  const enLigne = Boolean(boutique) && (boutique?.statut ?? 'active') === 'active';

  // Lecture à l'ouverture de ce qui n'a pas été fourni (une fois par feuille).
  useEffect(() => {
    if (!ouvert || boutiqueFournie || boutiqueLue) return;
    let annule = false;
    setLectureBoutique('chargement');
    fetch('/api/reseller/boutique?creer=non', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule) return;
        const b = d?.boutique;
        if (b?.slug && d?.vitrine?.nom) {
          setBoutiqueLue({ nom: d.vitrine.nom, enseigne: Boolean(d.vitrine.enseigne), slug: b.slug, statut: b.statut || 'active' });
          setLectureBoutique('pret');
        } else setLectureBoutique('erreur');
      })
      .catch(() => { if (!annule) setLectureBoutique('erreur'); });
    return () => { annule = true; };
  }, [ouvert, boutiqueFournie, boutiqueLue]);

  useEffect(() => {
    if (!ouvert || articlesFournis || articlesLus) return;
    let annule = false;
    fetch('/api/reseller/boutique/articles', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!annule) setArticlesLus(Array.isArray(d?.articles) ? versArticlesPartage(d.articles) : []); })
      // Articles illisibles : on partage quand même la boutique, sans citer d'article.
      .catch(() => { if (!annule) setArticlesLus([]); });
    return () => { annule = true; };
  }, [ouvert, articlesFournis, articlesLus]);

  const listeChoix: ChoixPartage[] = useMemo(() => choixDePartage(articles || []), [articles]);
  const choisi = listeChoix.find((c) => c.cle === choix) || listeChoix[0];
  // Adresse brute (repli) : origine lue seulement dans le navigateur (rendu serveur : feuille fermée).
  const brute = (cle: string | null) => (boutique && typeof window !== 'undefined' ? adresseBoutique(window.location.origin, boutique.slug, cle) : '');
  const slug = boutique?.slug ?? null;

  /**
   * Prépare le lien suivi d'un choix et d'un canal, une fois par feuille. `toucher`
   * (geste du revendeur) relance un essai qui avait échoué ; les préparations
   * automatiques (ouverture, changement de choix) ne relancent jamais.
   */
  const precharger = useCallback((canal: CanalBoutique, cle: string | null, toucher = false) => {
    if (!slug || !enLigne) return;
    const cleCache = `${canal}:${cle ?? ''}`;
    const deja = cache.current.get(cleCache);
    if (deja === 'en_cours' || deja === 'pret' || (deja === 'echec' && !toucher)) return;
    cache.current.set(cleCache, 'en_cours');
    const parametres = new URLSearchParams({ canal });
    if (cle) {
      parametres.set('rayon', cle);
      const libelle = listeChoix.find((c) => c.cle === cle)?.libelle;
      if (libelle && cle !== RAYON_COUPS_DE_COEUR) parametres.set('nom', libelle);
    }
    fetch(`/api/reseller/boutique/partage?${parametres.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        const url = typeof d?.url === 'string' && d.url ? d.url as string : null;
        // Échec : l'adresse brute (rien à attendre), un nouvel essai au prochain toucher.
        cache.current.set(cleCache, url ? 'pret' : 'echec');
        setUrls((u) => ({ ...u, [cleCache]: url || adresseBoutique(window.location.origin, slug, cle) }));
        if (d?.suivi) onLienPret?.();
      });
  }, [slug, enLigne, listeChoix, onLienPret]);

  // À l'ouverture et à chaque choix : le lien WhatsApp se prépare tout de suite.
  useEffect(() => {
    if (ouvert && boutique && enLigne) precharger('whatsapp', choisi?.cle ?? null);
  }, [ouvert, boutique, enLigne, choisi?.cle, precharger]);
  useEffect(() => {
    if (ouvert && qr && boutique && enLigne) precharger('qr', choisi?.cle ?? null);
  }, [ouvert, qr, boutique, enLigne, choisi?.cle, precharger]);

  const cle = choisi?.cle ?? null;
  const url = ouvert ? urls[`whatsapp:${cle ?? ''}`] || brute(cle) : '';
  const urlQr = urls[`qr:${cle ?? ''}`] || null;
  const texte = ouvert && boutique ? texteBoutique({ identite: boutique, choix: choisi, articles: articlesAAnnoncer(articles || [], cle), url }) : '';
  // « ma boutique », « mes coups de cœur » ou « le rayon « Pagnes » » (lecteurs d'écran, QR).
  const objet = !cle ? 'ma boutique' : cle === RAYON_COUPS_DE_COEUR ? 'mes coups de cœur' : `le rayon « ${choisi?.libelle} »`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié : collez-le dans vos discussions.', { ton: 'succes' });
    } catch {
      toast(`Copie impossible. Votre lien : ${url}`, { ton: 'info', duree: 8000 });
    }
  };

  const chargement = !boutique && lectureBoutique === 'chargement';
  const pret = Boolean(boutique) && enLigne && articles !== null;

  const actions = pret ? (
    <div className="space-y-2">
      <BoutonPartageWhatsApp
        fullWidth
        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(texte)}`}
        onPointerDown={() => precharger('whatsapp', cle, true)}
        aria-label={`Partager ${objet} sur WhatsApp`}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={copier}><Copy className="w-4 h-4" />Copier le lien</Button>
        <Button type="button" variant="ghost" onClick={() => { if (!qr) precharger('qr', cle, true); setQr((v) => !v); }} aria-pressed={qr} aria-controls="partage-boutique-qr">
          <IconeQr className="w-4 h-4" />QR
        </Button>
      </div>
    </div>
  ) : undefined;

  return (
    <Sheet ouvert={ouvert} onFermer={onFermer} titre="Partager ma boutique" sousTitre="Choisissez ce que vous envoyez à vos clients." pied={actions}>
      {chargement || (boutique && enLigne && articles === null) ? (
        <div className="space-y-2" role="status" aria-label="Préparation du partage">
          <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-28" />
        </div>
      ) : !boutique ? (
        <p role="alert" className="text-sm text-slate-700 bg-slate-100 rounded-2xl p-3">
          Votre boutique n’a pas pu être lue. Vérifiez votre réseau, puis réessayez.
        </p>
      ) : !enLigne ? (
        <p role="alert" className="text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          Votre boutique est masquée par Suguba : un lien partagé mènerait vos clients à une page introuvable.
        </p>
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Que partager ?" className="space-y-2">
            {listeChoix.map((c) => {
              const actif = c.cle === cle;
              const Icone = ICONES[c.cle ?? 'tout'] || LayoutGrid;
              return (
                <button
                  key={c.cle ?? 'tout'}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onPointerDown={() => precharger('whatsapp', c.cle, true)}
                  onClick={() => setChoix(c.cle)}
                  className={`w-full min-h-12 flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${actif ? 'border-suguba-profond bg-suguba-sauge ring-1 ring-suguba-profond' : 'border-slate-200 bg-white hover:bg-suguba-sauge'}`}
                >
                  <Icone className="w-5 h-5 shrink-0 text-suguba-brand-dark" aria-hidden="true" {...(c.cle === RAYON_COUPS_DE_COEUR ? { fill: 'currentColor' } : {})} />
                  <span className="flex-1 min-w-0 text-sm font-semibold text-slate-900 truncate">{c.libelle}</span>
                  {c.nombre > 0 && (
                    <span className="shrink-0 text-sm text-slate-600 tabular-nums">{c.nombre} article{c.nombre > 1 ? 's' : ''}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">Message envoyé</p>
            <p className="whitespace-pre-line break-words rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">{texte}</p>
          </div>

          {qr && (
            <div id="partage-boutique-qr" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 p-4">
              {urlQr ? <QrCode value={urlQr} size={180} /> : <Skeleton className="w-[180px] h-[180px]" />}
              <p className="text-sm text-slate-600 text-center">À scanner avec l’appareil photo : il ouvre {objet.replace(/^ma /, 'votre ').replace(/^mes /, 'vos ')}.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
