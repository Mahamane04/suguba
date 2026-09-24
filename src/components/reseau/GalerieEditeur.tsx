'use client';

import React, { useState } from 'react';
import { ImagePlus, Loader2, X, ArrowLeft } from 'lucide-react';
import { compresserImage } from '@/lib/compression-image';

/**
 * Galerie d'une boutique (§ 7 : « jusqu'à environ 10 images »).
 *
 * Ajout, retrait, et « mettre en premier » (flèche) — la première photo est
 * celle qui s'affiche en grand sur la boutique. Pas de glisser-déposer : sur
 * un téléphone d'entrée de gamme, il est plus source d'erreurs qu'autre chose.
 */
export default function GalerieEditeur({
  images,
  max,
  onChange,
}: {
  images: string[];
  max: number;
  onChange: (images: string[]) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return;
    setErreur(null);
    setEnvoi(true);
    const nouvelles: string[] = [];
    try {
      for (const fichier of Array.from(fichiers).slice(0, max - images.length)) {
        const formulaire = new FormData();
        formulaire.append('file', await compresserImage(fichier));
        const reponse = await fetch('/api/reseau/upload?usage=image', { method: 'POST', body: formulaire });
        const data = await reponse.json();
        if (!reponse.ok || !data.url) { setErreur(data.error || 'Une photo n’a pas pu être envoyée.'); break; }
        nouvelles.push(data.url);
      }
    } catch {
      setErreur('Envoi impossible. Vérifiez votre connexion.');
    } finally {
      if (nouvelles.length) onChange([...images, ...nouvelles].slice(0, max));
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={url} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-xs font-bold">Principale</span>}
            <button
              type="button"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 text-slate-800 flex items-center justify-center shadow"
              aria-label={`Retirer la photo ${i + 1}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => onChange([url, ...images.filter((_, j) => j !== i)])}
                className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-white/95 text-slate-800 flex items-center justify-center shadow"
                aria-label={`Mettre la photo ${i + 1} en premier`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {images.length < max && (
          <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer active:scale-[0.98]">
            {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            <span className="text-xs font-bold">{envoi ? 'Envoi…' : 'Ajouter'}</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={envoi}
              onChange={(e) => { ajouter(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500">{images.length} / {max} photos · la première s’affiche en grand.</p>
      {erreur && <p className="text-xs font-semibold text-rose-600">{erreur}</p>}
    </div>
  );
}
