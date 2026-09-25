'use client';
import { useEffect, useRef, useState } from 'react';

/** Portail + isolation du fond + focus initial, boucle clavier et restitution. */
export function useModalFocus(open: boolean, onClose: () => void) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const node = document.createElement('div');
    node.dataset.modalPortal = 'true';
    document.body.appendChild(node);
    setHost(node);
    return () => { node.remove(); setHost(null); };
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !host || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== host);
    const inertStates = siblings.map(el => [el, el.inert] as const);
    siblings.forEach(el => { el.inert = true; });
    const y = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    Object.assign(document.body.style, { overflow: 'hidden', position: 'fixed', top: `-${y}px`, width: '100%' });
    const elements = () => [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'));
    const focusFirst = () => (elements()[0] || dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (dialog.closest('[inert]')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const all = elements();
      const first = all[0], last = all[all.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => { if (!dialog.closest('[inert]') && !dialog.contains(event.target as Node)) focusFirst(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    focusFirst();
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      inertStates.forEach(([el, inert]) => { el.inert = inert; });
      Object.assign(document.body.style, { overflow, position, top, width });
      window.scrollTo(0, y);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, host]);
  return { host, ref };
}
