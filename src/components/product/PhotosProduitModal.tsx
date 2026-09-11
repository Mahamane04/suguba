'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import PhotosUploader from '@/components/product/PhotosUploader';
import Button from '@/components/ui/Button';

/**
 * Ajout ou remplacement des photos d'un produit existant — commun à l'admin
 * (/admin/products) et au fournisseur (/supplier). Enregistre via
 * /api/products/images, qui ne touche qu'aux photos.
 */
export default function PhotosProduitModal({
  produit,
  onClose,
  onEnregistre,
}: {
  produit: { id: string; nom: string; images: string[] };
  onClose: () => void;
  /** `publication` : résultat de la publication automatique déclenchée par une première photo. */
  onEnregistre: (images: string[], publication?: { publie: boolean; prix?: number; raison?: string }) => void;
}) {
  const [images, setImages] = useState<string[]>(produit.images);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  const enregistrer = async () => {
    setErreur('');
    setEnregistrement(true);
    try {
      const res = await fetch('/api/products/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: produit.id, images }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErreur(json.error || "Les photos n'ont pas pu être enregistrées.");
        return;
      }
      onEnregistre(json.images, json.publication);
    } catch {
      setErreur('Erreur réseau, réessayez.');
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Photos de ${produit.nom}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-base text-slate-900">Photos du produit</h2>
            <p className="text-xs text-slate-500 line-clamp-1">{produit.nom}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
          <p className="font-bold text-slate-800">Pour des photos qui font vendre :</p>
          <p>• Lumière du jour, produit sur un fond uni et clair.</p>
          <p>• La première photo montre le produit entier, de face.</p>
          <p>• Ajoutez des détails : étiquette, boîte, accessoires, produit en usage.</p>
        </div>

        <PhotosUploader value={produit.images} onChange={setImages} onUploadingChange={setEnvoiEnCours} />

        {erreur && (
          <p className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-700">{erreur}</p>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={enregistrer} disabled={envoiEnCours || enregistrement} className="flex-1">
            {enregistrement ? 'Enregistrement…' : envoiEnCours ? 'Envoi des photos…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
