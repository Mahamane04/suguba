'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircleQuestion } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import FilMessages, { type MessageFil } from './FilMessages';

interface Fil { id: string; produit: string; avec: string; dernierLe: string }

/**
 * Questions sur les offres (2026-09-26, Protection Suguba — lot 3) : le
 * revendeur interroge le fournisseur d'un produit (disponibilité,
 * caractéristique), sans échanger de coordonnées.
 */
export default function PageQuestions({ espace }: { espace: 'reseller' | 'supplier' }) {
  const router = useRouter();
  const params = useSearchParams();
  const ouvert = params.get('c');
  const [fils, setFils] = useState<Fil[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/messages', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); setFils(j.conversations || []); })
      .catch((e) => setErreur((e as Error).message));
  }, [ouvert]);

  const charger = useCallback(async (): Promise<MessageFil[]> => {
    const r = await fetch(`/api/messages?c=${encodeURIComponent(ouvert || '')}`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j.messages || [];
  }, [ouvert]);
  const envoyer = useCallback(async (texte: string) => {
    const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'envoyer', c: ouvert, texte }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { avertissement: j.avertissement } : { error: j.error || 'Envoi impossible.' };
  }, [ouvert]);

  const actuel = fils?.find((f) => f.id === ouvert);
  const base = espace === 'reseller' ? '/reseller/questions' : '/supplier/questions';

  return (
    <PageReseau titre="Questions sur les offres"
      sousTitre={espace === 'reseller' ? 'Vos questions aux fournisseurs.' : 'Les questions des revendeurs sur vos offres.'}
      retour={ouvert ? { href: base, libelle: 'Toutes les questions' } : { href: espace === 'reseller' ? '/reseller' : '/supplier', libelle: 'Mon espace' }}>
      {erreur ? <EmptyState icone={MessageCircleQuestion} titre="Messagerie indisponible" texte={erreur} />
        : ouvert ? (
          <Card className="space-y-3">
            {actuel && <p className="text-sm font-bold text-slate-900">{actuel.produit}{espace === 'supplier' ? ` · ${actuel.avec}` : ''}</p>}
            <FilMessages charger={charger} envoyer={envoyer}
              placeholder={espace === 'reseller' ? 'Disponibilité, caractéristique, délai…' : 'Votre réponse'} />
          </Card>
        ) : !fils ? <Skeleton className="h-40" />
        : fils.length === 0 ? (
          <EmptyState icone={MessageCircleQuestion} titre="Aucune question"
            texte={espace === 'reseller' ? 'Sur la fiche d’un produit, « Poser une question au fournisseur ».' : 'Les questions des revendeurs sur vos offres arriveront ici.'} />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {fils.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => router.push(`${base}?c=${f.id}`)} className="w-full text-left py-3 min-h-11">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{f.produit}</span>
                    <span className="block text-xs text-slate-500">
                      {espace === 'supplier' ? `${f.avec} · ` : ''}{new Date(f.dernierLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
    </PageReseau>
  );
}
