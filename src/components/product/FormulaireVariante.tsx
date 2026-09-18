'use client';

import React, { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

/**
 * « Créer une variante » depuis l'inventaire : le fournisseur ne saisit que
 * ce qui change (libellé, son prix, son stock). Nom, photos et description
 * sont repris de l'original.
 */
export default function FormulaireVariante({
  produit,
  onCree,
}: {
  produit: { id: string; name: string; supplierPrice: number };
  onCree: () => void;
}) {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [libelleOriginal, setLibelleOriginal] = useState('');
  const [libelle, setLibelle] = useState('');
  const [prix, setPrix] = useState(String(produit.supplierPrice || ''));
  const [stock, setStock] = useState('1');
  const [envoi, setEnvoi] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 min-h-[32px]">
        <Layers className="w-3.5 h-3.5" />Créer une variante (taille, couleur…)
      </button>
    );
  }

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/variantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: produit.id, libelle, libelleOriginal, prixFournisseur: Number(prix), stock: Number(stock) }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Création impossible.', { ton: 'erreur' }); return; }
      toast(d.publication?.publie ? 'Variante créée et mise en vente.' : `Variante créée. ${d.publication?.raison || 'En attente de publication.'}`, { ton: 'succes' });
      setOuvert(false); setLibelle('');
      onCree();
    } catch {
      toast('Création impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <p className="text-xs font-black text-slate-900">Nouvelle variante de « {produit.name} »</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ce produit-ci est" htmlFor={`orig-${produit.id}`} aide="Ex. : 43 pouces">
          <Input id={`orig-${produit.id}`} value={libelleOriginal} onChange={(e) => setLibelleOriginal(e.target.value)} maxLength={40} />
        </Field>
        <Field label="La variante est" htmlFor={`lib-${produit.id}`} aide="Ex. : 55 pouces" requis>
          <Input id={`lib-${produit.id}`} value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Votre prix (F)" htmlFor={`prix-${produit.id}`} requis>
          <Input id={`prix-${produit.id}`} type="number" inputMode="numeric" min={1} value={prix} onChange={(e) => setPrix(e.target.value)} />
        </Field>
        <Field label="Stock" htmlFor={`stock-${produit.id}`}>
          <Input id={`stock-${produit.id}`} type="number" inputMode="numeric" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOuvert(false)}>Annuler</Button>
        <Button size="sm" fullWidth disabled={envoi || !libelle.trim() || !(Number(prix) > 0)} onClick={envoyer}>
          {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}Créer la variante
        </Button>
      </div>
    </div>
  );
}
