'use client';

import ReglagesDepot from '@/components/supplier/ReglagesDepot';

import React, { useEffect, useState } from 'react';
import { Store, Users, Save, Megaphone } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import CarteLien from '@/components/reseau/CarteLien';
import LogoUploader from '@/components/common/LogoUploader';
import GalerieEditeur from '@/components/reseau/GalerieEditeur';
import CouvertureEditeur from '@/components/reseau/CouvertureEditeur';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { Card, EmptyState, Skeleton, StatCard } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Page commerciale du fournisseur (§ 19 des écrans) : logo, couverture,
 * présentation, et surtout le bouton « Devenir revendeur » qui alimente le
 * réseau de distribution.
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
  recrute: boolean;
  galerie: string[];
}

export default function BoutiqueFournisseurPage() {
  const { toast } = useToast();
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [revendeurs, setRevendeurs] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  const [nom, setNom] = useState('');
  const [accroche, setAccroche] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [couverture, setCouverture] = useState<string | null>(null);
  const [quartier, setQuartier] = useState('');
  const [recrute, setRecrute] = useState(false);
  const [galerie, setGalerie] = useState<string[]>([]);
  const [maxGalerie, setMaxGalerie] = useState(10);
  const [historique, setHistorique] = useState<{ nom: string; logo: string | null; description: string | null } | null>(null);

  useEffect(() => { setOrigine(window.location.origin); }, []);

  useEffect(() => {
    let annule = false;
    fetch('/api/supplier/boutique')
      .then((r) => r.json())
      .then((data) => {
        if (annule || !data.boutique) return;
        if (!data.boutique) { toast('Changements enregistrés, mais la boutique n’a pas pu être rechargée. Actualisez la page.', { ton: 'info' }); return; }
      setBoutique(data.boutique);
      setRecrute(Boolean(data.boutique.recrute));
      setGalerie(data.boutique.galerie || []);
        setHistorique(data.identiteHistorique || null);
        setRevendeurs(data.revendeurs || 0);
        setNom(data.boutique.nom || '');
        setAccroche(data.boutique.accroche || '');
        setDescription(data.boutique.description || '');
        setLogo(data.boutique.logo || null);
        setCouverture(data.boutique.couverture || null);
        setQuartier(data.boutique.quartier || '');
        setRecrute(Boolean(data.boutique.recrute));
        setGalerie(data.boutique.galerie || []);
        if (data.maxGalerie) setMaxGalerie(data.maxGalerie);
      })
      .catch(() => { /* état vide géré ci-dessous */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const enregistrer = async (champsSupplementaires: Record<string, unknown> = {}) => {
    if (enregistrement) return;
    setEnregistrement(true);
    try {
      const reponse = await fetch('/api/supplier/boutique', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.keys(champsSupplementaires).length ? champsSupplementaires : { nom, accroche, description, logo, couverture, recrute, galerie, quartier: quartier || null }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      if (!data.boutique) { toast('Changements enregistrés, mais la boutique n’a pas pu être rechargée. Actualisez la page.', { ton: 'info' }); return; }
      setBoutique(data.boutique);
      setRecrute(Boolean(data.boutique.recrute));
      setGalerie(data.boutique.galerie || []);
      toast('Boutique mise à jour.', { ton: 'succes' });
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <PageReseau
      titre="Ma boutique"
      sousTitre="Votre page commerciale publique."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
    >
      {/* FOU-10 (lot 7 de l'audit UI/UX du 2026-10-02) : sommaire en pastilles, une seule
          action pleine par carte (« Enregistrer ») ; le recrutement est un réglage. */}
      <nav aria-label="Réglages de la boutique" className="flex flex-wrap gap-2 text-sm">
        {[['#identite', 'Identité publique'], ['#recrutement', 'Recrutement'], ['#depot', 'Dépôt privé']].map(([href, libelle]) => (
          <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 font-semibold text-suguba-profond hover:bg-suguba-sauge">{libelle}</a>
        ))}
      </nav>
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-48" /></div>
      ) : !boutique ? (
        <EmptyState
          icone={Store}
          titre="Boutique pas encore disponible"
          texte="La mise à jour du réseau n’est pas encore appliquée sur ce serveur. Vos produits restent en ligne normalement."
          action={<Button href="/supplier/inventory">Voir mes stocks</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Revendeurs" valeur={revendeurs} aide="Vendent vos produits" icone={Users} accent />
            <StatCard label="Abonnés" valeur={boutique.abonnes} aide="Suivent votre boutique" />
          </div>

          <CarteLien
            titre="Le lien de ma boutique"
            url={`${origine}/boutique/${boutique.slug}`}
            lienOuvrir={`/boutique/${boutique.slug}`}
            aide="À mettre sur vos affiches, vos cartes et vos publications."
            texteWhatsApp={`🏪 ${nom} sur Suguba\n\nNotre catalogue, livré à Bamako.\n👉 ${origine}/boutique/${boutique.slug}`}
          />

          <Card id="recrutement" className="space-y-3 scroll-mt-24">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Je recherche des revendeurs</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Votre boutique apparaît dans « Ces boutiques recherchent des revendeurs », vue par tout le réseau.
                </p>
              </div>
            </div>
            <Button
              variant={recrute ? 'ghost' : 'secondary'}
              fullWidth
              disabled={enregistrement}
              onClick={() => { const nouveau = !recrute; enregistrer({ recrute: nouveau }); }}
            >
              {recrute ? 'Je ne recrute plus' : 'Activer le recrutement'}
            </Button>
          </Card>

          <Card className="space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Galerie</p>
              <p className="text-xs text-slate-500 mt-0.5">Votre magasin, votre équipe, vos produits phares. Affichée en diaporama sur votre boutique.</p>
            </div>
            <GalerieEditeur images={galerie} max={maxGalerie} onChange={(nouvelles) => { enregistrer({ galerie: nouvelles }); }} />
          </Card>

          <Card id="identite" className="space-y-4 scroll-mt-24">
            <h2 className="text-lg font-bold text-slate-900">Mon identité publique</h2>
            <p className="text-sm text-slate-600">Le même nom, logo et présentation apparaissent sur votre boutique et vos anciens liens. Vos adresses ne changent pas.</p>
            {historique && (historique.nom !== nom || (historique.logo || null) !== logo || (historique.description || '') !== description) && <details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Reprendre mon ancienne présentation</summary><p className="mt-2">Ancien nom : {historique.nom}. Les coordonnées du dépôt restent privées.</p><Button variant="ghost" className="mt-2" onClick={() => { setNom(historique.nom); setLogo(historique.logo); setDescription(historique.description || ''); toast('Ancienne identité reprise dans le formulaire. Vérifiez-la puis enregistrez.', { ton: 'info' }); }}>Reprendre dans le formulaire</Button></details>}

            <CouvertureEditeur valeur={couverture} onChange={setCouverture} />

            <div className="flex items-center gap-4">
              <LogoUploader value={logo} onChange={setLogo} nomPourInitiale={nom} />
              <p className="text-xs text-slate-500">Votre logo, affiché en haut de votre page.</p>
            </div>

            <Field label="Nom affiché" htmlFor="nom-boutique" requis>
              <Input id="nom-boutique" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
            </Field>

            <Field label="Quartier de la boutique" htmlFor="quartier-boutique" aide="Quartier utilisé pour la découverte des boutiques. Les coordonnées exactes de votre dépôt restent privées ; Suguba organise les transactions et livraisons.">
              <NeighborhoodPicker id="quartier-boutique" value={quartier} onChange={(q) => setQuartier(q === 'Autre quartier' ? '' : q)} placeholder="Choisir le quartier" />
              {quartier && (
                <button type="button" onClick={() => setQuartier('')} className="mt-1 text-xs font-semibold text-slate-500 underline underline-offset-2 min-h-[32px]">
                  Ne plus afficher de quartier
                </button>
              )}
            </Field>

            <Field label="Accroche" htmlFor="accroche" aide="Une phrase courte sous le nom.">
              <Input id="accroche" value={accroche} onChange={(e) => setAccroche(e.target.value)} maxLength={90}
                placeholder="Grossiste électroménager — Dabanani" />
            </Field>

            <Field label="Présentation" htmlFor="presentation" aide="Votre activité, votre expérience, vos délais.">
              <Textarea id="presentation" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} />
            </Field>

            <Button onClick={() => enregistrer()} loading={enregistrement} fullWidth>
              <Save className="w-4 h-4" />Enregistrer mon identité
            </Button>
          </Card>
        </>
      )}
      <ReglagesDepot />
    </PageReseau>
  );
}
