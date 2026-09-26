'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Network, Save, Search } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface Reglages {
  annuaireFournisseurs: boolean;
  venteDirecteFournisseurs: boolean;
  fournisseursVenteDirecte: string[];
  protectionPrixDeGros: boolean;
}
interface Fournisseur { id: string; nom: string; slug: string | null }

/**
 * Priorité au réseau de revendeurs (2026-09-26, lot C). Les boutiques
 * revendeurs sont les vitrines de vente ; les fournisseurs se présentent
 * sans devenir une caisse concurrente, sauf ouverture décidée ici.
 * Une ouverture ne modifie jamais une commande déjà passée.
 */
export default function PrioriteReseauPage() {
  const { toast } = useToast();
  const [r, setR] = useState<Reglages | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [modifie, setModifie] = useState(false);
  const [filtre, setFiltre] = useState('');

  useEffect(() => {
    fetch('/api/admin/priorite-reseau', { cache: 'no-store' })
      .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setR(j.reglages); setFournisseurs(j.fournisseurs || []); })
      .catch((e) => setErreur((e as Error).message));
  }, []);

  const maj = (partiel: Partial<Reglages>) => { setR((x) => (x ? { ...x, ...partiel } : x)); setModifie(true); };
  const basculerFournisseur = (id: string) => maj({
    fournisseursVenteDirecte: r!.fournisseursVenteDirecte.includes(id)
      ? r!.fournisseursVenteDirecte.filter((x) => x !== id)
      : [...r!.fournisseursVenteDirecte, id],
  });

  const visibles = useMemo(() => {
    const t = filtre.trim().toLowerCase();
    return t ? fournisseurs.filter((f) => f.nom.toLowerCase().includes(t)) : fournisseurs;
  }, [fournisseurs, filtre]);

  const enregistrer = async () => {
    if (!r) return;
    setEnvoi(true);
    try {
      const res = await fetch('/api/admin/priorite-reseau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      setR(j.reglages); setModifie(false);
      toast('Réglages enregistrés.', { ton: 'succes' });
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PageReseau titre="Priorité au réseau" sousTitre="Qui vend aux clients : les revendeurs d’abord." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}>
      {erreur ? <EmptyState icone={Network} titre="Réglages indisponibles" texte={erreur} /> : !r ? <Skeleton className="h-64" /> : (
        <>
          <Card className="space-y-4">
            <Interrupteur
              titre="Boutiques fournisseurs dans l’annuaire client"
              detail="« Près de chez moi » et la recherche. Désactivé : seules les boutiques revendeurs et Suguba y apparaissent. Les liens directs vers une boutique fournisseur restent valables."
              actif={r.annuaireFournisseurs} onChange={(v) => maj({ annuaireFournisseurs: v })} />
            <Interrupteur
              titre="Achat direct dans les boutiques fournisseurs (tous)"
              detail="Désactivé : la boutique d’un fournisseur est une page de présentation, sans prix ni achat, qui renvoie vers les revendeurs partenaires. Vous pouvez l’ouvrir fournisseur par fournisseur ci-dessous."
              actif={r.venteDirecteFournisseurs} onChange={(v) => maj({ venteDirecteFournisseurs: v })} />
            <Interrupteur
              titre="Protéger les articles au prix de gros"
              detail="Un client arrivé sans revendeur choisit l’offre d’un revendeur, à son prix. L’achat au prix conseillé n’est possible que si aucun revendeur ne propose l’article."
              actif={r.protectionPrixDeGros} onChange={(v) => maj({ protectionPrixDeGros: v })} />
          </Card>

          {!r.venteDirecteFournisseurs && (
            <Card className="space-y-3">
              <p className="text-sm font-bold text-slate-900">Achat direct autorisé pour…</p>
              <p className="text-xs text-slate-600">
                À ouvrir seulement après avoir défini avec le fournisseur ses prix publics et le traitement des clients apportés par le réseau.
              </p>
              <label className="relative block">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher un fournisseur" aria-label="Rechercher un fournisseur"
                  className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-suguba-brand/30" />
              </label>
              {visibles.length === 0 ? <p className="text-xs text-slate-500">Aucun fournisseur.</p> : (
                <ul className="divide-y divide-slate-100">
                  {visibles.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{f.nom}</span>
                        {f.slug && <a href={`/s/${f.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-suguba-profond underline">Voir sa boutique</a>}
                      </span>
                      <Commutateur actif={r.fournisseursVenteDirecte.includes(f.id)} onChange={() => basculerFournisseur(f.id)} libelle={`Achat direct chez ${f.nom}`} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Button fullWidth onClick={enregistrer} disabled={envoi || !modifie}>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </Button>
          <p className="text-xs text-slate-500 text-center">Un changement ne modifie jamais une commande déjà passée ni ses commissions.</p>
        </>
      )}
    </PageReseau>
  );
}

function Interrupteur({ titre, detail, actif, onChange }: { titre: string; detail: string; actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{titre}</p>
        <p className="text-xs text-slate-600 mt-0.5">{detail}</p>
      </div>
      <Commutateur actif={actif} onChange={() => onChange(!actif)} libelle={titre} />
    </div>
  );
}

function Commutateur({ actif, onChange, libelle }: { actif: boolean; onChange: () => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} aria-label={libelle} onClick={onChange}
      className={`shrink-0 relative w-12 h-7 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-suguba-brand/40 ${actif ? 'bg-suguba-profond' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-5' : ''}`} />
    </button>
  );
}
