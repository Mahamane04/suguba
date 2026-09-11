import React, { forwardRef } from 'react';

/**
 * Champs de formulaire communs (2026-09-11).
 *
 * Texte en 16 px sur téléphone : en dessous, Safari zoome sur le champ à la
 * saisie, et la page reste décalée ensuite. Hauteur 48 px : une cible
 * confortable pour le pouce. Un seul style de focus, au vert de marque.
 */

const BASE_CHAMP =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-base sm:text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand ' +
  'disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-rose-400';

export function Field({
  label,
  htmlFor,
  aide,
  erreur,
  requis,
  children,
}: {
  label: string;
  htmlFor?: string;
  aide?: string;
  erreur?: string;
  requis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700">
        {label}{requis && <span className="text-rose-600"> *</span>}
      </label>
      {children}
      {erreur ? (
        <p className="text-xs font-semibold text-rose-600">{erreur}</p>
      ) : aide ? (
        <p className="text-[11px] text-slate-500">{aide}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${BASE_CHAMP} h-12 ${className}`} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return <select ref={ref} className={`${BASE_CHAMP} h-12 ${className}`} {...props}>{children}</select>;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${BASE_CHAMP} py-3 ${className}`} {...props} />;
  },
);
