'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useFieldContext } from './Field';

export interface Choix { valeur: string; libelle: string; detail?: string; groupe?: string }
/** Sélection seule : le focus reste sur le champ, l’option active est annoncée. */
export default function ChoicePicker({ id, valeur, choix, onChange, placeholder = 'Choisir…', invalide = false, ariaLabel, className = '', triggerClassName = '', prefixe }: {
  id?: string; valeur: string; choix: Choix[]; onChange: (valeur: string) => void;
  placeholder?: string; invalide?: boolean; ariaLabel?: string; className?: string;
  triggerClassName?: string; prefixe?: string;
}) {
  const generated = useId(); const field = useFieldContext();
  const controlId = id || field?.id || generated;
  const listId = `${controlId}-options`;
  const [ouvert, setOuvert] = useState(false); const [actif, setActif] = useState(0);
  const ref = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ value: '', time: 0 });
  const selection = choix.find(c => c.valeur === valeur);
  useEffect(() => {
    if (!ouvert) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ouvert]);
  useEffect(() => { if (ouvert) document.getElementById(`${listId}-${actif}`)?.scrollIntoView({ block: 'nearest' }); }, [ouvert, actif, listId]);
  const ouvrir = () => { setActif(Math.max(0, choix.findIndex(c => c.valeur === valeur))); setOuvert(true); };
  const choisir = (i: number) => { if (choix[i]) onChange(choix[i].valeur); setOuvert(false); trigger.current?.focus(); };
  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && ouvert) { e.preventDefault(); e.stopPropagation(); setOuvert(false); return; }
    if (e.key === 'Tab') { if (ouvert && choix[actif]) onChange(choix[actif].valeur); setOuvert(false); return; }
    if (['Enter', ' '].includes(e.key)) { e.preventDefault(); ouvert ? choisir(actif) : ouvrir(); return; }
    if (['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(e.key)) {
      e.preventDefault(); setOuvert(true);
      if (e.key === 'Home') setActif(0);
      else if (e.key === 'End') setActif(Math.max(0,choix.length-1));
      else if (!ouvert) setActif(Math.max(0, choix.findIndex(c => c.valeur === valeur)));
      else setActif(i => Math.max(0, Math.min(choix.length-1, i + ({ArrowDown:1,ArrowUp:-1,PageDown:10,PageUp:-10}[e.key] || 0))));
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); const now = Date.now(); const text = now-typed.current.time < 700 ? typed.current.value+e.key : e.key;
      typed.current={value:text,time:now};
      const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
      const found=choix.findIndex(c=>normalize(c.libelle).startsWith(normalize(text)));
      if(found>=0){setActif(found);setOuvert(true);}
    }
  };
  return <div ref={ref} className={`relative ${className}`}>
    <button ref={trigger} id={controlId} type="button" role="combobox" aria-haspopup="listbox"
      aria-controls={listId} aria-expanded={ouvert} aria-activedescendant={ouvert && choix[actif] ? `${listId}-${actif}` : undefined}
      aria-invalid={invalide || field?.invalid} aria-required={field?.required} aria-describedby={field?.description} aria-label={ariaLabel}
      onClick={()=>ouvert?setOuvert(false):ouvrir()} onKeyDown={surTouche} onBlur={()=>setOuvert(false)}
      className={`w-full min-h-12 flex items-center justify-between gap-2 border rounded-2xl px-3.5 text-base sm:text-sm text-left focus:outline-none focus:ring-2 focus:ring-suguba-profond focus:border-suguba-profond ${invalide || field?.invalid?'border-rose-500':'border-slate-200'} ${triggerClassName || 'bg-white text-slate-900'}`}>
      <span className="min-w-0">{prefixe && <span className="block text-xs font-semibold">{prefixe}</span>}<span className="block truncate">{selection?.libelle || placeholder}{selection?.detail && <span> · {selection.detail}</span>}</span></span>
      <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 ${ouvert?'rotate-180':''}`} />
    </button>
    <ul id={listId} role="listbox" aria-label={ariaLabel || 'Choix disponibles'} hidden={!ouvert}
      className="absolute z-30 mt-1.5 w-full min-w-0 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-float p-1.5">
      {choix.map((c,i)=><React.Fragment key={c.valeur}>
        {c.groupe && c.groupe!==choix[i-1]?.groupe && <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-bold text-slate-600">{c.groupe}</li>}
        <li id={`${listId}-${i}`} role="option" aria-selected={valeur===c.valeur}
          onMouseDown={e=>e.preventDefault()} onClick={()=>choisir(i)} onMouseEnter={()=>setActif(i)}
          className={`min-h-11 px-3 py-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer text-sm ${i===actif?'bg-slate-100 outline outline-1 outline-slate-500':''} ${valeur===c.valeur?'text-suguba-profond font-bold':'text-slate-800'}`}>
          <span>{c.libelle}{c.detail && <span className="text-xs"> · {c.detail}</span>}</span>
          {valeur===c.valeur && <Check aria-hidden="true" className="w-4 h-4 shrink-0" />}
        </li>
      </React.Fragment>)}
    </ul>
  </div>;
}
