'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';

/**
 * Corrige BUG-011 : les visuels produit sont désormais hébergés sur le
 * bucket Supabase Storage de Suguba (voir /api/products/upload-image) au
 * lieu d'être hotlinkés depuis Unsplash ou collés en URL libre. Ce
 * composant reste un filet de sécurité pour deux cas qui restent possibles :
 * un produit sans aucune photo (src vide) et un lien qui deviendrait mort
 * après coup (fichier supprimé du bucket, etc.) — dans les deux cas, un
 * repli propre plutôt qu'une icône d'image cassée.
 */
export default function ProductImage(props: Omit<ImageProps, 'onError'>) {
  const [failed, setFailed] = useState(false);

  if (failed || !props.src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 ${props.fill ? 'absolute inset-0' : ''} ${props.className || ''}`}
        style={props.fill ? undefined : { width: props.width, height: props.height }}
      >
        <ImageOff className="w-8 h-8" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">Photo indisponible</span>
      </div>
    );
  }

  return <Image {...props} onError={() => setFailed(true)} />;
}
