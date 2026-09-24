'use client';

import React, { useEffect, useState } from 'react';
import { Tag, Loader2, RotateCcw } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import ProductImage from '@/components/common/ProductImage';
import { useToast } from '@/components/ui/Toast';

/**
 * Mes prix — articles au prix de gros (2026-09-24).
 *
 * Le fournisseur donne son prix de gros ; le revendeur fixe ICI son prix de
 * vente, affiché dans sa boutique et sur ses liens partagés. Il peut encore le
 * changer au cas par cas dans « + Vente » après négociation avec son client.
 * Jamais sous le prix minimal, qui couvre le prix de gros et tous les frais.
 */

interface Article {
  id: string; nom: string; slug: string; image: string | null;
  prixGros: number; prixMinimal: number; prixConseille: number;
  monPrix: number | null; gain: number;
}

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

export default function MesPrixPage() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = React.useCallback(() => fetch('/api/reseller/prix', { cache: 'no-store' })
    .then((r) => r.json()).then((d) => setArticles(d.articles || []))
    .catch(() => toast('Connexion impossible.', { ton: 'erreur' }))
    .finally(() => setChargement(false)), [toast]);
  useEffect(() => { charger(); }, [charger]);

  return (
    <PageReseau titre="Mes prix" sousTitre="Articles au prix de gros : c’est vous qui fixez le prix." retour={{ href: '/reseller', libelle: 'Mon espace' }}>
      <Card className="bg-suguba-sauge border-transparent text-xs text-slate-700 space-y-1">
        <p><strong>Votre prix</strong> s’affiche dans votre boutique et sur les liens que vous partagez.</p>
        <p>Pour un client qui négocie, changez le prix au moment d’enregistrer la vente dans « + Vente ».</p>
      </Card>
      {chargement ? <Skeleton className="h-40" /> : articles.length === 0 ? (
        <EmptyState icone={Tag} titre="Aucun article au prix de gros pour le moment"
          texte="Quand un fournisseur mettra un article au prix de gros, vous pourrez fixer votre prix ici." />
      ) : (
        <div className="space-y-3">
          {articles.map((a) => <LigneArticle key={a.id} a={a} onChange={(maj) => setArticles((l) => l.map((x) => (x.id === a.id ? { ...x, ...maj } : x)))} />)}
        </div>
      )}
    </PageReseau>
  );
}

function LigneArticle({ a, onChange }: { a: Article; onChange: (maj: Partial<Article>) => void }) {
  const { toast } = useToast();
  const [saisie, setSaisie] = useState(String(a.monPrix ?? a.prixConseille));
  const [envoi, setEnvoi] = useState(false);
  const valeur = parseInt(saisie.replace(/\s/g, ''), 10) || 0;
  const tropBas = valeur > 0 && valeur < a.prixMinimal;
  const change = valeur !== (a.monPrix ?? a.prixConseille);

  const enregistrer = async (prix: number | null) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/reseller/prix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: a.id, prix }) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      onChange({ monPrix: d.monPrix, ...(typeof d.gain === 'number' ? { gain: d.gain } : {}) });
      if (prix === null) setSaisie(String(a.prixConseille));
      toast(prix === null ? 'Retour au prix conseillé.' : 'Votre prix est enregistré.', { ton: 'succes' });
    } catch { toast('Connexion impossible.', { ton: 'erreur' }); }
    finally { setEnvoi(false); }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
          <ProductImage src={a.image || ''} alt={a.nom} fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{a.nom}</p>
          <p className="text-xs text-slate-600">Prix de gros {enF(a.prixGros)} · minimum {enF(a.prixMinimal)}</p>
          <p className="text-xs text-slate-500">Conseillé {enF(a.prixConseille)}{a.monPrix ? ` · votre prix ${enF(a.monPrix)}` : ''}</p>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1 text-xs font-semibold text-slate-700">
          Votre prix de vente
          <input inputMode="numeric" value={saisie} onChange={(e) => setSaisie(e.target.value.replace(/[^\d\s]/g, ''))}
            aria-invalid={tropBas}
            className={`mt-1 w-full h-11 px-3 rounded-xl border text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-suguba-profond/30 ${tropBas ? 'border-rose-400' : 'border-slate-200'}`} />
        </label>
        <button type="button" disabled={envoi || !change || tropBas || !valeur} onClick={() => enregistrer(valeur)}
          className="min-h-[44px] px-4 rounded-full bg-suguba-profond text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />}Enregistrer
        </button>
        {a.monPrix !== null && (
          <button type="button" disabled={envoi} onClick={() => enregistrer(null)} aria-label="Revenir au prix conseillé"
            className="w-11 h-11 rounded-full border border-slate-200 text-slate-600 inline-flex items-center justify-center">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className={`text-xs ${tropBas ? 'text-rose-700 font-semibold' : 'text-slate-600'}`}>
        {tropBas ? `Trop bas : minimum ${enF(a.prixMinimal)}.` : <>À ce prix, vous gagnez environ <strong className="text-slate-900">{enF(a.gain)}</strong> par article{change ? ' (après enregistrement)' : ''}.</>}
      </p>
    </Card>
  );
}
