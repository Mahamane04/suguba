'use client';

import React, { forwardRef, createContext, useContext, useId } from 'react';
import { formatF } from '@/lib/montant';

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

/**
 * Saisie d'un montant en francs (ADM-06, lot 2 de l'audit UI/UX du 2026-10-02) :
 * « F » dans le champ et écho lisible dessous (« = 25 000 F »). Dans un champ
 * brut, « 25000 » et « 250000 » se ressemblent : un zéro de trop, c'est dix
 * fois l'argent. Le libellé du champ n'a donc plus à répéter l'unité.
 */
export const MontantInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function MontantInput({ className = '', value, ...props }, ref) {
    const nombre = value === '' || value == null ? NaN : Number(value);
    return (
      <div className="space-y-1">
        <div className="relative">
          <Input {...props} ref={ref} value={value} type="number" inputMode={props.inputMode || 'numeric'} className={`pr-10 tabular-nums ${className}`} />
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-600">F</span>
        </div>
        {Number.isFinite(nombre) && nombre >= 1000 && (
          <p className="text-xs text-slate-600 tabular-nums" aria-live="polite">= {formatF(nombre)}</p>
        )}
      </div>
    );
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
