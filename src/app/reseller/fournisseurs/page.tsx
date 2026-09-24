'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Factory, ShieldCheck, Bell, BellRing, Loader2, Search, Megaphone } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/** Fournisseurs (§ page 10) : onglets « Mes fournisseurs » et « Découvrir ». */

interface Fournisseur {
  id: string; nom: string; logo: string | null; lien: string | null;
  produits: number; nouveautes: number; abonnes: number;
  recrute: boolean; verifie: boolean; suit: boolean; vend: boolean;
}

export default function FournisseursPage() {
  const { toast } = useToast();
  const [liste, setListe] = useState<Fournisseur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<'miens' | 'decouvrir'>('miens');
  const [recherche, setRecherche] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reseller/fournisseurs')
      .then((r) => r.json())
      .then((d) => {
        const l: Fournisseur[] = d.fournisseurs || [];
        setListe(l);
        // Premier passage : rien dans « Mes fournisseurs », on ouvre Découvrir.
        if (!l.some((f) => f.suit || f.vend)) setOnglet('decouvrir');
      })
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return liste
      .filter((f) => (onglet === 'miens' ? f.suit || f.vend : true))
      .filter((f) => !q || f.nom.toLowerCase().includes(q));
  }, [liste, onglet, recherche]);

  const suivre = async (f: Fournisseur) => {
    setEnCours(f.id);
    try {
      const r = await fetch('/api/reseller/fournisseurs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fournisseurId: f.id }) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur' }); return; }
      setListe((l) => l.map((x) => (x.id === f.id ? { ...x, suit: Boolean(d.suit), abonnes: Number(d.abonnes) || x.abonnes } : x)));
    } catch {
      toast('Action impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally { setEnCours(null); }
  };

  return (
    <PageReseau titre="Fournisseurs" sousTitre="Ceux dont vous vendez les produits, et ceux à découvrir." retour={{ href: '/reseller', libelle: 'Espace revendeur' }}>
      <div className="flex gap-2" role="tablist">
        {([['miens', 'Mes fournisseurs'], ['decouvrir', 'Découvrir']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={onglet === v} onClick={() => setOnglet(v)}
            className={`flex-1 h-10 rounded-2xl text-xs font-bold ${onglet === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un fournisseur" className="pl-10" aria-label="Rechercher un fournisseur" />
      </div>

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : visibles.length === 0 ? (
        <EmptyState icone={Factory}
          titre={onglet === 'miens' ? 'Aucun fournisseur pour l’instant' : 'Aucun fournisseur trouvé'}
          texte={onglet === 'miens' ? 'Ajoutez des produits à votre boutique ou suivez un fournisseur pour le retrouver ici.' : 'Essayez un autre nom.'}
          action={onglet === 'miens' ? <Button onClick={() => setOnglet('decouvrir')}>Découvrir les fournisseurs</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {visibles.map((f) => (
            <Card key={f.id} className="space-y-3">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.logo ? <img src={f.logo} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0">{f.nom.charAt(0).toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                    {f.nom}
                    {f.verifie && <ShieldCheck className="w-4 h-4 text-suguba-brand-dark shrink-0" aria-label="Fournisseur vérifié" />}
                  </p>
                  <p className="text-xs text-slate-500">
                    {f.produits} produit{f.produits > 1 ? 's' : ''}
                    {f.nouveautes > 0 ? ` · ${f.nouveautes} nouveauté${f.nouveautes > 1 ? 's' : ''}` : ''}
                    {f.abonnes > 0 ? ` · ${f.abonnes} abonné${f.abonnes > 1 ? 's' : ''}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {f.recrute && <StatusPill ton="attente"><Megaphone className="w-3 h-3" />Recrute</StatusPill>}
                    {f.vend && <StatusPill ton="succes">Dans ma boutique</StatusPill>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {f.lien && <Button href={f.lien} variant="ghost" size="sm" fullWidth>Voir le catalogue</Button>}
                <Button size="sm" variant={f.suit ? 'ghost' : 'secondary'} fullWidth disabled={enCours === f.id} onClick={() => suivre(f)} aria-pressed={f.suit}>
                  {enCours === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : f.suit ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  {f.suit ? 'Suivi' : 'Suivre'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 px-1">
        Pour vendre les produits d’un fournisseur, ajoutez-les à votre boutique depuis le <Link href="/reseller/catalog" className="underline font-bold">catalogue</Link> (filtre « fournisseur »).
      </p>
    </PageReseau>
  );
}
