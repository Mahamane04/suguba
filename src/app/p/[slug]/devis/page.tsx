'use client';

import React, { use, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useSugubaStore } from '@/lib/store';
import { rememberDevisAccess } from '@/lib/order-access-client';
import { ArrowLeft, FileText } from 'lucide-react';
import { normaliserCodeRevendeur } from '@/lib/ancrage-revendeur';

/**
 * Demande de devis (2026-09-26, lot 1b) : pour une offre « sur devis » (kit
 * solaire à dimensionner, installation…), le client décrit son besoin ; le
 * fournisseur répond avec un prix que le client accepte ou refuse depuis son
 * téléphone. Aucun compte : la demande est liée à une clé gardée sur ce
 * téléphone, comme le reçu.
 */
export default function DemandeDevisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useSugubaStore();
  const product = state.products.find((p) => p.slug === slug);
  // Code du lien seulement : la provenance gardée sur l'appareil est
  // appliquée par le serveur, après le revendeur déjà rattaché (lot B).
  const refUrl = normaliserCodeRevendeur(searchParams.get('ref'));

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ville, setVille] = useState('Bamako');
  const [quartier, setQuartier] = useState('');
  const [repere, setRepere] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [besoin, setBesoin] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  // Une clé par formulaire : un double envoi rend la même demande.
  const cle = useRef<string | null>(null);

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10 space-y-3">
          <p className="text-sm text-slate-600">Chargement de l’offre…</p>
          <Link href="/" className="text-sm font-bold underline">Retour au catalogue</Link>
        </main>
      </div>
    );
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    if (!nom.trim() || !telephone.trim() || !quartier.trim() || besoin.trim().length < 10) {
      setErreur('Indiquez votre nom, votre téléphone, votre quartier et décrivez votre besoin.');
      return;
    }
    cle.current ||= crypto.randomUUID();
    setEnvoi(true);
    try {
      const r = await fetch('/api/devis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: cle.current,
          demande: {
            productId: product.id, customerName: nom, customerPhone: telephone, city: ville,
            neighborhood: quartier, landmark: repere, quantite, besoin, resellerCode: refUrl || undefined,
          },
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.quoteNumber) { setErreur(j?.error || 'Envoi impossible. Réessayez.'); return; }
      rememberDevisAccess(j.quoteNumber, cle.current);
      router.push(`/devis/${encodeURIComponent(j.quoteNumber)}`);
    } catch {
      setErreur('Connexion interrompue. Réessayez : votre demande ne sera pas envoyée deux fois.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-5 space-y-4">
        <Link href={`/p/${product.slug}${refUrl ? `?ref=${encodeURIComponent(refUrl)}` : ''}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> {product.name}
        </Link>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-suguba-profond" /> Demander un devis</h1>
          <p className="text-sm text-slate-600">
            Décrivez votre besoin : le vendeur vous répond avec un prix. Vous l’acceptez ou le refusez ici, sans engagement avant.
          </p>
        </div>

        {product.offreInclus && (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-700">
            <p className="text-xs font-bold text-slate-900 mb-1">Ce que propose le vendeur</p>
            <p className="whitespace-pre-line">{product.offreInclus}</p>
          </div>
        )}

        <form onSubmit={envoyer} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
          <Field label="Votre besoin" requis aide="Ex. : maison 3 pièces, 2 ventilateurs, 1 télé, 6 ampoules ; toit en tôle ; Kalaban-Coro.">
            <Textarea rows={4} maxLength={2000} value={besoin} onChange={(e) => setBesoin(e.target.value)} />
          </Field>
          <Field label="Quantité">
            <Input type="number" inputMode="numeric" min={1} max={50} value={quantite}
              onChange={(e) => setQuantite(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} />
          </Field>
          <Field label="Votre nom" requis><Input value={nom} maxLength={120} onChange={(e) => setNom(e.target.value)} autoComplete="name" /></Field>
          <Field label="Téléphone (WhatsApp)" requis aide="Le vendeur vous appelle pour préciser le besoin.">
            <Input type="tel" inputMode="tel" autoComplete="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex : 70 12 34 56" />
          </Field>
          <Field label="Ville" requis><Input value={ville} maxLength={80} onChange={(e) => { setVille(e.target.value); setQuartier(''); }} /></Field>
          <Field label="Quartier" requis>
            {ville.trim().toLowerCase() === 'bamako'
              ? <NeighborhoodPicker value={quartier} onChange={setQuartier} />
              : <Input value={quartier} maxLength={200} onChange={(e) => setQuartier(e.target.value)} />}
          </Field>
          <Field label="Repère (facultatif)"><Input value={repere} maxLength={500} onChange={(e) => setRepere(e.target.value)} /></Field>
          {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}
          <Button type="submit" fullWidth disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer ma demande'}</Button>
          <p className="text-xs text-slate-500 text-center">Gratuit et sans engagement. Votre demande reste sur ce téléphone.</p>
        </form>
      </main>
    </div>
  );
}
