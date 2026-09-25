'use client';

import React, { forwardRef, createContext, useContext, useId } from 'react';

/**
 * Champs de formulaire communs (2026-09-11).
 *
 * Texte en 16 px sur téléphone : en dessous, Safari zoome sur le champ à la
 * saisie, et la page reste décalée ensuite. Hauteur 48 px : une cible
 * confortable pour le pouce. Un seul style de focus, au vert de marque.
 */

const BASE_CHAMP =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-base sm:text-sm text-slate-900 ' +
  'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond ' +
  'disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-rose-400';

const FieldContext = createContext<{ id: string; description?: string; invalid: boolean; required: boolean } | null>(null);

export function useFieldContext() { return useContext(FieldContext); }

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
  const generated = useId();
  const id = htmlFor || generated;
  const description = (erreur || aide) ? `${id}-description` : undefined;
  return (
    <FieldContext.Provider value={{ id, description, invalid: Boolean(erreur), required: Boolean(requis) }}>
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold text-slate-700">
        {label}{requis && <span className="text-rose-600"> *</span>}
      </label>
      {children}
      {erreur ? (
        <p id={description} role="alert" className="text-xs font-semibold text-rose-700">{erreur}</p>
      ) : aide ? (
        <p id={description} className="text-xs text-slate-600">{aide}</p>
      ) : null}
    </div>
    </FieldContext.Provider>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    const field = useContext(FieldContext);
    return <input {...props} id={props.id || field?.id} aria-describedby={[field?.description, props['aria-describedby']].filter(Boolean).join(' ') || undefined} aria-invalid={field?.invalid || props['aria-invalid']} required={field?.required || props.required} ref={ref} className={`${BASE_CHAMP} h-12 ${className}`} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    const field = useContext(FieldContext);
    return <select {...props} id={props.id || field?.id} aria-describedby={[field?.description, props['aria-describedby']].filter(Boolean).join(' ') || undefined} aria-invalid={field?.invalid || props['aria-invalid']} required={field?.required || props.required} ref={ref} className={`${BASE_CHAMP} h-12 ${className}`}>{children}</select>;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    const field = useContext(FieldContext);
    return <textarea {...props} id={props.id || field?.id} aria-describedby={[field?.description, props['aria-describedby']].filter(Boolean).join(' ') || undefined} aria-invalid={field?.invalid || props['aria-invalid']} required={field?.required || props.required} ref={ref} className={`${BASE_CHAMP} py-3 ${className}`} />;
  },
);
