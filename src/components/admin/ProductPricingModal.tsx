'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '@/types';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { X, ShieldCheck, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import ProductImage from '@/components/common/ProductImage';
import { calculerTarif, type ReglagesPlateforme } from '@/lib/pricing';

interface ProductPricingModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Tarification d'un produit par l'admin.
 *
 * L'admin ne choisit plus que le PRIX DE VENTE. La commission revendeur est
 * calculée par le moteur (src/lib/pricing.ts) à partir des réglages de la
 * plateforme : elle était auparavant saisie à la main, avec pour seule règle
 * « marge Suguba non négative » — aucun coût n'était pris en compte.
 *
 * L'aperçu est calculé ici avec le même moteur que le serveur. L'enregistrement
 * passe par /api/admin/products/price, qui recalcule tout et fait foi.
 */
export default function ProductPricingModal({ product, isOpen, onClose }: ProductPricingModalProps) {
  const state = useSugubaStore();
  const [reglages, setReglages] = useState<ReglagesPlateforme | null>(null);
  const [confirme, setConfirme] = useState(true);
  const [prixVente, setPrixVente] = useState<number>(0);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!product || !isOpen) return;
    let annule = false;
    setChargement(true);
    setErreur('');
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((json) => {
        if (annule || !json.reglages) return;
        setReglages(json.reglages);
        setConfirme(Boolean(json.confirme));
        // Un produit déjà approuvé garde son prix ; un dépôt en attente part
        // du prix recommandé plutôt que de l'ancien « fournisseur × 1,3 ».
        const t = calculerTarif(product.supplierPrice, product.publicPrice || 0, json.reglages, product.resellerCommissionProposee);
        setPrixVente(product.status === 'approved' && product.publicPrice > 0 ? product.publicPrice : t.prixRecommande);
      })
      .catch(() => setErreur('Impossible de charger les réglages de la plateforme.'))
      .finally(() => !annule && setChargement(false));
    return () => { annule = true; };
  }, [product, isOpen]);

  const tarif = useMemo(
    () => (product && reglages ? calculerTarif(product.supplierPrice, prixVente, reglages, product.resellerCommissionProposee) : null),
    [product, reglages, prixVente],
  );

  if (!isOpen || !product) return null;

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarif) return;
    setErreur('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/admin/products/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, publicPrice: prixVente }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreur(json.error || 'Échec de l\'enregistrement.');
        return;
      }
      // Le serveur a fait foi : on reprend SES montants, pas ceux de l'aperçu.
      sugubaStore.approveProduct(
        product.id,
        prixVente,
        json.tarif.commission,
        json.tarif.margeSuguba,
        state.currentUser.fullName,
      );
      onClose();
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  };

  const f = (n: number) => `${n.toLocaleString('fr-FR')} F`;
  const statutLibelle: Record<string, { texte: string; classe: string }> = {
    ok: { texte: 'Rentable et proposé aux revendeurs', classe: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    commission_faible: { texte: 'Vendable, mais commission trop faible pour être proposée au partage', classe: 'bg-amber-100 text-amber-900 border-amber-300' },
    sous_plancher: { texte: 'Sous le plancher : Suguba perdrait de l\'argent', classe: 'bg-rose-100 text-rose-800 border-rose-300' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-slate-300" />
            <h3 className="font-bold text-base sm:text-lg">Tarification du produit</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={enregistrer} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <ProductImage src={product.images?.[0]} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fournisseur : {product.supplierName}</p>
              <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
              <p className="text-xs font-black text-slate-700 mt-0.5">Prix fournisseur : {f(product.supplierPrice)}</p>
            </div>
          </div>

          {!confirme && (
            <div className="flex items-start space-x-2 bg-amber-50 border border-amber-300 rounded-2xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900">
                Les coûts de la plateforme ne sont pas encore confirmés : ce calcul repose sur une
                estimation provisoire. Renseignez vos vrais coûts dans « Réglages économiques ».
              </p>
            </div>
          )}

          {chargement || !tarif ? (
            <div className="flex items-center space-x-2 text-xs text-slate-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Chargement des réglages…</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prix de vente au client (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={prixVente}
                  onChange={(e) => setPrixVente(parseInt(e.target.value) || 0)}
                  className="w-full h-12 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:outline-slate-600"
                />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setPrixVente(tarif.prixRecommande)}
                    className="flex-1 h-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] font-bold flex items-center justify-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" /><span>Recommandé : {f(tarif.prixRecommande)}</span>
                  </button>
                  <button type="button" onClick={() => setPrixVente(tarif.prixMinimal)}
                    className="flex-1 h-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold">
                    Minimal : {f(tarif.prixMinimal)}
                  </button>
                </div>
              </div>

              <div className={`border rounded-2xl px-3 py-2 text-[11px] font-bold ${statutLibelle[tarif.statut].classe}`}>
                {statutLibelle[tarif.statut].texte}
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1.5 text-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1">Décomposition par article</p>
                <Ligne l="Prix de vente" v={f(tarif.prixVente)} fort />
                <Ligne l="− Prix fournisseur" v={f(tarif.prixFournisseur)} classe="text-slate-300" />
                <div className="border-t border-slate-800 my-1" />
                <Ligne l="Frais de paiement" v={f(tarif.coutPaiement)} classe="text-slate-400" />
                <Ligne l="Provision pour refus" v={f(tarif.provisionRefus)} classe="text-slate-400" />
                <Ligne l="Part des coûts fixes" v={f(tarif.coutFixe)} classe="text-slate-400" />
                <Ligne l="Message au client" v={f(tarif.coutMessage)} classe="text-slate-400" />
                {tarif.deficitLivraison > 0 && <Ligne l="Déficit livraison" v={f(tarif.deficitLivraison)} classe="text-slate-400" />}
                <Ligne l="Marge nette minimale" v={f(tarif.margeNetteMinimale)} classe="text-slate-400" />
                <Ligne l="= Plancher Suguba" v={f(tarif.plancher)} classe="text-amber-300" />
                <div className="border-t border-slate-800 my-1" />
                <Ligne l="Reste à partager" v={f(tarif.reste)} />
                <Ligne l="→ Commission revendeur" v={f(tarif.commission)} classe="text-emerald-400" fort />
                <Ligne l="→ Marge Suguba (brute)" v={f(tarif.margeSuguba)} classe="text-slate-300" />
                <Ligne l="Marge nette Suguba, tous coûts payés" v={f(tarif.margeNetteSuguba)} classe="text-slate-200" fort />
              </div>

              {tarif.partageable && (
                <p className="text-[11px] text-slate-600">
                  Affiché au revendeur : « Gagne {f(tarif.commission)} par vente ».
                </p>
              )}

              {erreur && (
                <div className="flex items-start space-x-2 text-rose-700 text-[11px] font-bold bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{erreur}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={envoi || tarif.statut === 'sous_plancher'}
                className="w-full h-[52px] bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
              >
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{tarif.statut === 'sous_plancher' ? 'Prix sous le plancher' : 'Approuver et publier à ce prix'}</span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function Ligne({ l, v, classe = 'text-slate-200', fort = false }: { l: string; v: string; classe?: string; fort?: boolean }) {
  return (
    <div className={`flex justify-between ${classe} ${fort ? 'font-black' : ''}`}>
      <span>{l}</span><span>{v}</span>
    </div>
  );
}
