'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Surface';

interface Sponsorisation {
  id: string; libelle: string | null; budget: number; finitLe: string | null; commenceLe: string;
  paiement?: { recu: number; recuLe: string | null; reference: string | null; activeeLe: string | null };
}

/**
 * Reçu de paiement d'une sponsorisation (2026-09-26) — imprimable ou en PDF.
 * Ne montre que les sponsorisations du fournisseur connecté (la liste vient
 * de /api/supplier/sponsorisation, filtrée par le serveur).
 */
export default function RecuSponsorisationPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params?.id || ''));
  const [s, setS] = useState<Sponsorisation | null | undefined>(undefined);
  const [fournisseur, setFournisseur] = useState('');

  useEffect(() => {
    fetch('/api/supplier/sponsorisation', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setS((d.sponsorisations || []).find((x: Sponsorisation) => x.id === id) || null))
      .catch(() => setS(null));
    fetch('/api/supplier/me').then((r) => (r.ok ? r.json() : null)).then((j) => setFournisseur(j?.supplier?.companyName || j?.fiche?.companyName || '')).catch(() => {});
  }, [id]);

  const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  return (
    <PageReseau titre="Reçu de sponsorisation" retour={{ href: '/supplier/sponsorisation', libelle: 'Sponsorisation' }}>
      {s === undefined ? <Skeleton className="h-64" /> : !s || !s.paiement || s.paiement.recu <= 0 ? (
        <EmptyState icone={Printer} titre="Reçu indisponible" texte="Le reçu apparaît une fois le paiement enregistré par Suguba." />
      ) : (
        <>
          <article className="bg-white rounded-3xl border border-slate-200 overflow-hidden print:border-0 print:rounded-none">
            <header className="bg-suguba-profond text-white px-5 py-4 flex items-start justify-between gap-3 print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900">
              <div>
                <p className="text-xl font-bold tracking-wide">SUGUBA</p>
                <p className="text-sm text-suguba-citron print:text-slate-700">Reçu de paiement · sponsorisation</p>
              </div>
              <p className="text-right text-xs font-mono">N° {s.id.slice(0, 8).toUpperCase()}</p>
            </header>
            <dl className="p-5 grid grid-cols-2 gap-y-3 text-sm">
              {fournisseur && <><dt className="text-slate-500">Fournisseur</dt><dd className="font-semibold text-slate-900 text-right">{fournisseur}</dd></>}
              <dt className="text-slate-500">Objet</dt><dd className="font-semibold text-slate-900 text-right">{s.libelle || 'Sponsorisation'}</dd>
              <dt className="text-slate-500">Prix du pack</dt><dd className="text-right tabular-nums">{f(s.budget)}</dd>
              <dt className="text-slate-500">Montant reçu</dt><dd className="font-bold text-slate-900 text-right tabular-nums">{f(s.paiement.recu)}</dd>
              <dt className="text-slate-500">Reçu le</dt><dd className="text-right">{date(s.paiement.recuLe)}</dd>
              {s.paiement.reference && <><dt className="text-slate-500">Référence</dt><dd className="text-right font-mono">{s.paiement.reference}</dd></>}
              <dt className="text-slate-500">Période</dt><dd className="text-right">{s.paiement.activeeLe ? `${date(s.commenceLe)} → ${date(s.finitLe)}` : 'Démarre à l’activation'}</dd>
            </dl>
            <p className="px-5 pb-5 text-xs text-slate-500">Édité le {date(new Date().toISOString())}. Pour toute question, donnez le numéro du reçu à Suguba.</p>
          </article>
          <div className="print:hidden">
            <Button fullWidth onClick={() => window.print()}><Printer className="w-4 h-4" />Imprimer / enregistrer en PDF</Button>
          </div>
        </>
      )}
    </PageReseau>
  );
}
