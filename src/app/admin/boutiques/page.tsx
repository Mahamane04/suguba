'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, ExternalLink, Plus, Crown, Search, Loader2, UserPlus } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { useToast } from '@/components/ui/Toast';

/**
 * Toutes les boutiques (§ page 44). Une boutique masquée ou suspendue n'est plus publique.
 *
 * Ajouts du 2026-09-24 : demandes de formules Pro (activer après paiement
 * Mobile Money, ou refuser) et création d'une boutique pour un revendeur ou
 * un fournisseur — compte existant, ou nouveau compte créé ici.
 */

const TYPE: Record<string, string> = { supplier: 'Fournisseur', reseller: 'Revendeur', suguba: 'Suguba' };
const STATUT: Record<string, [string, 'succes' | 'attente' | 'danger']> = { active: ['Publique', 'succes'], hidden: ['Masquée', 'attente'], suspended: ['Suspendue', 'danger'] };
const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

interface Plan { id: string; formuleNom: string; boutiquesMax: number; prixMensuel: number; statut: string; reference: string; expireLe: string | null; type: string; nomCompte: string | null }
interface Compte { id: string; nom: string; email: string | null; telephone: string | null; roles: string[] }

export default function BoutiquesAdminPage() {
  const { toast, confirmer } = useToast();
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [creation, setCreation] = useState(false);

  const charger = React.useCallback(() => fetch('/api/admin/boutiques').then((r) => r.json())
    .then((d) => { if (d.error) toast(d.error, { ton: 'erreur' }); setBoutiques(d.boutiques || []); setPlans(d.plans || []); })
    .catch(() => undefined).finally(() => setChargement(false)), [toast]);
  useEffect(() => { charger(); }, [charger]);

  const poster = async (corps: Record<string, unknown>, succes: string) => {
    const r = await fetch('/api/admin/boutiques', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur' }); return false; }
    toast(succes, { ton: 'succes' });
    await charger();
    return true;
  };

  const changer = (id: string, statut: string) => poster({ id, statut }, 'Boutique mise à jour.');

  const decider = async (p: Plan, decision: 'activer' | 'refuser') => {
    const ok = await confirmer({
      titre: decision === 'activer' ? `Activer « ${p.formuleNom} » pour 30 jours ?` : `Refuser la demande « ${p.formuleNom} » ?`,
      message: decision === 'activer' ? `Vérifiez d’abord la réception de ${enF(p.prixMensuel)} avec la référence ${p.reference}.` : undefined,
      confirmer: decision === 'activer' ? 'Activer' : 'Refuser', danger: decision === 'refuser',
    });
    if (ok) await poster({ action: 'formule', planId: p.id, decision }, decision === 'activer' ? 'Formule activée pour 30 jours.' : 'Demande refusée.');
  };

  const demandes = plans.filter((p) => p.statut === 'demande');
  const actives = plans.filter((p) => p.statut === 'active');
  const visibles = boutiques.filter((b) => !filtre || b.type === filtre);

  return (
    <PageReseau titre="Boutiques" sousTitre="Toutes les vitrines du réseau." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }} large
      action={<Button size="sm" onClick={() => setCreation(!creation)}><Plus className="w-4 h-4" />Créer une boutique</Button>}>

      {creation && <CreerBoutique onFait={async () => { setCreation(false); await charger(); }} />}

      {(demandes.length > 0 || actives.length > 0) && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Crown className="w-4 h-4 text-suguba-profond" />Formules Pro</h2>
          {demandes.length > 0 && <p className="text-xs text-slate-600">À activer après réception du paiement Mobile Money avec la référence indiquée.</p>}
          <ul className="divide-y divide-slate-100">
            {[...demandes, ...actives].map((p) => (
              <li key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{p.nomCompte || 'Compte'} · {p.formuleNom}</p>
                  <p className="text-xs text-slate-500">
                    {TYPE[p.type] || p.type} · {enF(p.prixMensuel)}/mois · {p.boutiquesMax} boutiques · réf. <strong className="tracking-wider">{p.reference}</strong>
                    {p.expireLe && p.statut === 'active' ? ` · jusqu’au ${new Date(p.expireLe).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                {p.statut === 'demande' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decider(p, 'activer')}>Activer 30 jours</Button>
                    <Button size="sm" variant="danger" onClick={() => decider(p, 'refuser')}>Refuser</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <StatusPill ton="succes">Active</StatusPill>
                    <Button size="sm" variant="ghost" onClick={() => decider(p, 'activer')}>Prolonger 30 jours</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[['', 'Toutes'], ['supplier', 'Fournisseurs'], ['reseller', 'Revendeurs'], ['suguba', 'Suguba']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltre(v)} className={`px-4 h-10 rounded-full text-xs font-semibold whitespace-nowrap ${filtre === v ? 'bg-suguba-profond text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{l}</button>
        ))}
      </div>
      {chargement ? <Skeleton className="h-32" /> : visibles.length === 0 ? (
        <EmptyState icone={Store} titre="Aucune boutique" />
      ) : (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {visibles.map((b) => {
            const [libelle, ton] = STATUT[b.statut] || [b.statut, 'attente'];
            return (
              <div key={b.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{b.nom}</p>
                    <p className="text-xs text-slate-500">{TYPE[b.type] || b.type}{b.principale ? '' : ' · boutique supplémentaire'} · /{b.slug} · {b.abonnes} abonné{b.abonnes > 1 ? 's' : ''}</p>
                  </div>
                  <StatusPill ton={ton}>{libelle}</StatusPill>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                  <Link href={`/boutique/${b.slug}`} target="_blank" className="inline-flex items-center gap-1 text-slate-600 min-h-[32px]"><ExternalLink className="w-3.5 h-3.5" />Voir</Link>
                  {b.statut !== 'active' && <button onClick={() => changer(b.id, 'active')} className="text-suguba-brand-dark min-h-[32px]">Rendre publique</button>}
                  {b.statut !== 'hidden' && <button onClick={() => changer(b.id, 'hidden')} className="text-amber-700 min-h-[32px]">Masquer</button>}
                  {b.statut !== 'suspended' && <button onClick={() => changer(b.id, 'suspended')} className="text-rose-700 min-h-[32px]">Suspendre</button>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </PageReseau>
  );
}

/** Créer une boutique pour un compte existant, ou un nouveau compte avec sa boutique. */
function CreerBoutique({ onFait }: { onFait: () => Promise<void> }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'existant' | 'nouveau'>('existant');
  const [recherche, setRecherche] = useState('');
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [compte, setCompte] = useState<Compte | null>(null);
  const [type, setType] = useState<'reseller' | 'supplier'>('supplier');
  const [f, setF] = useState({ nom: '', email: '', telephone: '', nomBoutique: '', quartier: '' });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (mode !== 'existant' || recherche.trim().length < 2) { setComptes([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/boutiques?compte=${encodeURIComponent(recherche.trim())}`).then((r) => r.json()).then((d) => setComptes(d.comptes || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [recherche, mode]);

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const corps = mode === 'existant'
        ? { action: 'creer', proprietaireId: compte?.id, type, nom: f.nomBoutique, quartier: f.quartier || null }
        : { action: 'creer_compte', type, nom: f.nom, email: f.email, telephone: f.telephone, nomBoutique: f.nomBoutique || f.nom, quartier: f.quartier || null };
      const r = await fetch('/api/admin/boutiques', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Création impossible.', { ton: 'erreur' }); return; }
      toast(mode === 'nouveau' ? `Compte et boutique créés. La personne se connecte avec ${f.email}.` : 'Boutique créée.', { ton: 'succes' });
      await onFait();
    } finally { setEnvoi(false); }
  };

  const typesPossibles = compte ? (['reseller', 'supplier'] as const).filter((t) => compte.roles.includes(t)) : (['reseller', 'supplier'] as const);

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pour qui">
        {([['existant', 'Compte existant', Search], ['nouveau', 'Nouveau compte', UserPlus]] as const).map(([v, l, Icone]) => (
          <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); setCompte(null); }}
            className={`rounded-2xl border p-3 text-left text-sm font-semibold flex items-center gap-2 ${mode === v ? 'border-suguba-profond bg-suguba-menthe' : 'border-slate-200'}`}>
            <Icone className="w-4 h-4" />{l}
          </button>
        ))}
      </div>

      {mode === 'existant' ? (
        compte ? (
          <div className="rounded-2xl bg-suguba-sauge p-3 flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-900 truncate">{compte.nom}</p>
              <p className="text-xs text-slate-500 truncate">{compte.email || compte.telephone} · {compte.roles.map((r) => TYPE[r] || r).join(', ') || 'aucun profil'}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCompte(null)}>Changer</Button>
          </div>
        ) : (
          <Field label="Chercher le compte (nom, e-mail ou téléphone)" htmlFor="cb-recherche">
            <Input id="cb-recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Ex. : Awa, awa@…, 76…" />
            {comptes.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {comptes.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setCompte(c); setType(c.roles.includes('supplier') ? 'supplier' : 'reseller'); }} className="w-full text-left p-2.5 text-sm hover:bg-suguba-sauge">
                      <span className="font-semibold text-slate-900">{c.nom}</span>
                      <span className="block text-xs text-slate-500">{c.email || c.telephone} · {c.roles.map((r) => TYPE[r] || r).join(', ') || 'aucun profil'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nom de la personne" htmlFor="cb-nom" requis><Input id="cb-nom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="E-mail (pour se connecter)" htmlFor="cb-email" requis><Input id="cb-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Téléphone WhatsApp" htmlFor="cb-tel" requis><Input id="cb-tel" type="tel" inputMode="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} placeholder="+223…" /></Field>
        </div>
      )}

      {(mode === 'nouveau' || compte) && (
        <>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de boutique">
            {(['supplier', 'reseller'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} disabled={!typesPossibles.includes(t)} onClick={() => setType(t)}
                className={`rounded-2xl border p-3 text-sm font-semibold disabled:opacity-40 ${type === t ? 'border-suguba-profond bg-suguba-menthe' : 'border-slate-200'}`}>
                Boutique {TYPE[t].toLowerCase()}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom de la boutique" htmlFor="cb-boutique" requis={mode === 'existant'}>
              <Input id="cb-boutique" value={f.nomBoutique} onChange={(e) => setF({ ...f, nomBoutique: e.target.value })} placeholder={mode === 'nouveau' ? 'Par défaut : le nom de la personne' : ''} />
            </Field>
            <Field label="Quartier" htmlFor="cb-quartier">
              <NeighborhoodPicker id="cb-quartier" value={f.quartier} onChange={(q) => setF({ ...f, quartier: q === 'Autre quartier' ? '' : q })} placeholder="Choisir un quartier" />
            </Field>
          </div>
          <Button onClick={envoyer} disabled={envoi || (mode === 'existant' ? f.nomBoutique.trim().length < 2 : !f.nom || !f.email || !f.telephone)} fullWidth>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {mode === 'nouveau' ? 'Créer le compte et la boutique' : 'Créer la boutique'}
          </Button>
          <p className="text-xs text-slate-500">
            Créée par l’admin, la boutique peut dépasser la limite de la formule du compte.
            {mode === 'nouveau' ? ' La personne se connecte ensuite avec « Continuer avec Google » ou « Recevoir mon lien » sur cet e-mail.' : ''}
          </p>
        </>
      )}
    </Card>
  );
}
