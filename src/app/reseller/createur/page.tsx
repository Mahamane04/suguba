'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Palette, Loader2, Download, Share2, Search, Check } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { prechargerLienPartage, texteProduit, useCodeRevendeur, lienProduit } from '@/lib/partage';
import { genererAffiche, partagerAffiche, telechargerAffiche, type FormatAffiche, type ThemeAffiche } from '@/lib/affiche';

/**
 * Créateur de contenus (§ 14 des écrans, § X du cahier des charges).
 *
 * Produit → modèle → format → générer. Volontairement PAS un éditeur
 * graphique : un revendeur peu à l'aise avec le design doit obtenir une image
 * propre en trois choix. L'affiche récupère toute seule la photo, le nom, le
 * prix, la promo, le lien tracké et son QR code.
 *
 * Chaque affiche porte son propre lien tracké : le revendeur voit ensuite dans
 * « Mes partages » combien de visites et de ventes elle a produites.
 */

const FORMATS: { valeur: FormatAffiche; libelle: string; aide: string }[] = [
  { valeur: 'story', libelle: 'Statut WhatsApp', aide: 'Vertical — statut, story Instagram, TikTok' },
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

  const [recherche, setRecherche] = useState('');
  const [produitId, setProduitId] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatAffiche>('story');
  const [theme, setTheme] = useState<ThemeAffiche>('vert');
  const [promo, setPromo] = useState('');
  const [avecQr, setAvecQr] = useState(true);

  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [lienUtilise, setLienUtilise] = useState<string | null>(null);
  const [generation, setGeneration] = useState(false);

  const produits = useMemo(
    () => state.products.filter((p) => p.status === 'approved' && p.resellerCommission > 0 && p.publicPrice > 0),
    [state.products],
  );
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (q ? produits.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : produits).slice(0, 24);
  }, [produits, recherche]);
  const produit = produits.find((p) => p.id === produitId) || null;

  // L'aperçu est une URL d'objet : la libérer quand elle est remplacée.
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  // Un réglage modifié invalide l'image déjà générée.
  useEffect(() => { setFichier(null); setApercu(null); }, [produitId, format, theme, promo, avecQr]);

  const generer = async () => {
    if (!produit) return;
    setGeneration(true);
    try {
      const aPartager = { nom: produit.name, prix: produit.publicPrice, slug: produit.slug, images: produit.images };
      // Lien tracké propre à cette affiche ; à défaut, l'URL produit avec le
      // code revendeur — la vente reste attribuée dans les deux cas.
      const codeLien = code ? await prechargerLienPartage(produit.slug) : null;
      const lien = codeLien ? `${window.location.origin}/go/${codeLien}` : lienProduit(produit.slug, code);
      const image = await genererAffiche(aPartager, code, { format, theme, lien, qr: avecQr, promo: promo || null });
      setFichier(image);
      setLienUtilise(lien);
      setApercu(URL.createObjectURL(image));
    } catch (erreur) {
      toast((erreur as Error).message || 'Création impossible.', { ton: 'erreur' });
    } finally {
      setGeneration(false);
    }
  };

  const partager = async () => {
    if (!fichier || !produit) return;
    const texte = texteProduit({ nom: produit.name, prix: produit.publicPrice, slug: produit.slug, images: produit.images }, lienUtilise || '');
    const resultat = await partagerAffiche(fichier, texte);
    if (resultat === 'telecharge') toast('Image téléchargée. Publiez-la depuis votre galerie.', { ton: 'info' });
  };

  return (
    <PageReseau
      titre="Créer un visuel"
      sousTitre="Une image prête à publier, en trois choix."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      <Card className="space-y-3">
        <p className="text-sm font-bold text-slate-900">1. Le produit</p>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un produit" className="pl-10" aria-label="Rechercher un produit" />
        </div>
        {!catalogueCharge ? (
          <Skeleton className="h-40" />
        ) : visibles.length === 0 ? (
          <EmptyState icone={Palette} titre="Aucun produit" texte="Aucun produit du catalogue ne correspond." />
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto overscroll-contain">
            {visibles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProduitId(p.id)}
                aria-pressed={produitId === p.id}
                className={`relative rounded-2xl border overflow-hidden text-left bg-white ${produitId === p.id ? 'border-suguba-brand ring-2 ring-suguba-brand' : 'border-slate-200'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.images[0] ? <img src={p.images[0]} alt="" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-slate-100" />}
                <p className="text-xs font-bold text-slate-800 px-2 pt-1 line-clamp-2 leading-tight">{p.name}</p>
                <p className="text-xs font-bold text-suguba-brand-dark px-2 pb-1.5 tabular-nums">{p.publicPrice.toLocaleString('fr-FR')} F</p>
                {produitId === p.id && (
                  <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-suguba-profond text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-bold text-slate-900">2. Le format</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
          {FORMATS.map((f) => (
            <button
              key={f.valeur}
              type="button"
              role="radio"
              aria-checked={format === f.valeur}
              onClick={() => setFormat(f.valeur)}
              className={`rounded-2xl border p-3 text-left ${format === f.valeur ? 'border-suguba-brand ring-2 ring-suguba-brand bg-suguba-brand/5' : 'border-slate-200 bg-white'}`}
            >
              <p className="text-xs font-bold text-slate-900">{f.libelle}</p>
              <p className="text-xs text-slate-500 mt-0.5">{f.aide}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-bold text-slate-900">3. Le style</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Style">
          {THEMES.map((t) => (
            <button
              key={t.valeur}
              type="button"
              role="radio"
              aria-checked={theme === t.valeur}
              onClick={() => setTheme(t.valeur)}
              className={`flex-1 h-12 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold ${theme === t.valeur ? 'border-suguba-brand ring-2 ring-suguba-brand' : 'border-slate-200 bg-white'}`}
            >
              <span className={`w-4 h-4 rounded-full ${t.pastille}`} />
              {t.libelle}
            </button>
          ))}
        </div>
        <Field label="Bandeau promo (facultatif)" htmlFor="promo" aide="Ex. : « -10 % ce week-end », « Nouveau », « Stock limité ».">
          <Input id="promo" value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={40} />
        </Field>
        <label className="flex items-center gap-3 min-h-[44px]">
          <input type="checkbox" checked={avecQr} onChange={(e) => setAvecQr(e.target.checked)} className="w-5 h-5 accent-[#09b500]" />
          <span className="text-sm text-slate-800">Ajouter le QR code (pour les affiches imprimées)</span>
        </label>
      </Card>

      <Button onClick={generer} disabled={!produit || generation} fullWidth size="lg">
        {generation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
        {generation ? 'Création…' : produit ? 'Créer le visuel' : 'Choisissez d’abord un produit'}
      </Button>

      {apercu && fichier && (
        <Card className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercu} alt="Aperçu du visuel" className={`mx-auto rounded-2xl border border-slate-200 ${format === 'story' ? 'max-h-[520px]' : 'max-h-[360px]'}`} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => telechargerAffiche(fichier)}>
              <Download className="w-4 h-4" />Télécharger
            </Button>
            <Button onClick={partager}>
              <Share2 className="w-4 h-4" />Partager
            </Button>
          </div>
        </Card>
      )}
    </PageReseau>
  );
}
