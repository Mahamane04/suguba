'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Star } from 'lucide-react';
import { compresserImage } from '@/lib/compression-image';

interface Photo {
  id: string;
  apercu: string;
  url: string | null;
  erreur: string | null;
}

/**
 * Envoi de PLUSIEURS photos produit (2026-09-11). Les deux formulaires de dépôt
 * (fournisseur et admin) n'en acceptaient qu'une, alors que la base et
 * l'affichage en gèrent plusieurs : aucun carrousel n'avait jamais qu'une
 * image à montrer.
 *
 * Chaque photo part aussitôt choisie vers le stockage Suguba
 * (/api/products/upload-image). La première est la photo principale : c'est
 * elle qui accompagne le partage WhatsApp — l'étoile permet d'en changer.
 * Pour vider le composant depuis le formulaire, changer sa `key`.
 */
export default function PhotosUploader({
  value,
  onChange,
  onUploadingChange,
  max = 6,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  onUploadingChange?: (enCours: boolean) => void;
  max?: number;
}) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    value.map((url, i) => ({ id: `initiale-${i}`, apercu: url, url, erreur: null })),
  );
  const input = useRef<HTMLInputElement>(null);

  // Remonte au formulaire les photos prêtes, dans l'ordre, et l'état d'envoi.
  useEffect(() => {
    onChange(photos.filter((p) => p.url).map((p) => p.url as string));
    onUploadingChange?.(photos.some((p) => !p.url && !p.erreur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const envoyer = async (fichier: File, id: string) => {
    try {
      // Allégée avant l'envoi (1600 px, JPEG) : une photo de téléphone de 8 Mo
      // était refusée (limite 5 Mo) et coûtait cher en data à chaque partage.
      const allegee = await compresserImage(fichier);
      const donnees = new FormData();
      donnees.append('file', allegee);
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: donnees });
      const json = await res.json();
      setPhotos((prev) => prev.map((p) => {
        if (p.id !== id) return p;
        return res.ok && json.success
          ? { ...p, url: json.url }
          : { ...p, erreur: json.error || "Échec de l'envoi." };
      }));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, erreur: 'Erreur réseau.' } : p)));
    }
  };

  const ajouter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(e.target.files || []).slice(0, Math.max(0, max - photos.length));
    e.target.value = '';
    const nouvelles = fichiers.map((fichier) => ({
      fichier,
      photo: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        apercu: URL.createObjectURL(fichier),
        url: null,
        erreur: null,
      } as Photo,
    }));
    setPhotos((prev) => [...prev, ...nouvelles.map((n) => n.photo)]);
    nouvelles.forEach((n) => envoyer(n.fichier, n.photo.id));
  };

  const retirer = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));
  const mettreEnPremier = (id: string) =>
    setPhotos((prev) => {
      const choisie = prev.find((p) => p.id === id);
      return choisie ? [choisie, ...prev.filter((p) => p.id !== id)] : prev;
    });

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={ajouter}
        className="hidden"
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div
            key={p.id}
            className={`relative aspect-square rounded-2xl overflow-hidden border bg-slate-50 ${p.erreur ? 'border-rose-300' : 'border-slate-200'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.apercu} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {!p.url && !p.erreur && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            )}
            {p.erreur && (
              <div className="absolute inset-x-0 bottom-0 bg-rose-600 text-white text-[11px] font-bold p-1 text-center leading-tight">
                {p.erreur}
              </div>
            )}
            {i === 0 && p.url && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white text-[11px] font-bold">
                Principale
              </span>
            )}
            <button
              type="button"
              onClick={() => retirer(p.id)}
              aria-label="Retirer cette photo"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {i > 0 && p.url && (
              <button
                type="button"
                onClick={() => mettreEnPremier(p.id)}
                aria-label="En faire la photo principale"
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 text-slate-500 transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[11px] font-bold text-center px-1">
              {photos.length === 0 ? 'Ajouter des photos' : 'Ajouter'}
            </span>
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        Jusqu&apos;à {max} photos, allégées automatiquement avant l&apos;envoi. La première est la photo
        principale : c&apos;est elle qui part avec le partage WhatsApp. Touchez l&apos;étoile pour en changer.
      </p>
    </div>
  );
}
