'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { DIAL_CODES } from '@/lib/dial-codes';

interface DialCodePickerProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

/**
 * Remplace le <select> natif (popup système, pas de contrôle visuel) par un
 * vrai menu déroulant scrollable dans le design de l'app — demandé après
 * que le sélecteur d'indicatif ait été jugé pas assez soigné visuellement.
 */
export default function DialCodePicker({ value, onChange, className = '' }: DialCodePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = DIAL_CODES.find((d) => d.code === value) || DIAL_CODES[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-[104px] h-full flex items-center justify-between gap-1 bg-gray-50 border border-gray-200 rounded-2xl px-2.5 py-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
      >
        <span className="truncate">{current.flag} {current.code}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-56 max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-float py-1.5 animate-slide-down">
          {DIAL_CODES.map((d) => (
            <button
              key={d.code + d.country}
              type="button"
              onClick={() => { onChange(d.code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors ${
                d.code === value ? 'bg-suguba-brand/10 text-suguba-brand font-bold' : 'text-gray-700 hover:bg-gray-50 font-medium'
              }`}
            >
              <span className="text-base leading-none">{d.flag}</span>
              <span className="flex-1 truncate">{d.country}</span>
              <span className="font-mono text-gray-400">{d.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
