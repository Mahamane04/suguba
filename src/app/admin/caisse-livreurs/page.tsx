'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import RecuVersementModal from '@/components/common/RecuVersementModal';
import { calculerAVerser, niveauRetard, type CaisseLivreur, type Versement } from '@/lib/caisse-livreur';
import { AlertTriangle, ArrowLeft, Banknote, ChevronDown, Phone, Receipt, RefreshCw, Settings } from 'lucide-react';

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const jour = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

interface Donnees {
  caisses: CaisseLivreur[];
  migrationRequise: boolean;
  remunerationParCourse: number;
  livreurGardeRemuneration: boolean;
  delaiHeures: number;
}

/**
 * Caisse livreurs (2026-09-25) : ce que chaque livreur a encaissé en espèces
 * et doit remettre à Suguba, l'enregistrement des versements reçus et leurs
 * reçus. Avant, rien ne permettait de vérifier qu'un livreur avait versé.
 */
export default function CaisseLivreursPage() {
  const { toast } = useToast();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState<Record<string, boolean>>({});
  const [saisiePour, setSaisiePour] = useState<CaisseLivreur | null>(null);
  const [recu, setRecu] = useState<{ v: Versement; nom: string; tel: string | null } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await fetch('/api/admin/caisse-livreurs', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Chargement impossible.');
      setD(j);
      setErreur(null);
      return j as Donnees;
    } catch (e) {
      setErreur((e as Error).message);
      return null;
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const totalAttendu = (d?.caisses || []).reduce((t, c) => t + Math.max(0, c.aVerser - c.ecartCumule), 0);
  const enRetard = (d?.caisses || []).filter((c) => niveauRetard(c.plusAncienne, d?.delaiHeures || 24) !== 'ok').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" /> Retour à la console
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Caisse livreurs</h1>
            <p className="text-xs text-slate-500">Les espèces encaissées à la livraison, et ce que chaque livreur a remis à Suguba.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => charger()} disabled={chargement}>
            <RefreshCw className={`w-4 h-4 ${chargement ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>

        {erreur && <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{erreur}</p>}

        {d?.migrationRequise && (
          <div role="status" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
            <p className="font-bold">La caisse n’est pas encore installée.</p>
            <p>Exécutez le fichier <code className="font-mono text-xs">supabase/A-EXECUTER-2026-09-25-caisse-livreurs.sql</code> dans le SQL Editor de Supabase, puis actualisez.</p>
          </div>
        )}

        {d && !d.migrationRequise && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-3xl bg-slate-900 text-white space-y-1">
                <p className="text-xs font-bold uppercase text-slate-300">Attendu à la caisse</p>
                <p className="text-2xl font-bold">{fmt(totalAttendu)}</p>
                <p className="text-xs text-slate-300">Tous livreurs confondus</p>
              </div>
              <div className={`p-4 rounded-3xl border space-y-1 ${enRetard ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-bold uppercase text-slate-500">En retard</p>
                <p className="text-2xl font-bold text-slate-900">{enRetard}</p>
                <p className="text-xs text-slate-500">Espèces gardées plus de {d.delaiHeures} h</p>
              </div>
              <Link href="/admin#reglages" className="p-4 rounded-3xl bg-white border border-slate-200 hover:border-slate-300 space-y-1 block">
                <p className="text-xs font-bold uppercase text-slate-500 inline-flex items-center gap-1"><Settings className="w-3.5 h-3.5" /> Règle en vigueur</p>
                <p className="text-sm font-bold text-slate-900">
                  {d.livreurGardeRemuneration ? `Le livreur garde ${fmt(d.remunerationParCourse)} par course` : 'Le livreur verse tout'}
                </p>
                <p className="text-xs text-slate-500">Modifier dans Paramètres › Livraison</p>
              </Link>
            </div>

            {d.caisses.length === 0 ? (
              <EmptyState icon={Banknote} title="Aucune espèce en attente." />
            ) : (
              <div className="space-y-3">
                {d.caisses.map((c) => {
                  const retard = niveauRetard(c.plusAncienne, d.delaiHeures);
                  const du = Math.max(0, c.aVerser - c.ecartCumule);
                  const deplie = ouvert[c.driverId];
                  return (
                    <section key={c.driverId} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-bold text-slate-900 truncate">{c.nom}</p>
                          {c.telephone && (
                            <a href={`tel:${c.telephone}`} className="text-xs text-slate-600 inline-flex items-center gap-1 hover:underline">
                              <Phone className="w-3 h-3" /> {c.telephone}
                            </a>
                          )}
                          {retard !== 'ok' && (
                            <p className={`text-xs font-bold flex items-center gap-1 ${retard === 'grave' ? 'text-rose-700' : 'text-amber-700'}`}>
                              <AlertTriangle className="w-3.5 h-3.5" /> Espèces du {jour(c.plusAncienne)} non versées
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-500">À verser</p>
                          <p className={`text-xl font-bold ${du > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>{fmt(du)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>{c.commandes.length} commande{c.commandes.length > 1 ? 's' : ''} en espèces : {fmt(c.especes)}</span>
                        {c.garde > 0 && <span>Rémunération gardée : − {fmt(c.garde)}</span>}
                        {c.ecartCumule < 0 && <span className="text-rose-700 font-semibold">Manque précédent : {fmt(-c.ecartCumule)}</span>}
                        {c.ecartCumule > 0 && <span className="text-emerald-700 font-semibold">Avance : {fmt(c.ecartCumule)}</span>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(c.commandes.length > 0 || c.ecartCumule < 0) && (
                          <Button size="sm" onClick={() => setSaisiePour(c)}>
                            <Banknote className="w-4 h-4" /> Enregistrer un versement
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setOuvert((o) => ({ ...o, [c.driverId]: !o[c.driverId] }))} aria-expanded={deplie}>
                          Détail et historique <ChevronDown className={`w-4 h-4 transition-transform ${deplie ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>

                      {deplie && (
                        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-slate-700">Commandes non versées</p>
                            {c.commandes.length === 0 ? <p className="text-xs text-slate-500">Aucune.</p> : c.commandes.map((o) => (
                              <div key={o.id} className="flex justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-slate-700">#{o.orderNumber} · {jour(o.deliveredAt)}</span>
                                <span className="font-semibold text-slate-900 shrink-0">{fmt(o.totalAmount)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-slate-700">Versements reçus</p>
                            {c.versements.length === 0 ? <p className="text-xs text-slate-500">Aucun pour l’instant.</p> : c.versements.slice(0, 20).map((v) => (
                              <button key={v.id} type="button" onClick={() => setRecu({ v, nom: c.nom, tel: c.telephone })}
                                className="w-full flex justify-between items-center gap-2 text-xs rounded-xl hover:bg-slate-50 px-1.5 py-1 text-left">
                                <span className="min-w-0 truncate text-slate-700 inline-flex items-center gap-1">
                                  <Receipt className="w-3.5 h-3.5 shrink-0" /> {jour(v.createdAt)} · {v.remittanceNumber}
                                </span>
                                <span className={`font-semibold shrink-0 ${v.difference < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{fmt(v.amountReceived)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {saisiePour && d && (
        <SaisieVersement
          caisse={saisiePour}
          parCourse={d.remunerationParCourse}
          onFermer={() => setSaisiePour(null)}
          onEnregistre={async (id) => {
            const caisse = saisiePour;
            setSaisiePour(null);
            toast('Versement enregistré', { ton: 'succes' });
            const frais = await charger();
            const v = frais?.caisses.find((c) => c.driverId === caisse.driverId)?.versements.find((x) => x.id === id);
            if (v) setRecu({ v, nom: caisse.nom, tel: caisse.telephone });
          }}
        />
      )}

      <RecuVersementModal versement={recu?.v || null} nomLivreur={recu?.nom || ''} telephoneLivreur={recu?.tel} onClose={() => setRecu(null)} />

      <BottomNav />
    </div>
  );
}

function SaisieVersement({ caisse, parCourse, onFermer, onEnregistre }: {
  caisse: CaisseLivreur;
  parCourse: number;
  onFermer: () => void;
  onEnregistre: (id: string) => void;
}) {
  const [choisies, setChoisies] = useState<Set<string>>(() => new Set(caisse.commandes.map((o) => o.id)));
  const lot = useMemo(() => caisse.commandes.filter((o) => choisies.has(o.id)), [caisse.commandes, choisies]);
  const calc = calculerAVerser(lot.map((o) => o.totalAmount), parCourse, lot.filter((o) => !o.parFournisseur).length);
  const manque = Math.max(0, -caisse.ecartCumule);
  const [recu, setRecu] = useState(String(calc.aVerser + manque));
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le montant proposé suit la sélection tant que l'admin ne l'a pas modifié à la main.
  const [modifie, setModifie] = useState(false);
  useEffect(() => { if (!modifie) setRecu(String(calc.aVerser + manque)); }, [calc.aVerser, manque, modifie]);

  const montant = Number(recu.replace(/\s/g, ''));
  const attendu = calc.aVerser + manque;
  const reste = attendu - montant;
  const bilan = !Number.isFinite(montant) ? undefined
    : reste > 0 ? `Il manquera ${fmt(reste)} : le manque restera inscrit sur son compte.`
      : reste < 0 ? `${fmt(-reste)} de plus : comptés comme avance.`
        : manque > 0 ? 'Couvre aussi le manque précédent : compte soldé.' : 'Compte soldé.';

  const basculer = (id: string) => setChoisies((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // Confirmation en deux temps DANS la feuille : la fenêtre de confirmation
  // commune (useToast) s'ouvrirait derrière elle, sur une page rendue inerte.
  const [aConfirmer, setAConfirmer] = useState(false);
  useEffect(() => { setAConfirmer(false); }, [recu, choisies]);

  const verifier = () => {
    setErreur(null);
    if (!recu.trim() || !Number.isFinite(montant) || montant < 0) { setErreur('Saisissez le montant reçu.'); return; }
    if (lot.length === 0 && montant === 0) { setErreur('Choisissez des commandes ou saisissez un montant.'); return; }
    setAConfirmer(true);
  };

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/caisse-livreurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: caisse.driverId, orderIds: lot.map((o) => o.id), montantRecu: montant, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Enregistrement impossible.');
      onEnregistre(j.id);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Sheet ouvert onFermer={onFermer} titre={`Versement de ${caisse.nom}`} sousTitre="Cochez les commandes dont il remet l’argent."
      pied={aConfirmer ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-800 text-center">
            Confirmer <strong>{fmt(montant)}</strong> reçus en main de {caisse.nom} ?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setAConfirmer(false)} disabled={envoi}>Modifier</Button>
            <Button onClick={enregistrer} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Confirmer'}</Button>
          </div>
        </div>
      ) : (
        <Button fullWidth onClick={verifier}>{`Enregistrer ${Number.isFinite(montant) ? fmt(montant) : ''}`}</Button>
      )}>
      <div className="space-y-4">
        {caisse.commandes.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="text-xs font-bold text-slate-700 mb-1">Commandes ({lot.length}/{caisse.commandes.length})</legend>
            {caisse.commandes.map((o) => (
              <label key={o.id} className="flex items-center gap-3 min-h-11 rounded-xl px-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={choisies.has(o.id)} onChange={() => basculer(o.id)} className="w-5 h-5 accent-suguba-profond" />
                <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">#{o.orderNumber} · {jour(o.deliveredAt)}</span>
                <span className="text-sm font-semibold text-slate-900">{fmt(o.totalAmount)}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Espèces encaissées</span><span>{fmt(calc.especes)}</span></div>
          {calc.garde > 0 && <div className="flex justify-between text-slate-600"><span>Rémunération gardée ({lot.filter((o) => !o.parFournisseur).length} × {fmt(parCourse)})</span><span>− {fmt(calc.garde)}</span></div>}
          <div className="flex justify-between font-bold"><span>Dû pour ces commandes</span><span>{fmt(calc.aVerser)}</span></div>
          {manque > 0 && <div className="flex justify-between text-rose-700"><span>Manque précédent</span><span>{fmt(manque)}</span></div>}
        </div>

        <Field label="Montant reçu en main" requis aide={bilan}>
          <Input inputMode="numeric" value={recu} onChange={(e) => { setModifie(true); setRecu(e.target.value.replace(/[^\d\s]/g, '')); }} />
        </Field>
        <Field label="Note (facultatif)">
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex. versé au guichet ACI" />
        </Field>
        {erreur && <p role="alert" className="text-sm font-semibold text-rose-700">{erreur}</p>}
      </div>
    </Sheet>
  );
}
