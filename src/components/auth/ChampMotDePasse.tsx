'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/**
 * Champ mot de passe (2026-09-26) avec « Afficher » : sur téléphone, voir
 * ce qu'on tape évite la plupart des erreurs de saisie.
 */
export default function ChampMotDePasse({ id, label, value, onChange, nouveau = false, decrit }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Mot de passe à créer : le téléphone propose d'en générer et de l'enregistrer. */
  nouveau?: boolean;
  decrit?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={nouveau ? 'new-password' : 'current-password'}
          required
          maxLength={72}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={decrit}
          className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-600 hover:text-slate-900"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
