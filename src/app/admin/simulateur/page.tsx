'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';

interface Champ { cle: string; titre: string; unite: string; actuel: number }
interface Ligne { id: string; nom: string; prix: number; avant: { commission: number; margeNette: number; partageable: boolean }; apres: { commission: number; margeNette: number; partageable: boolean } }
interface Reponse { champs: Champ[]; erreurs: string[]; lignes: Ligne[]; totaux: { margeNetteAvant: number; margeNetteApres: number; commissionsAvant: number; commissionsApres: number; nonPartageablesAvant: number; nonPartageablesApres: number } }

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const ecart = (a: number, b: number) => (b === a ? '' : `${b > a ? '+' : '−'}${fcfa(Math.abs(b - a))}`);

/**
 * Simulateur de réglages (A5, 2026-09-27) : l'effet d'un changement sur les
 * 40 derniers produits en vente, avant / après. RIEN n'est enregistré ;
 * appliquer se fait dans « Paramètres et commissions ».
 */
export default function SimulateurPage() {
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const simuler = (modifs: Record<string, string>) => {
    setEnvoi(true); setErreur('');
    const propres = Object.fromEntries(Object.entries(modifs).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v.replace(',', '.'))]));
    fetch(`/api/admin/simulateur?modifs=${encodeURIComponent(JSON.stringify(propres))}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Simulation impossible.'); return j as Reponse; })
      .then(setDonnees)
      .catch((e) => setErreur((e as Error).message))
      .finally(() => setEnvoi(false));
  };
  useEffect(() => { simuler({}); }, []);

  return (
    <PageReseau titre="Simulateur de réglages" large sousTitre="Tester un changement sur les produits en vente, sans rien enregistrer.">
      <Card className="!bg-amber-50 !border-amber-200 text-xs text-amber-900">Simulation : aucun réglage, prix ni commission n’est modifié. Pour appliquer, allez dans <Link href="/admin#reglages" className="underline font-bold">Paramètres et commissions</Link>.</Card>
      {erreur ? <EmptyState icone={Calculator} titre="Simulation impossible" texte={erreur} />
        : !donnees ? <Skeleton className="h-64" />
        : (
          <>
            <Card className="space-y-3">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {donnees.champs.map((c) => (
                  <label key={c.cle} className="text-xs font-bold text-slate-700">
                    {c.titre} <span className="font-normal text-slate-500">({c.unite}, actuel {c.actuel.toLocaleString('fr-FR')})</span>
                    <input inputMode="decimal" value={valeurs[c.cle] ?? ''} placeholder={String(c.actuel)}
                      onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value.replace(/[^\d.,]/g, '') }))}
                      className="block w-full mt-1 h-10 px-3 rounded-xl border border-slate-300 text-sm tabular-nums" />
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => simuler(valeurs)} disabled={envoi}>{envoi ? 'Calcul…' : 'Simuler'}</Button>
                <Button type="button" variant="ghost" onClick={() => { setValeurs({}); simuler({}); }}>Revenir aux réglages actuels</Button>
              </div>
              {donnees.erreurs.length > 0 && <p role="alert" className="text-xs font-semibold text-rose-700">Réglages impossibles : {donnees.erreurs.join(' ')}</p>}
            </Card>
            <div className="grid sm:grid-cols-3 gap-3">
              <Card><p className="text-xs text-slate-500">Marge nette Suguba (1 vente de chaque)</p><p className="text-lg font-bold tabular-nums">{fcfa(donnees.totaux.margeNetteApres)}</p><p className="text-xs text-slate-600">avant {fcfa(donnees.totaux.margeNetteAvant)} {ecart(donnees.totaux.margeNetteAvant, donnees.totaux.margeNetteApres)}</p></Card>
              <Card><p className="text-xs text-slate-500">Commissions revendeurs</p><p className="text-lg font-bold tabular-nums">{fcfa(donnees.totaux.commissionsApres)}</p><p className="text-xs text-slate-600">avant {fcfa(donnees.totaux.commissionsAvant)} {ecart(donnees.totaux.commissionsAvant, donnees.totaux.commissionsApres)}</p></Card>
              <Card><p className="text-xs text-slate-500">Produits non proposés aux revendeurs</p><p className="text-lg font-bold tabular-nums">{donnees.totaux.nonPartageablesApres}</p><p className="text-xs text-slate-600">avant {donnees.totaux.nonPartageablesAvant}</p></Card>
            </div>
            <Card className="!p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600"><tr><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Prix</th><th className="px-3 py-2">Commission</th><th className="px-3 py-2">Marge nette Suguba</th><th className="px-3 py-2">Revendeurs</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {donnees.lignes.map((l) => (
                    <tr key={l.id} className={l.avant.margeNette !== l.apres.margeNette || l.avant.commission !== l.apres.commission ? 'bg-amber-50/40' : ''}>
                      <td className="px-3 py-2 max-w-[16rem] truncate">{l.nom}</td>
                      <td className="px-3 py-2 tabular-nums">{fcfa(l.prix)}</td>
                      <td className="px-3 py-2 tabular-nums">{fcfa(l.apres.commission)} <span className="text-xs text-slate-500">{ecart(l.avant.commission, l.apres.commission)}</span></td>
                      <td className={`px-3 py-2 tabular-nums ${l.apres.margeNette < 0 ? 'text-rose-700 font-bold' : ''}`}>{fcfa(l.apres.margeNette)} <span className="text-xs text-slate-500">{ecart(l.avant.margeNette, l.apres.margeNette)}</span></td>
                      <td className="px-3 py-2 text-xs">{l.apres.partageable ? 'Proposé' : 'Non proposé'}{l.avant.partageable !== l.apres.partageable ? ' (change)' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
    </PageReseau>
  );
}
