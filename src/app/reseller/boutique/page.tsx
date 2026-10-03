'use client';


import React, { useEffect, useMemo, useState } from 'react';
import { Store, Users, Eye, Megaphone, Rows3 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import CarteLien from '@/components/reseau/CarteLien';
import LogoUploader from '@/components/common/LogoUploader';
import CouvertureEditeur from '@/components/reseau/CouvertureEditeur';
import GalerieEditeur from '@/components/reseau/GalerieEditeur';
import Button from '@/components/ui/Button';
import BarreEnregistrement from '@/components/ui/BarreEnregistrement';
import { Field, Input, Textarea } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { PAGE_RAYONS, PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';
import {
  ANNONCE_JOURS_MAX, ANNONCE_TEXTE_MAX, annonceEnCours, finMaximale, jourDe, jourLisible, lireReglages,
  refusAnnonce, refusFinAnnonce, type AnnonceDatee,
} from '@/lib/boutique-reglages';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';

/**
 * Personnaliser ma boutique (§ 7 des écrans) — les réglages de la vitrine.
 *
 * Lot 1 du chantier boutique (2026-10-03) : « Ma boutique » ouvre désormais la
 * vitrine elle-même (/reseller/ma-boutique) ; cette page garde les réglages,
 * sous le titre « Personnaliser ma boutique », avec « Voir ma boutique » en
 * haut et l'état décidé par Suguba (une boutique masquée n'était signalée
 * nulle part).
 *
 * Lot 2 (2026-10-03) :
 *  - couverture, logo et photos de la boutique sont ENREGISTRÉS dès la fin de
 *    l'envoi (une image choisie puis abandonnée en quittant la page était perdue) ;
 *  - photos de la boutique (GalerieEditeur, 10 au plus, « mettre en premier »),
 *    comme côté fournisseur ;
 *  - « Ce que je vends » : les familles de l'annuaire /boutiques (stores.categories),
 *    choisies au démarrage et jusqu'ici impossibles à changer ;
 *  - les textes s'enregistrent par la barre collante (BarreEnregistrement), qui
 *    dit ce qui attend, au lieu d'un bouton en bas de page.
 *
 * Relecture du lot 2 (2026-10-03) :
 *  - un retrait de couverture, de logo ou de photo, enregistré aussitôt, est
 *    d'abord confirmé ;
 *  - la barre d'enregistrement reste au-dessus de la barre du bas, qui ne
 *    disparaît pas sur tablette et ordinateur pour un revendeur ;
 *  - sans nom public (profil illisible), jamais de repli sur le nom enregistré,
 *    qui peut être le nom complet du compte : le message WhatsApp n'a pas de nom.
 *
 * Lot 6 (2026-10-03), seulement quand la base le permet (`options.reglages`,
 * colonne stores.reglages) — avant le SQL, la page est exactement celle du lot 5 :
 *  - « Annonce sur ma boutique » : un message affiché en haut de la vitrine
 *    jusqu'à la date choisie (14 jours au plus), sans prix ni pourcentage (Suguba
 *    n'applique pas de remise). Enregistrée avec les textes, par la même barre ;
 *  - « Mes rayons » : lien vers la page où créer et ordonner ses rayons.
 *
 * Elle est créée automatiquement au premier accès : un revendeur ne doit pas
 * avoir à « créer une boutique » avant de pouvoir partager son premier
 * produit. Son adresse (/boutique/<slug>) n'est attribuée qu'une fois et n'est
 * jamais renommée — elle circule déjà dans des liens WhatsApp et des QR codes.
 */

interface Boutique {
  id: string;
  slug: string;
  nom: string;
  accroche: string | null;
  description: string | null;
  logo: string | null;
  couverture: string | null;
  abonnes: number;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée. */
  statut: string;
  quartier?: string | null;
  galerie?: string[];
  categories?: string[];
  /** Réglages de vitrine (lot 6) : relus par lireReglages, jamais utilisés bruts. */
  reglages?: unknown;
}

/** Nom que voient les clients (calculé par le serveur) : l'enseigne, ou « Awa D. ». */
interface Vitrine { nom: string; enseigne: boolean }

interface Textes {
  nom: string; accroche: string; description: string; quartier: string; categories: string[];
  /** Annonce datée (lot 6) : texte et dernier jour d'affichage (« AAAA-MM-JJ »). */
  annonce: string; annonceFin: string;
}

const annonceDe = (b: Boutique): AnnonceDatee | null => lireReglages(b.reglages).annonce;
const textesDe = (b: Boutique): Textes => ({
  nom: b.nom || '',
  accroche: b.accroche || '',
  description: b.description || '',
  quartier: b.quartier || '',
  categories: (b.categories || []).filter((c) => FAMILLES_CATEGORIES.some((f) => f.famille === c)),
  annonce: annonceDe(b)?.texte || '',
  annonceFin: annonceDe(b)?.fin || '',
});
/** Sans texte, la date ne compte pas : il n'y a pas d'annonce. */
const memeAnnonce = (a: Textes, b: Textes) =>
  a.annonce.trim() === b.annonce.trim() && (!a.annonce.trim() || a.annonceFin === b.annonceFin);
const memesTextes = (a: Textes, b: Textes) =>
  a.nom.trim() === b.nom.trim() && a.accroche.trim() === b.accroche.trim() && a.description.trim() === b.description.trim()
  && a.quartier === b.quartier && [...a.categories].sort().join('|') === [...b.categories].sort().join('|')
  && memeAnnonce(a, b);

export default function MaBoutiqueRevendeurPage() {
  const { toast } = useToast();
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiImage, setEnvoiImage] = useState(false);
  const [indisponible, setIndisponible] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');
  const [maxGalerie, setMaxGalerie] = useState(10);
  // Remonte les éditeurs d'image après un refus : l'aperçu revient à l'image enregistrée.
  const [essaiImage, setEssaiImage] = useState(0);

  // La base permet les rayons maison et l'annonce datée (colonne stores.reglages).
  const [optionReglages, setOptionReglages] = useState(false);

  const [textes, setTextes] = useState<Textes>({ nom: '', accroche: '', description: '', quartier: '', categories: [], annonce: '', annonceFin: '' });
  const [message, setMessage] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);

  const enregistres = useMemo(() => (boutique ? textesDe(boutique) : null), [boutique]);
  const modifie = Boolean(enregistres && !memesTextes(textes, enregistres));
  const champ = <K extends keyof Textes>(cle: K, valeur: Textes[K]) => { setTextes((t) => ({ ...t, [cle]: valeur })); setMessage(''); };

  useEffect(() => { setOrigine(window.location.origin); }, []);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/boutique')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        if (!data.boutique) { setIndisponible(true); return; }
        setBoutique(data.boutique);
        setVitrine(data.vitrine || null);
        setTextes(textesDe(data.boutique));
        if (data.maxGalerie) setMaxGalerie(data.maxGalerie);
        setOptionReglages(Boolean(data.options?.reglages));
      })
      .catch(() => { if (!annule) setIndisponible(true); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  // « Modifier » de l'annonce sur la vitrine mène à /reseller/boutique#annonce : la
  // carte n'existe qu'après la lecture, le navigateur ne peut pas y défiler seul.
  useEffect(() => {
    if (chargement || !optionReglages || window.location.hash !== '#annonce') return;
    document.getElementById('annonce')?.scrollIntoView({ block: 'start' });
  }, [chargement, optionReglages]);

  /** PATCH commun : renvoie la boutique enregistrée, ou null (message déjà affiché). */
  const patcher = async (champs: Record<string, unknown>): Promise<Boutique | null> => {
    try {
      const reponse = await fetch('/api/reseller/boutique', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(champs),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok || !data.boutique) {
        toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' });
        return null;
      }
      if (data.vitrine) setVitrine(data.vitrine);
      return data.boutique as Boutique;
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
      return null;
    }
  };

  /** Couverture, logo et photos : enregistrés dès la fin de l'envoi. Les textes en cours restent intacts. */
  const enregistrerImage = async (champs: { logo?: string | null; couverture?: string | null; galerie?: string[] }, confirmation: string) => {
    setEnvoiImage(true);
    const apres = await patcher(champs);
    setEnvoiImage(false);
    if (!apres) { setEssaiImage((n) => n + 1); return; }
    setBoutique((b) => (b ? { ...b, logo: apres.logo, couverture: apres.couverture, galerie: apres.galerie || [] } : apres));
    toast(confirmation, { ton: 'succes' });
  };

  // Annonce datée (lot 6). Les refus sont ceux du serveur (mêmes règles pures) :
  // dits sous le champ avant l'envoi, jamais découverts après.
  const annonceModifiee = Boolean(enregistres && !memeAnnonce(textes, enregistres));
  const refusTexteAnnonce = refusAnnonce(textes.annonce);
  const refusDateAnnonce = textes.annonce.trim() && annonceModifiee ? refusFinAnnonce(textes.annonceFin) : null;
  const annonceEnregistree = boutique ? annonceDe(boutique) : null;
  const ecrireAnnonce = (texte: string) => {
    // Première lettre : une date est proposée (7 jours), le revendeur n'a qu'à la changer.
    setTextes((t) => ({ ...t, annonce: texte, annonceFin: texte.trim() && !t.annonceFin ? jourDe(Date.now() + 7 * 24 * 3600 * 1000) : t.annonceFin }));
    setMessage('');
  };

  const enregistrerTextes = async () => {
    setEnregistrement(true);
    setErreurs([]);
    const apres = await patcher({
      nom: textes.nom,
      accroche: textes.accroche,
      description: textes.description,
      quartier: textes.quartier || null,
      categories: textes.categories,
      // L'annonce n'est envoyée que si elle a changé : une annonce terminée, laissée
      // telle quelle, ne doit pas faire refuser le reste (« date déjà passée »).
      ...(optionReglages && annonceModifiee
        ? { reglages: { annonce: textes.annonce.trim() ? { texte: textes.annonce, fin: textes.annonceFin } : null } }
        : {}),
    });
    setEnregistrement(false);
    if (!apres) { setErreurs(['Rien n’a été enregistré. Vérifiez les champs, puis réessayez.']); return; }
    setBoutique(apres);
    setTextes(textesDe(apres));
    setMessage('Boutique mise à jour.');
  };

  return (
    <PageReseau
      titre="Personnaliser ma boutique"
      sousTitre="Photos, nom, présentation et quartier de votre vitrine."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
      action={<Button href={PORTE_MA_BOUTIQUE} variant="ghost" size="sm"><Eye className="w-4 h-4" />Voir ma boutique</Button>}
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
      ) : indisponible || !boutique ? (
        <EmptyState
          icone={Store}
          titre="Boutique pas encore disponible"
          texte="La mise à jour du réseau n’est pas encore appliquée sur ce serveur. Votre lien revendeur continue de fonctionner normalement en attendant."
          action={<Button href="/reseller/catalog">Voir le catalogue</Button>}
        />
      ) : (
        <>
          {boutique.statut && boutique.statut !== 'active' && (
            <div role="status" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
              <StatusPill ton="attente">Masquée par Suguba</StatusPill>
              {/* Relecture du lot 1 (2026-10-03) : « vos clients ne voient pas votre
                  boutique » était faux, l'ancien lien /r/<code> montre encore la sélection. */}
              <p className="text-sm text-amber-950">L’adresse de votre boutique affiche « page introuvable » à vos clients. Écrivez au support pour savoir pourquoi.</p>
              <a href={whatsappHelper.getSupportChatLink()} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center min-h-10 text-sm font-semibold text-suguba-brand-dark underline underline-offset-2">
                Écrire au support Suguba
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Abonnés" valeur={boutique.abonnes} icone={Users} accent />
            {/* Adresse complète, telle que les clients la tapent (2026-10-03). */}
            <StatCard label="Adresse" valeur={<span className="text-sm break-all">{origine.replace(/^https?:\/\//, '')}/boutique/{boutique.slug}</span>} aide="Ne change jamais" />
          </div>

          {/* Même règle que l'accueil et la vitrine (relecture du lot 1, 2026-10-03) :
              pas de lien, de QR ni de partage d'une boutique masquée, le client
              tomberait sur une page introuvable. « Voir ma boutique » reste en haut. */}
          {(!boutique.statut || boutique.statut === 'active') && (
            <CarteLien
              titre="Le lien de ma boutique"
              url={`${origine}/boutique/${boutique.slug}`}
              lienOuvrir={`/boutique/${boutique.slug}`}
              aide="Vos articles, à votre nom. Chaque vente passée par ce lien vous revient."
              texteWhatsApp={`🛍️ Ma boutique Suguba${vitrine ? ` — ${vitrine.nom}` : ''}\n\nCommandez, vous payez à la livraison à Bamako.\n👉 ${origine}/boutique/${boutique.slug}`}
            />
          )}

          <Card className="space-y-4" aria-busy={envoiImage || undefined}>
            <div>
              <p className="text-sm font-bold text-slate-900">Couverture et logo</p>
              <p className="text-xs text-slate-600 mt-0.5">Enregistrés dès la fin de l’envoi.</p>
            </div>
            <CouvertureEditeur key={`couverture-${essaiImage}`} valeur={boutique.couverture} confirmerRetrait
              onChange={(url) => enregistrerImage({ couverture: url }, url ? 'Couverture enregistrée.' : 'Couverture retirée.')} />
            <div className="flex items-center gap-4">
              <LogoUploader key={`logo-${essaiImage}`} value={boutique.logo} forme="carre" nomPourInitiale={vitrine?.nom || 'Ma boutique'} confirmerRetrait
                onChange={(url) => enregistrerImage({ logo: url }, url ? 'Logo enregistré.' : 'Logo retiré.')} />
            </div>
            <p className="text-xs text-slate-500">
              Une photo de vous ou votre logo. C’est ce que vos clients verront en premier.
            </p>
          </Card>

          <Card className="space-y-4">
            <p className="text-sm font-bold text-slate-900">Nom et présentation</p>

            <Field label="Nom de la boutique" htmlFor="nom-boutique" requis
              aide={vitrine && !vitrine.enseigne
                ? `Tant que ce nom reprend le vôtre, vos clients lisent « La sélection de ${vitrine.nom} ». L’adresse ne change pas.`
                : 'Affiché en haut de votre boutique. L’adresse ne change pas.'}>
              <Input id="nom-boutique" value={textes.nom} onChange={(e) => champ('nom', e.target.value)} maxLength={60}
                placeholder="Ex. : Chez Awa — Mode et beauté" />
            </Field>

            <Field label="Mot d’accueil" htmlFor="accroche" aide="Une phrase courte, affichée sous le nom.">
              <Input id="accroche" value={textes.accroche} onChange={(e) => champ('accroche', e.target.value)} maxLength={90}
                placeholder="Électroménager et mode livrés à Bamako" />
            </Field>

            <Field label="Quartier de la boutique" htmlFor="quartier-boutique" aide="Facultatif. Les clients du quartier et des alentours trouveront votre boutique. Indiquez-le seulement si vous recevez des clients.">
              <NeighborhoodPicker id="quartier-boutique" value={textes.quartier} onChange={(q) => champ('quartier', q === 'Autre quartier' ? '' : q)} placeholder="Choisir le quartier" />
              {textes.quartier && (
                <button type="button" onClick={() => champ('quartier', '')} className="mt-1 text-xs font-semibold text-slate-500 underline underline-offset-2 min-h-[32px]">
                  Ne plus afficher de quartier
                </button>
              )}
            </Field>

            <Field label="Présentation" htmlFor="presentation" aide="Qui vous êtes, ce que vous vendez, comment vous livrez.">
              <Textarea id="presentation" rows={4} value={textes.description} onChange={(e) => champ('description', e.target.value)} maxLength={1200} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Ce que je vends</p>
              <p className="text-xs text-slate-600 mt-0.5">Les clients trouvent votre boutique par ces familles dans « Boutiques près de chez vous ».</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FAMILLES_CATEGORIES.map((f) => {
                const actif = textes.categories.includes(f.famille);
                return (
                  <button key={f.famille} type="button" aria-pressed={actif}
                    onClick={() => champ('categories', actif ? textes.categories.filter((c) => c !== f.famille) : [...textes.categories, f.famille])}
                    className={`px-3.5 min-h-[40px] rounded-full text-xs font-bold border ${actif ? 'bg-suguba-profond text-white border-suguba-profond' : 'bg-white text-slate-700 border-slate-200'}`}>
                    {f.famille}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Photos de la boutique</p>
              <p className="text-xs text-slate-600 mt-0.5">Votre étal, vos articles, votre quartier. Affichées en diaporama sur votre boutique, enregistrées tout de suite.</p>
            </div>
            <GalerieEditeur images={boutique.galerie || []} max={maxGalerie} confirmerRetrait
              onChange={(nouvelles) => enregistrerImage({ galerie: nouvelles }, 'Photos enregistrées.')} />
          </Card>

          {/* Lot 6 : seulement quand la base le permet. Avant le SQL, rien de ce bloc n'existe. */}
          {optionReglages && (
            <Card className="space-y-4">
              <div id="annonce" className="scroll-mt-24">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />Annonce sur ma boutique
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Un message affiché en haut de votre boutique jusqu’à la date choisie ({ANNONCE_JOURS_MAX} jours au plus). Sans prix ni pourcentage.
                </p>
              </div>
              {annonceEnregistree && !annonceModifiee && (
                annonceEnCours(annonceEnregistree)
                  ? <StatusPill ton="succes">Affichée jusqu’au {jourLisible(annonceEnregistree.fin)}</StatusPill>
                  : <StatusPill ton="neutre">Terminée le {jourLisible(annonceEnregistree.fin)} : plus affichée</StatusPill>
              )}
              <Field label="Message" htmlFor="annonce-texte" erreur={refusTexteAnnonce || undefined}
                aide="Ex. : Nouveaux pagnes arrivés cette semaine. Laissez vide pour ne rien afficher.">
                <Input id="annonce-texte" value={textes.annonce} onChange={(e) => ecrireAnnonce(e.target.value)} maxLength={ANNONCE_TEXTE_MAX}
                  placeholder="Nouveaux pagnes arrivés cette semaine" />
              </Field>
              {textes.annonce.trim() && (
                <Field label="Afficher jusqu’au" htmlFor="annonce-fin" requis erreur={refusDateAnnonce || undefined}
                  aide="Le lendemain de cette date, l’annonce disparaît toute seule.">
                  <Input id="annonce-fin" type="date" value={textes.annonceFin} min={jourDe()} max={finMaximale()}
                    onChange={(e) => champ('annonceFin', e.target.value)} />
                </Field>
              )}
              {textes.annonce.trim() && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setTextes((t) => ({ ...t, annonce: '', annonceFin: '' })); setMessage(''); }}>
                  Retirer l’annonce
                </Button>
              )}
            </Card>
          )}

          {optionReglages && (
            <Card className="space-y-2">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Rows3 className="w-4 h-4 text-suguba-brand-dark" aria-hidden="true" />Mes rayons
              </p>
              <p className="text-xs text-slate-600">
                Créez vos rayons (« Pagnes », « Pour la fête »…) : ils s’affichent en premier dans votre boutique, dans l’ordre que vous choisissez.
              </p>
              <Button href={PAGE_RAYONS} variant="ghost" fullWidth>Gérer mes rayons</Button>
            </Card>
          )}

          <Card className="space-y-2">
            <p className="text-sm font-bold text-slate-900">Les articles de ma boutique</p>
            <p className="text-xs text-slate-500">
              Vous choisissez vos articles dans le catalogue des fournisseurs. Pas de stock à acheter,
              pas d’avance : Suguba livre et encaisse, vous touchez votre commission.
            </p>
            <Button href="/reseller/catalog" variant="ghost" fullWidth>Choisir mes articles</Button>
          </Card>

          <BarreEnregistrement
            modifie={modifie}
            envoi={enregistrement}
            onEnregistrer={enregistrerTextes}
            onAnnuler={() => { if (enregistres) setTextes(enregistres); setErreurs([]); }}
            libelle="Enregistrer"
            erreurs={erreurs}
            message={message}
            bloque={textes.nom.trim().length < 2 || (optionReglages && annonceModifiee && Boolean(refusTexteAnnonce || refusDateAnnonce))}
            barreDuBasPermanente
          />
        </>
      )}
    </PageReseau>
  );
}
