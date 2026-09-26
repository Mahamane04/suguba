'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, ShieldAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

export interface MessageFil {
  id: string; auteur: 'revendeur' | 'fournisseur' | 'client' | 'suguba'; deMoi: boolean; texte: string;
  statut: 'publie' | 'en_attente' | 'refuse'; motifRefus: string | null; envoyeLe: string;
}

const NOM: Record<MessageFil['auteur'], string> = { revendeur: 'Revendeur', fournisseur: 'Fournisseur', client: 'Client', suguba: 'Suguba' };
const heure = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Fil de messages d'un dossier (2026-09-26, Protection Suguba — lot 3).
 * Les prix, conditions et paiements passent par les actions prévues (devis,
 * commande) : un message qui propose de traiter ailleurs attend la
 * vérification de l'équipe Suguba.
 */
export default function FilMessages({ charger, envoyer, placeholder }: {
  charger: () => Promise<MessageFil[]>;
  envoyer: (texte: string) => Promise<{ error?: string; avertissement?: string | null }>;
  placeholder?: string;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageFil[] | null>(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  const recharger = useCallback(() => charger().then(setMessages).catch(() => setMessages([])), [charger]);
  useEffect(() => { recharger(); }, [recharger]);
  useEffect(() => { bas.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  const soumettre = async () => {
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      const r = await envoyer(texte.trim());
      if (r.error) { toast(r.error, { ton: 'erreur' }); return; }
      if (r.avertissement) toast(r.avertissement, { ton: 'info' });
      setTexte('');
      await recharger();
    } finally { setEnvoi(false); }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {!messages ? <p className="text-xs text-slate-500">Chargement…</p>
          : messages.length === 0 ? <p className="text-xs text-slate-500">Aucun message pour l’instant.</p>
          : messages.map((m) => (
            <div key={m.id} className={`flex ${m.deMoi ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.deMoi ? 'bg-suguba-profond text-white' : 'bg-slate-100 text-slate-900'} ${m.statut !== 'publie' ? 'opacity-80' : ''}`}>
                {!m.deMoi && <p className="text-[11px] font-bold opacity-70">{NOM[m.auteur]}</p>}
                <p className="whitespace-pre-line break-words">{m.texte}</p>
                <p className="text-[11px] opacity-70 mt-1">
                  {heure(m.envoyeLe)}
                  {m.statut === 'en_attente' && ' · en vérification par Suguba'}
                  {m.statut === 'refuse' && ` · non remis${m.motifRefus ? ` : ${m.motifRefus}` : ''}`}
                </p>
              </div>
            </div>
          ))}
        <div ref={bas} />
      </div>
      <p className="text-[11px] text-slate-500 flex items-start gap-1">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
        Prix, conditions et paiements passent par Suguba. Un message avec un numéro, un lien ou une proposition de traiter ailleurs est vérifié avant d’être remis.
      </p>
      <Textarea rows={3} maxLength={1000} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={placeholder || 'Votre message'} aria-label="Votre message" />
      <Button fullWidth onClick={soumettre} disabled={envoi || !texte.trim()}>
        {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Envoyer
      </Button>
    </div>
  );
}
