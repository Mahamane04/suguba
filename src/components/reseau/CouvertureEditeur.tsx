'use client';

import React, { useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { compresserImage } from '@/lib/compression-image';

/**
 * Bannière de boutique (§ 6 et § 7 : « bannière », « couverture »).
 * Format paysage : affichée en haut de la page publique de la boutique.
 */
export default function CouvertureEditeur({ valeur, onChange }: { valeur: string | null; onChange: (url: string | null) => void }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const formulaire = new FormData();
      formulaire.append('file', await compresserImage(fichier));
      const r = await fetch('/api/reseau/upload?usage=image', { method: 'POST', body: formulaire });
      const d = await r.json();
      if (!r.ok || !d.url) { setErreur(d.error || 'Envoi impossible.'); return; }
      onChange(d.url);
    } catch {
      setErreur('Envoi impossible. Vérifiez votre connexion.');
    } finally { setEnvoi(false); }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {valeur ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={valeur} alt="Bannière de la boutique" className="w-full h-32 object-cover rounded-2xl border border-slate-200" />
        ) : (
          <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50" />
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-white/95 border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer shadow-sm">
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {envoi ? 'Envoi…' : valeur ? 'Changer la bannière' : 'Ajouter une bannière'}
            <input type="file" accept="image/*" className="hidden" disabled={envoi} onChange={(e) => { envoyer(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {valeur && (
            <button type="button" onClick={() => onChange(null)} aria-label="Retirer la bannière"
              className="w-10 h-10 rounded-2xl bg-white/95 border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Image en largeur (paysage), affichée en haut de votre boutique.</p>
      {erreur && <p className="text-xs font-semibold text-rose-600">{erreur}</p>}
    </div>
  );
}
