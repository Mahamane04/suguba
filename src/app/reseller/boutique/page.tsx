'use client';

import React, { useEffect, useState } from 'react';
import { Store, Loader2, Users, Save } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import CarteLien from '@/components/reseau/CarteLien';
import LogoUploader from '@/components/common/LogoUploader';
import CouvertureEditeur from '@/components/reseau/CouvertureEditeur';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatCard } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Ma boutique (§ 7 des écrans) — la vitrine personnelle du revendeur.
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
}

export default function MaBoutiqueRevendeurPage() {
  const { toast } = useToast();
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [indisponible, setIndisponible] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  const [nom, setNom] = useState('');
  const [accroche, setAccroche] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [couverture, setCouverture] = useState<string | null>(null);

  useEffect(() => { setOrigine(window.location.origin); }, []);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/boutique')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        if (!data.boutique) { setIndisponible(true); return; }
        setBoutique(data.boutique);
        setNom(data.boutique.nom || '');
        setAccroche(data.boutique.accroche || '');
        setDescription(data.boutique.description || '');
        setLogo(data.boutique.logo || null);
        setCouverture(data.boutique.couverture || null);
      })
      .catch(() => { if (!annule) setIndisponible(true); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const reponse = await fetch('/api/reseller/boutique', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, accroche, description, logo, couverture }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      setBoutique(data.boutique);
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
      sousTitre="Votre vitrine personnelle, à partager partout."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
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
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Abonnés" valeur={boutique.abonnes} icone={Users} accent />
            <StatCard label="Adresse" valeur={<span className="text-sm break-all">/{boutique.slug}</span>} aide="Ne change jamais" />
          </div>

          <CarteLien
            titre="Le lien de ma boutique"
            url={`${origine}/boutique/${boutique.slug}`}
            aide="Vos articles, à votre nom. Chaque vente passée par ce lien vous revient."
            texteWhatsApp={`🛍️ Ma boutique Suguba — ${nom}\n\nCommandez, vous payez à la livraison à Bamako.\n👉 ${origine}/boutique/${boutique.slug}`}
          />

          <Card className="space-y-4">
            <p className="text-sm font-black text-slate-900">Personnaliser</p>

            <CouvertureEditeur valeur={couverture} onChange={setCouverture} />

            <div className="flex items-center gap-4">
              <LogoUploader value={logo} onChange={setLogo} nomPourInitiale={nom} />
              <p className="text-[11px] text-slate-500">
                Une photo de vous ou votre logo. C’est ce que vos clients verront en premier.
              </p>
            </div>

            <Field label="Nom de la boutique" htmlFor="nom-boutique" requis>
              <Input id="nom-boutique" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
            </Field>

            <Field label="Accroche" htmlFor="accroche" aide="Une phrase courte, affichée sous le nom.">
              <Input id="accroche" value={accroche} onChange={(e) => setAccroche(e.target.value)} maxLength={90}
                placeholder="Électroménager et mode livrés à Bamako" />
            </Field>

            <Field label="Présentation" htmlFor="presentation" aide="Qui vous êtes, ce que vous vendez, comment vous livrez.">
              <Textarea id="presentation" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} />
            </Field>

            <Button onClick={enregistrer} disabled={enregistrement} fullWidth>
              {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </Card>

          <Card className="space-y-2">
            <p className="text-sm font-black text-slate-900">Les articles de ma boutique</p>
            <p className="text-xs text-slate-500">
              Vous choisissez vos articles dans le catalogue des fournisseurs. Pas de stock à acheter,
              pas d’avance : Suguba livre et encaisse, vous touchez votre commission.
            </p>
            <Button href="/reseller/catalog" variant="ghost" fullWidth>Choisir mes articles</Button>
          </Card>
        </>
      )}
    </PageReseau>
  );
}
