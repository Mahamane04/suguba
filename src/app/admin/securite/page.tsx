'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, LogOut } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

interface Membre { id: string; nom: string; role: string; mfa: boolean | null; connexions: { le: string; appareil: string; aal: string | null }[]; deconnecteLe: string | null }
interface Donnees { reglages: { mfaObligatoire: boolean; seuilValidation: number; disponible: boolean }; membres: Membre[] }

const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** « Chrome sur Windows » plutôt qu'un agent utilisateur illisible. */
function appareil(ua: string): string {
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua) ? 'Mac' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${nav} sur ${os}` : nav;
}

/**
 * Sécurité de l'équipe (A3, 2026-09-27) : double authentification (qui l'a
 * activée, la rendre obligatoire), seuil de double validation, dernières
 * connexions de chaque membre et « Déconnecter partout ».
 */
export default function SecuritePage() {
  const { toast, confirmer } = useToast();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState('');
  const [mfa, setMfa] = useState(false);
  const [seuil, setSeuil] = useState('0');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    fetch('/api/admin/securite', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j as Donnees; })
      .then((j) => { setD(j); setMfa(j.reglages.mfaObligatoire); setSeuil(String(j.reglages.seuilValidation)); })
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function enregistrer() {
    if (mfa && d && !d.reglages.mfaObligatoire) {
      const ok = await confirmer({
        titre: 'Rendre la double authentification obligatoire ?',
        message: 'À leur prochaine connexion, les membres qui ne l’ont pas encore activée devront le faire (application d’authentification sur leur téléphone). Activez d’abord la vôtre.',
        confirmer: 'Rendre obligatoire',
      });
      if (!ok) return;
    }
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/securite', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reglages', mfaObligatoire: mfa, seuilValidation: Number(seuil.replace(/\D/g, '')) || 0 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      toast('Réglages de sécurité enregistrés.', { ton: 'succes' }); charger();
    } finally { setEnvoi(false); }
  }

  async function deconnecter(m: Membre) {
    const ok = await confirmer({ titre: `Déconnecter ${m.nom} partout ?`, message: 'Toutes ses sessions ouvertes (ordinateurs, téléphones) sont fermées immédiatement. Il pourra se reconnecter s’il fait toujours partie de l’équipe.', confirmer: 'Déconnecter' });
    if (!ok) return;
    const r = await fetch('/api/admin/securite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deconnecter', membreId: m.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Déconnexion impossible.', { ton: 'erreur' }); return; }
    toast(`${m.nom} est déconnecté partout.`, { ton: 'succes' }); charger();
  }

  return (
    <PageReseau titre="Sécurité de l’équipe" large sousTitre="Double authentification, double validation, connexions.">
      {erreur ? <EmptyState icone={ShieldAlert} titre="Indisponible" texte={erreur} />
        : !d ? <Skeleton className="h-64" />
        : (
          <>
            {!d.reglages.disponible && <Card className="!bg-amber-50 !border-amber-200 text-xs text-amber-900">Exécutez le SQL A-EXECUTER-2026-09-27-admin-a3.sql pour activer ces réglages.</Card>}
            <Card className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Réglages</h2>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={mfa} onChange={(e) => setMfa(e.target.checked)} className="mt-1 w-5 h-5" />
                <span className="text-sm text-slate-800"><strong>Double authentification obligatoire</strong> pour tous les membres de l’équipe.
                  <span className="block text-xs text-slate-500">Un membre qui l’a activée doit déjà saisir son code à chaque connexion.</span></span>
              </label>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{Number(seuil) > 0 ? 'Double approbation activée' : 'Double approbation désactivée'}</p>
                <label htmlFor="seuil" className="block text-sm font-bold text-slate-800">Double validation à partir de (F CFA)</label>
                <input id="seuil" inputMode="numeric" value={seuil} onChange={(e) => setSeuil(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-48 h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold tabular-nums" />
                <p className="text-xs text-slate-500">Paiement d’un retrait ou avance de commission à partir de ce montant, et toute baisse de la part Suguba : une personne prépare, un collègue approuve (Approbations financières). Saisir 0 désactive cette protection.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={enregistrer} disabled={envoi}>Enregistrer</Button>
                <Button href="/securite/double-authentification?suite=%2Fadmin%2Fsecurite" variant="ghost">Activer ma double authentification</Button>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr><th className="px-3 py-2 font-bold">Membre</th><th className="px-3 py-2 font-bold">Double authentification</th><th className="px-3 py-2 font-bold hidden md:table-cell">Dernières connexions</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.membres.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className="px-3 py-2"><p className="font-bold text-slate-900">{m.nom}</p><p className="text-xs text-slate-500">{m.role}</p></td>
                      <td className="px-3 py-2">
                        {m.mfa === true ? <StatusPill ton="succes"><ShieldCheck className="w-3 h-3" />Activée</StatusPill>
                          : m.mfa === false ? <StatusPill ton="attente">Pas encore</StatusPill> : <StatusPill ton="neutre">Inconnue</StatusPill>}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-600">
                        {m.connexions.length ? m.connexions.map((c) => <p key={c.le}>{date(c.le)} · {appareil(c.appareil)}{c.aal === 'aal2' ? ' · code vérifié' : ''}</p>) : <p>Aucune enregistrée</p>}
                        {m.deconnecteLe && <p className="text-amber-700">Déconnecté partout le {date(m.deconnecteLe)}</p>}
                      </td>
                      <td className="px-3 py-2 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => deconnecter(m)}><LogOut className="w-4 h-4" />Déconnecter partout</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="text-xs text-slate-500">Retirer quelqu’un de l’équipe : <Link href="/admin/equipe" className="underline">Équipe et permissions</Link>, puis « Déconnecter partout ».</p>
          </>
        )}
    </PageReseau>
  );
}
