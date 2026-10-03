'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

/* Les URL de boutique et l'aperçu Blob du canvas sont dynamiques et locaux. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Download, ImageIcon, Package, Palette, Search, Share2, Store } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { useCatalogueCharge, useSugubaStore } from '@/lib/store';
import { lienProduit, prechargerLienPartage, texteProduit, useCodeRevendeur } from '@/lib/partage';
import { genererAffiche, genererCarteBoutique, partagerAffiche, telechargerAffiche, type FormatAffiche, type IdentiteBoutique, type ThemeAffiche } from '@/lib/affiche';
import { formatF } from '@/lib/montant';
import { PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';
import { selectionPourCarte, type ArticleBoutique } from '@/lib/boutique-ordre';
import { MESSAGE_AFFICHE_MAX, refusMessageAffiche } from '@/lib/message-affiche';

// Lot 2 du chantier boutique (2026-10-03) : « Configurer » et « Compléter le logo
// et la couverture » ouvrent le panneau du logo SUR la vitrine (porte unique,
// jamais préchargée), au lieu du formulaire de réglages.
const EDITER_LOGO = `${PORTE_MA_BOUTIQUE}?editer=logo`;

// Lot 3 du chantier boutique (2026-10-03) :
//  - la carte « Ma boutique » montrait les 3 premiers articles du CATALOGUE, au
//    prix public, alors qu'elle promet « Logo, couverture et sélection ». Elle
//    prend maintenant les coups de cœur, puis la vraie sélection, aux prix
//    affichés dans la vitrine (route privée des articles, lue à la demande) ;
//  - le « Bandeau promo » devient « Message » et refuse « % » et les montants
//    (décision du fondateur) : l'affiche annonçait des remises que Suguba
//    n'applique pas.

type TypeVisuel = 'produit' | 'boutique';
interface Boutique extends IdentiteBoutique { id: string; description?: string | null }

const FORMATS: { valeur: FormatAffiche; libelle: string; aide: string }[] = [
  { valeur: 'story', libelle: 'Statut WhatsApp', aide: 'Vertical — WhatsApp, Instagram, TikTok' },
  { valeur: 'carre', libelle: 'Publication', aide: 'Carré — Facebook, Instagram, groupes' },
];
const THEMES: { valeur: ThemeAffiche; libelle: string; pastille: string }[] = [
  { valeur: 'vert', libelle: 'Suguba', pastille: 'bg-suguba-brand' },
  { valeur: 'clair', libelle: 'Clair', pastille: 'bg-white border border-slate-300' },
  { valeur: 'nuit', libelle: 'Nuit', pastille: 'bg-slate-900' },
];

export default function CreateurContenusPage() {
  const { toast } = useToast();
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const code = useCodeRevendeur();
  const [typeVisuel, setTypeVisuel] = useState<TypeVisuel>('produit');
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [boutiqueChargee, setBoutiqueChargee] = useState(false);
  // Boutique lue sans nom public (profil illisible) : ni carte ni identité sur les affiches.
  const [nomIndisponible, setNomIndisponible] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [produitId, setProduitId] = useState<string | null>(null);
  useEffect(() => { setProduitId(new URLSearchParams(window.location.search).get('produit')); }, []);
  const [format, setFormat] = useState<FormatAffiche>('story');
  const [theme, setTheme] = useState<ThemeAffiche>('vert');
  const [promo, setPromo] = useState('');
  const [avecQr, setAvecQr] = useState(true);
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [lienUtilise, setLienUtilise] = useState<string | null>(null);
  const [generation, setGeneration] = useState(false);
  const resultat = useRef<HTMLElement>(null);
  const verrouGeneration = useRef(false);
  const refusMessage = refusMessageAffiche(promo);
  // Articles de SA boutique (coups de cœur d'abord), lus une fois, seulement pour la carte boutique.
  const articlesBoutique = useRef<Promise<ArticleBoutique[]> | null>(null);
  const lireArticlesBoutique = () => (articlesBoutique.current ??= fetch('/api/reseller/boutique/articles', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.articles) ? d.articles as ArticleBoutique[] : []))
    .catch(() => []));
  useEffect(() => { if (typeVisuel === 'boutique') lireArticlesBoutique(); }, [typeVisuel]);

  useEffect(() => {
    if (!apercu || generation) return;
    const frame = requestAnimationFrame(() => {
      resultat.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      resultat.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [apercu, generation]);

  const produits = useMemo(() => state.products.filter((p) => p.status === 'approved' && p.resellerCommission > 0 && p.publicPrice > 0), [state.products]);
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (q ? produits.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : produits).slice(0, 24);
  }, [produits, recherche]);
  const produit = produits.find((p) => p.id === produitId) || null;

  useEffect(() => {
    let actif = true;
    fetch('/api/reseller/boutique', { credentials: 'include' })
      .then(async (r) => r.ok ? await r.json() as { boutique?: Boutique | null; vitrine?: { nom: string } | null } : null)
      // Nom que voient les clients (lot 2, 2026-10-03) : l'enseigne, ou « Awa D. ».
      // Une boutique créée au nom complet l'aurait peint sur la carte partagée.
      // Relecture du lot 2 : sans `vitrine` (profil illisible), plus de repli sur
      // le nom enregistré, qui peut être ce nom complet. La carte est alors
      // indisponible et les affiches de produit partent sans identité de boutique.
      .then((r) => {
        if (!actif) return;
        setBoutique(r?.boutique && r.vitrine?.nom ? { ...r.boutique, nom: r.vitrine.nom } : null);
        setNomIndisponible(Boolean(r?.boutique && !r.vitrine?.nom));
      })
      .catch(() => undefined)
      .finally(() => { if (actif) setBoutiqueChargee(true); });
    return () => { actif = false; };
  }, []);

  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);
  useEffect(() => {
    setFichier(null); setApercu(null); setLienUtilise(null);
  }, [typeVisuel, produitId, format, theme, promo, avecQr, boutique?.id]);

  const generer = async () => {
    if (verrouGeneration.current) return;
    if ((typeVisuel === 'produit' && (!produit || refusMessage)) || (typeVisuel === 'boutique' && !boutique)) return;
    verrouGeneration.current = true;
    setGeneration(true);
    try {
      let image: File;
      let lien: string;
      if (typeVisuel === 'boutique' && boutique) {
        lien = `${window.location.origin}/boutique/${boutique.slug}`;
        const selection = selectionPourCarte(await lireArticlesBoutique());
        // Sélection vide ou illisible : la vitrine montre alors le catalogue Suguba, la carte aussi.
        const offres = selection.length > 0 ? selection : produits.slice(0, 3).map((p) => ({ nom: p.name, prix: p.publicPrice, image: p.images[0] }));
        image = await genererCarteBoutique(boutique, offres, { format, lien, qr: avecQr });
      } else if (produit) {
        const partage = { nom: produit.name, prix: produit.publicPrice, slug: produit.slug, images: produit.images };
        const codeLien = code ? await prechargerLienPartage(produit.slug) : null;
        lien = codeLien ? `${window.location.origin}/go/${codeLien}` : lienProduit(produit.slug, code);
        image = await genererAffiche(partage, code, { format, theme, lien, qr: avecQr, promo: promo || null, boutique });
      } else return;
      setFichier(image); setLienUtilise(lien); setApercu(URL.createObjectURL(image));
    } catch (erreur) {
      toast((erreur as Error).message || 'Création impossible.', { ton: 'erreur' });
    } finally { verrouGeneration.current = false; setGeneration(false); }
  };

  const partager = async () => {
    if (!fichier) return;
    const texte = typeVisuel === 'boutique' && boutique
      ? `🛍️ Découvrez ${boutique.nom} sur Suguba${boutique.accroche ? `\n${boutique.accroche}` : ''}\n${lienUtilise || ''}`
      : produit ? texteProduit({ nom: produit.name, prix: produit.publicPrice, slug: produit.slug, images: produit.images }, lienUtilise || '') : '';
    if (await partagerAffiche(fichier, texte) === 'telecharge') toast('Image téléchargée. Publiez-la depuis votre galerie.', { ton: 'info' });
  };

  const peutGenerer = typeVisuel === 'boutique' ? Boolean(boutique) : Boolean(produit) && !refusMessage;

  return <PageReseau titre="Créer un visuel" sousTitre="Choisissez ce que vous voulez promouvoir. Suguba prépare le visuel avec votre boutique." retour={{ href: '/reseller', libelle: 'Espace revendeur' }}>
    <fieldset disabled={generation} className="min-w-0 space-y-5">
    <Card className="space-y-3">
      <div><p className="text-sm font-bold text-slate-900">1. Que voulez-vous partager ?</p><p className="text-xs text-slate-500 mt-1">Chaque choix crée un visuel différent.</p></div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de visuel">
        {([
          { valeur: 'produit' as const, titre: 'Un produit', aide: 'Photo, prix et lien de commande', icone: Package },
          { valeur: 'boutique' as const, titre: 'Ma boutique', aide: 'Logo, couverture et sélection', icone: Store },
        ]).map((option) => { const Icone = option.icone; const choisi = typeVisuel === option.valeur; return <button key={option.valeur} type="button" role="radio" aria-checked={choisi} onClick={() => setTypeVisuel(option.valeur)} className={`relative min-h-32 rounded-2xl border p-4 text-left ${choisi ? 'border-suguba-brand ring-2 ring-suguba-brand bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <Icone className={`w-7 h-7 mb-3 ${choisi ? 'text-suguba-brand-dark' : 'text-slate-500'}`} /><p className="text-sm font-bold text-slate-900">{option.titre}</p><p className="text-xs text-slate-500 mt-1 leading-snug">{option.aide}</p>{choisi && <Check className="absolute right-3 top-3 w-5 h-5 text-suguba-brand-dark" />}
        </button>; })}
      </div>
    </Card>

    {typeVisuel === 'produit' ? <Card className="space-y-3">
      <p className="text-sm font-bold text-slate-900">2. Choisissez le produit</p>
      <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /><Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un produit" className="pl-10" aria-label="Rechercher un produit" /></div>
      {!catalogueCharge ? <Skeleton className="h-40" /> : visibles.length === 0 ? <EmptyState icone={Palette} titre="Aucun produit" texte="Aucun produit du catalogue ne correspond." /> : <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto overscroll-contain">
        {visibles.map((p) => <button key={p.id} type="button" onClick={() => setProduitId(p.id)} aria-pressed={produitId === p.id} className={`relative rounded-2xl border overflow-hidden text-left bg-white ${produitId === p.id ? 'border-suguba-brand ring-2 ring-suguba-brand' : 'border-slate-200'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}{p.images[0] ? <img src={p.images[0]} alt="" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-slate-100" />}<p className="text-xs font-bold text-slate-800 px-2 pt-1 line-clamp-2 leading-tight">{p.name}</p><p className="text-xs font-bold text-suguba-brand-dark px-2 pb-1.5 tabular-nums">{formatF(p.publicPrice)}</p>{produitId === p.id && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-suguba-profond text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>}
        </button>)}
      </div>}
    </Card> : <Card className="space-y-3">
      <p className="text-sm font-bold text-slate-900">2. Votre identité de boutique</p>
      {!boutiqueChargee ? <Skeleton className="h-32" /> : boutique ? <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="h-24 bg-gradient-to-br from-emerald-700 to-emerald-950 bg-cover bg-center" style={boutique.couverture ? { backgroundImage: `url(${boutique.couverture})` } : undefined} />
        <div className="flex gap-3 px-4 pb-4 -mt-7 items-end"><div className="w-16 h-16 shrink-0 rounded-2xl border-4 border-white bg-white shadow-sm overflow-hidden flex items-center justify-center">{/* eslint-disable-next-line @next/next/no-img-element */}{boutique.logo ? <img src={boutique.logo} alt="" className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-suguba-brand-dark" />}</div><div className="min-w-0 pb-1"><p className="font-black text-slate-900 truncate">{boutique.nom}</p><p className="text-xs text-slate-500 truncate">{boutique.accroche || 'Votre boutique sur Suguba'}</p></div></div>
      </div> : nomIndisponible ? <EmptyState icone={Store} titre="Boutique indisponible" texte="Votre boutique n’a pas pu être lue. Réessayez dans un instant." /> : <EmptyState icone={Store} titre="Boutique à configurer" texte="Ajoutez un nom, un logo et une couverture avant de créer sa carte." action={<Link href={EDITER_LOGO} prefetch={false} className="font-bold text-suguba-brand-dark">Configurer ma boutique</Link>} />}
      {boutique && (!boutique.logo || !boutique.couverture) && <Link href={boutique.logo ? `${PORTE_MA_BOUTIQUE}?editer=couverture` : EDITER_LOGO} prefetch={false} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"><ImageIcon className="w-4 h-4" />Compléter le logo et la couverture</Link>}
    </Card>}

    <Card className="space-y-3"><p className="text-sm font-bold text-slate-900">3. Choisissez le format</p><div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
      {FORMATS.map((f) => <button key={f.valeur} type="button" role="radio" aria-checked={format === f.valeur} onClick={() => setFormat(f.valeur)} className={`rounded-2xl border p-3 text-left ${format === f.valeur ? 'border-suguba-brand ring-2 ring-suguba-brand bg-suguba-brand/5' : 'border-slate-200 bg-white'}`}><p className="text-xs font-bold text-slate-900">{f.libelle}</p><p className="text-xs text-slate-500 mt-0.5">{f.aide}</p></button>)}
    </div></Card>

    <Card className="space-y-3"><p className="text-sm font-bold text-slate-900">4. Finalisez le visuel</p>
      {typeVisuel === 'produit' && <><div className="flex gap-2" role="radiogroup" aria-label="Style">{THEMES.map((t) => <button key={t.valeur} type="button" role="radio" aria-checked={theme === t.valeur} onClick={() => setTheme(t.valeur)} className={`flex-1 h-12 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold ${theme === t.valeur ? 'border-suguba-brand ring-2 ring-suguba-brand' : 'border-slate-200 bg-white'}`}><span className={`w-4 h-4 rounded-full ${t.pastille}`} />{t.libelle}</button>)}</div><Field label="Message (facultatif)" htmlFor="promo" aide="Ex. : « Nouveau », « Stock limité ». Sans pourcentage ni prix : le vrai prix est déjà sur l’affiche." erreur={refusMessage || undefined}><Input id="promo" value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={MESSAGE_AFFICHE_MAX} /></Field></>}
      <label className="flex items-center gap-3 min-h-[44px]"><input type="checkbox" checked={avecQr} onChange={(e) => setAvecQr(e.target.checked)} className="w-5 h-5 accent-[#09b500]" /><span className="text-sm text-slate-800">Ajouter un QR code qui ouvre directement {typeVisuel === 'boutique' ? 'la boutique' : 'le produit'}</span></label>
    </Card>

    <Button onClick={generer} disabled={!peutGenerer || generation} fullWidth size="lg">{generation ? <SugubaLoader className="w-4 h-4" /> : <Palette className="w-4 h-4" />}{generation ? 'Création…' : peutGenerer ? `Créer ${typeVisuel === 'boutique' ? 'la carte de ma boutique' : "l’affiche du produit"}` : typeVisuel === 'boutique' ? 'Configurez d’abord votre boutique' : produit ? 'Corrigez d’abord le message' : 'Choisissez d’abord un produit'}</Button>
    </fieldset>
    {generation && <div role="status" className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-5"><SugubaLoader className="h-12 w-12" /><div><p className="font-bold text-suguba-profond">Suguba prépare votre visuel…</p><p className="mt-1 text-sm text-slate-500">Assemblage des photos, du logo et du QR code.</p></div></div>}
    {apercu && fichier && <section ref={resultat} tabIndex={-1} aria-label="Votre visuel est prêt" className="scroll-mt-24 rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-suguba-profond"><Card className="space-y-4"><div role="status" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-slate-900">Votre visuel est prêt</h2><p className="text-xs text-slate-500">Téléchargez-le ou partagez-le avec vos clients.</p></div></div><div className="grid grid-cols-2 gap-2"><Button variant="ghost" onClick={() => telechargerAffiche(fichier)}><Download className="w-4 h-4" />Télécharger</Button><Button onClick={partager}><Share2 className="w-4 h-4" />Partager</Button></div><Button variant="ghost" href={typeVisuel === 'produit' && produit ? `/reseller/calendrier?produit=${encodeURIComponent(produit.slug)}` : '/reseller/calendrier'}>Planifier une publication</Button><img src={apercu} alt="Aperçu du visuel créé" className={`mx-auto w-full rounded-2xl border border-slate-200 ${format === 'story' ? 'max-w-[360px]' : 'max-w-[520px]'}`} /></Card></section>}
  </PageReseau>;
}
