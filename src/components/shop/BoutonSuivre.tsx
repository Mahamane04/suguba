'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';

/**
 * Suivre une boutique (§ 10 du cahier des charges).
 *
 * Volontairement ouvert aux visiteurs SANS COMPTE : demander une inscription
 * pour suivre une boutique reviendrait à n'avoir aucun abonné. Le client donne
 * son numéro WhatsApp — le même qu'il donnera en commandant — et il est
 * enregistré une fois pour toutes sur cet appareil.
 */

const MEMOIRE = 'suguba_suivi_tel';

export default function BoutonSuivre({ slug, abonnesInitial }: { slug: string; abonnesInitial: number }) {
  const [suit, setSuit] = useState(false);
  const [abonnes, setAbonnes] = useState(abonnesInitial);
  const [telephone, setTelephone] = useState('');
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let memorise = '';
    try { memorise = localStorage.getItem(MEMOIRE) || ''; } catch { /* navigation privée */ }
    if (memorise) setTelephone(memorise);

    const parametres = new URLSearchParams({ boutique: slug, ...(memorise ? { telephone: memorise } : {}) });
    fetch(`/api/reseau/suivre?${parametres}`)
      .then((r) => r.json())
      .then((data) => {
        setSuit(Boolean(data.suit));
        if (typeof data.abonnes === 'number') setAbonnes(data.abonnes);
      })
      .catch(() => { /* le bouton reste utilisable */ });
  }, [slug]);

  const basculer = async (tel: string) => {
    setEnCours(true);
    setMessage(null);
    try {
      const reponse = await fetch('/api/reseau/suivre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutique: slug, telephone: tel || undefined }),
      });
      const data = await reponse.json();
      if (!reponse.ok) {
        if (reponse.status === 400) { setSaisieOuverte(true); setMessage(data.error); return; }
        setMessage(data.error || 'Impossible pour le moment.');
        return;
      }
      setSuit(Boolean(data.suit));
      setAbonnes(Number(data.abonnes) || 0);
      setSaisieOuverte(false);
      if (tel) { try { localStorage.setItem(MEMOIRE, tel); } catch { /* ignoré */ } }
    } catch {
      setMessage('Connexion impossible. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (telephone || suit ? basculer(telephone) : setSaisieOuverte(true))}
          disabled={enCours}
          aria-pressed={suit}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl text-xs font-bold transition-all active:scale-[0.98] ${
            suit ? 'bg-suguba-menthe text-suguba-profond border border-suguba-profond/20' : 'bg-suguba-profond hover:bg-suguba-profond-2 text-white'
          }`}
        >
          {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : suit ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {suit ? 'Abonné' : 'Suivre'}
        </button>
        {abonnes > 0 && (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {abonnes} abonné{abonnes > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {saisieOuverte && !suit && (
        <div className="flex items-center gap-2">
          <input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="Votre numéro WhatsApp"
            aria-label="Votre numéro WhatsApp"
            className="h-11 flex-1 min-w-0 rounded-2xl bg-white border border-slate-200 px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
          />
          <button
            type="button"
            onClick={() => basculer(telephone)}
            disabled={enCours || telephone.replace(/\D/g, '').length < 8}
            className="h-11 px-4 rounded-2xl bg-suguba-profond text-white text-xs font-bold disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      )}

      {message && <p className="text-xs text-amber-700">{message}</p>}
      {suit && (
        <p className="text-xs text-slate-500">
          Vous serez prévenu des nouveautés et des promotions.{' '}
          <a href="/boutiques-suivies" className="underline font-bold text-suguba-brand-dark">Mes boutiques suivies</a>
        </p>
      )}
    </div>
  );
}
