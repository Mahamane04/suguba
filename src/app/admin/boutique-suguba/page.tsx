'use client';

import React, { useEffect, useState } from 'react';
import { Store, Loader2, Save, PackagePlus } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import CarteLien from '@/components/reseau/CarteLien';
import CouvertureEditeur from '@/components/reseau/CouvertureEditeur';
import GalerieEditeur from '@/components/reseau/GalerieEditeur';
import LogoUploader from '@/components/common/LogoUploader';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatCard } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Boutique officielle Suguba (§ 24 : « Suguba doit pouvoir agir elle-même
 * comme vendeur »). Elle présente les produits créés par l'admin sans
 * fournisseur ; sa vitrine fonctionne comme toutes les autres (suivre,
 * partager, sponsoriser).
 */
export default function BoutiqueSugubaPage() {
  const { toast } = useToast();
  const [chargement, setChargement] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);
  const [produits, setProduits] = useState(0);
  const [abonnes, setAbonnes] = useState(0);
  const [maxGalerie, setMaxGalerie] = useState(10);
  const [nom, setNom] = useState('Suguba');
  const [accroche, setAccroche] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [couverture, setCouverture] = useState<string | null>(null);
  const [galerie, setGalerie] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  useEffect(() => {
    setOrigine(window.location.origin);
    fetch('/api/admin/boutique-suguba').then((r) => r.json()).then((d) => {
      if (d.error) { toast(d.error, { ton: 'erreur' }); return; }
      const b = d.boutique;
      setProduits(d.produits || 0); if (d.maxGalerie) setMaxGalerie(d.maxGalerie);
      if (!b) return;
      setSlug(b.slug); setAbonnes(b.abonnes); setNom(b.nom); setAccroche(b.accroche || '');
      setDescription(b.description || ''); setLogo(b.logo); setCouverture(b.couverture); setGalerie(b.galerie || []);
    }).catch(() => undefined).finally(() => setChargement(false));
  }, [toast]);

  const enregistrer = async (extra: Record<string, unknown> = {}) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/boutique-suguba', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, accroche, description, logo, couverture, galerie, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      toast('Boutique Suguba mise à jour.', { ton: 'succes' });
    } catch {
      toast('Enregistrement impossible.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <PageReseau titre="Boutique Suguba" sousTitre="Suguba vendeuse de ses propres produits." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      action={<Button size="sm" href="/admin/products/new"><PackagePlus className="w-4 h-4" />Ajouter un produit</Button>}>
      {chargement ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>
        : !slug ? <EmptyState icone={Store} titre="Boutique indisponible" texte="La mise à jour du réseau n’est pas encore appliquée sur la base." />
        : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Produits Suguba" valeur={produits} aide="Créés sans fournisseur" accent />
              <StatCard label="Abonnés" valeur={abonnes} />
            </div>
            <CarteLien titre="Lien de la boutique" url={`${origine}/boutique/${slug}`}
              texteWhatsApp={`🛍️ La boutique officielle Suguba\nLivré à Bamako, payez à la livraison.\n👉 ${origine}/boutique/${slug}`} />
            <Card className="space-y-4">
              <CouvertureEditeur valeur={couverture} onChange={setCouverture} />
              <div className="flex items-center gap-4">
                <LogoUploader value={logo} onChange={setLogo} nomPourInitiale={nom} />
                <p className="text-[11px] text-slate-500">Le logo officiel de Suguba.</p>
              </div>
              <Field label="Nom" htmlFor="nom" requis><Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} /></Field>
              <Field label="Accroche" htmlFor="accroche"><Input id="accroche" value={accroche} onChange={(e) => setAccroche(e.target.value)} maxLength={90} /></Field>
              <Field label="Présentation" htmlFor="description"><Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} /></Field>
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-700">Galerie</p>
                <GalerieEditeur images={galerie} max={maxGalerie} onChange={(g) => { setGalerie(g); enregistrer({ galerie: g }); }} />
              </div>
              <Button fullWidth onClick={() => enregistrer()} disabled={envoi}>
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Enregistrer
              </Button>
            </Card>
          </>
        )}
    </PageReseau>
  );
}
