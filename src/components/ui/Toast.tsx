'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * Messages et confirmations de l'application (2026-09-11) — remplacent les
 * `alert()` et `confirm()` du navigateur : fenêtres grises du système, en
 * anglais sur certains téléphones, qui bloquent tout et cassent la confiance.
 *
 *   const { toast, confirmer } = useToast();
 *   toast('Photos enregistrées', { ton: 'succes' });
 *   if (await confirmer({ titre: 'Retirer ce produit ?', danger: true })) { … }
 *   const motif = await demander({ titre: 'Refuser ?', libelle: 'Motif', min: 5 }); // null = annulé
 *
 * Le fournisseur est monté une fois dans le layout.
 */

type Ton = 'succes' | 'erreur' | 'info';

interface Message { id: number; texte: string; ton: Ton }

interface DemandeConfirmation {
  titre: string;
  message?: string;
  confirmer?: string;
  annuler?: string;
  danger?: boolean;
}

/**
 * Saisie d'un texte (motif, raison) — remplace `window.prompt` (U3,
 * 2026-09-27) : la fenêtre du navigateur ne vérifiait rien et ressemblait à
 * une erreur. Ici : libellé, longueur minimale, bouton désactivé tant que la
 * saisie est trop courte.
 */
interface DemandeTexte extends DemandeConfirmation {
  libelle: string;
  min?: number;
  placeholder?: string;
}

interface ContexteToast {
  toast: (texte: string, options?: { ton?: Ton; duree?: number }) => void;
  confirmer: (demande: DemandeConfirmation) => Promise<boolean>;
  demander: (demande: DemandeTexte) => Promise<string | null>;
}

const Contexte = createContext<ContexteToast | null>(null);

const STYLE_TON: Record<Ton, { icone: React.ElementType; classe: string }> = {
  succes: { icone: CheckCircle2, classe: 'bg-slate-900 text-white' },
  erreur: { icone: AlertCircle, classe: 'bg-rose-600 text-white' },
  info: { icone: Info, classe: 'bg-slate-900 text-white' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [demande, setDemande] = useState<(DemandeConfirmation & Partial<DemandeTexte>) | null>(null);
  const [saisie, setSaisie] = useState('');
  const resoudre = useRef<((ok: boolean) => void) | null>(null);
  const resoudreTexte = useRef<((texte: string | null) => void) | null>(null);
  const compteur = useRef(0);

  const toast = useCallback<ContexteToast['toast']>((texte, options) => {
    const id = ++compteur.current;
    setMessages((m) => [...m.slice(-2), { id, texte, ton: options?.ton || 'info' }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), options?.duree ?? 4500);
  }, []);

  // Hors composant React (ex. src/lib/partage.ts) : on émet l'événement
  //   window.dispatchEvent(new CustomEvent('suguba:toast', { detail: { texte, ton } }))
  useEffect(() => {
    const surEvenement = (e: Event) => {
      const d = (e as CustomEvent<{ texte?: string; ton?: Ton }>).detail;
      if (d?.texte) toast(d.texte, { ton: d.ton });
    };
    window.addEventListener('suguba:toast', surEvenement);
    return () => window.removeEventListener('suguba:toast', surEvenement);
  }, [toast]);

  const confirmer = useCallback<ContexteToast['confirmer']>((d) => {
    setDemande(d);
    return new Promise<boolean>((resolve) => { resoudre.current = resolve; });
  }, []);

  const demander = useCallback<ContexteToast['demander']>((d) => {
    setSaisie('');
    setDemande(d);
    return new Promise<string | null>((resolve) => { resoudreTexte.current = resolve; });
  }, []);

  const texteValide = saisie.trim().length >= (demande?.min ?? 1);
  const repondre = (ok: boolean) => {
    if (demande?.libelle) {
      if (ok && !texteValide) return;
      resoudreTexte.current?.(ok ? saisie.trim() : null);
      resoudreTexte.current = null;
    } else {
      resoudre.current?.(ok);
      resoudre.current = null;
    }
    setDemande(null);
  };

  useEffect(() => {
    if (!demande) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') repondre(false); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [demande]);

  return (
    <Contexte.Provider value={{ toast, confirmer, demander }}>
      {children}

      {/* Au-dessus de la barre du bas sur mobile. */}
      <div
        className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
        role="status"
        aria-live="polite"
      >
        {messages.map((m) => {
          const { icone: Icone, classe } = STYLE_TON[m.ton];
          return (
            <div key={m.id} className={`pointer-events-auto max-w-md w-full rounded-2xl px-4 py-3 shadow-float flex items-center gap-2.5 text-sm font-semibold animate-fade-up ${classe}`}>
              <Icone className="w-5 h-5 shrink-0" />
              <span className="flex-1">{m.texte}</span>
              <button
                type="button"
                onClick={() => setMessages((l) => l.filter((x) => x.id !== m.id))}
                aria-label="Fermer le message"
                className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {demande && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => repondre(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-titre"
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 id="confirmation-titre" className="text-base font-bold text-slate-900">{demande.titre}</h2>
              {demande.message && <p className="text-sm text-slate-600 whitespace-pre-line">{demande.message}</p>}
            </div>
            {demande.libelle && (
              <form id="demande-texte" onSubmit={(e) => { e.preventDefault(); repondre(true); }} className="space-y-1.5">
                <label htmlFor="demande-texte-champ" className="block text-sm font-semibold text-slate-800">{demande.libelle}</label>
                <textarea id="demande-texte-champ" value={saisie} onChange={(e) => setSaisie(e.target.value)} rows={3} autoFocus
                  placeholder={demande.placeholder} maxLength={500}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond" />
                {demande.min && demande.min > 1 ? (
                  <p className="text-xs text-slate-500">{saisie.trim().length < demande.min ? `Au moins ${demande.min} caractères.` : 'Ce motif est inscrit au journal.'}</p>
                ) : null}
              </form>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => repondre(false)}>{demande.annuler || 'Annuler'}</Button>
              <Button variant={demande.danger ? 'danger' : 'primary'} onClick={() => repondre(true)} autoFocus={!demande.libelle} disabled={Boolean(demande.libelle) && !texteValide}>
                {demande.confirmer || 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Contexte.Provider>
  );
}

export function useToast(): ContexteToast {
  const c = useContext(Contexte);
  if (c) return c;
  // Filet de sécurité hors du fournisseur (ne devrait pas arriver) : jamais d'écran figé.
  return {
    toast: (texte) => { if (typeof window !== 'undefined') window.alert(texte); },
    confirmer: async (d) => (typeof window !== 'undefined' ? window.confirm(d.titre) : false),
    demander: async () => null,
  };
}
