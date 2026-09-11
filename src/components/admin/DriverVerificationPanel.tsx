'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Bike, MapPin } from 'lucide-react';

interface Livreur {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  dossierComplet: boolean;
  vehicleType: string | null;
  licensePlate: string | null;
  zone: string | null;
  pieceDeclaree: string | null;
  verifie: boolean;
  verifieLe: string | null;
  constat: string | null;
  livraisons: number;
}

/**
 * Vérification des livreurs au guichet de Bamako.
 *
 * Remplace l'ancien panneau d'approbation des inscriptions, qui demandait à
 * l'admin de valider des données que le candidat avait tapées lui-même — nom,
 * téléphone, numéro de pièce d'identité — sans aucun moyen de les recouper.
 * Cette approbation n'apportait pas de sécurité, seulement du délai.
 *
 * Ici, l'agent a vu la personne, sa moto et ses papiers. Ce qu'il valide,
 * ce n'est pas un formulaire : c'est une rencontre. Et il doit écrire ce
 * qu'il a constaté — sans quoi on retomberait dans le tampon en un clic.
 *
 * Ce panneau ne décide PAS de l'existence du compte, qui fonctionne depuis
 * l'inscription. Il décide du droit de recevoir des courses, donc de prendre
 * en charge des colis et de l'argent.
 */
export default function DriverVerificationPanel() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [cloud, setCloud] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [constat, setConstat] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch('/api/admin/drivers/roster');
      const json = await res.json();
      setLivreurs(json.livreurs || []);
      setCloud(json.cloud !== false);
    } catch {
      setLivreurs([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (id: string, verifie: boolean) => {
    setErreur('');
    setEnCours(id);
    try {
      const res = await fetch('/api/admin/drivers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id, verifie, note: constat }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreur(json.error || 'Échec de l\'enregistrement.');
        return;
      }
      setOuvert(null);
      setConstat('');
      await charger();
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnCours(null);
    }
  };

  const enAttente = livreurs.filter((l) => !l.verifie).length;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Bike className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Livreurs — vérification au guichet</h3>
            <p className="text-[11px] text-slate-500">
              {enAttente > 0
                ? `${enAttente} livreur${enAttente > 1 ? 's' : ''} à rencontrer`
                : 'Tous les livreurs inscrits ont été vérifiés'}
            </p>
          </div>
        </div>
        <button
          onClick={charger}
          className="text-[11px] font-bold text-slate-500 hover:text-slate-900"
        >
          Actualiser
        </button>
      </div>

      {!cloud && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          Base non configurée sur cet environnement.
        </p>
      )}

      {chargement ? (
        <div className="flex items-center space-x-2 text-xs text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Chargement…</span>
        </div>
      ) : livreurs.length === 0 ? (
        <p className="text-xs text-slate-500 py-4">Aucun livreur inscrit pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {livreurs.map((l) => (
            <div
              key={l.id}
              className={`rounded-2xl border p-4 space-y-3 ${
                l.verifie ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-sm text-slate-900 truncate">{l.fullName}</p>
                  <p className="text-[11px] text-slate-600 font-mono">{l.phone}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-600">
                    {l.vehicleType && <span>{l.vehicleType}{l.licensePlate ? ` · ${l.licensePlate}` : ''}</span>}
                    {l.zone && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{l.zone}</span>}
                    {l.livraisons > 0 && <span>{l.livraisons} livraison{l.livraisons > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black ${
                    l.verifie ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  {l.verifie ? 'VÉRIFIÉ' : 'À RENCONTRER'}
                </span>
              </div>

              {!l.dossierComplet && (
                <p className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-2.5">
                  Dossier incomplet : ce livreur n&apos;a pas encore renseigné son véhicule
                  ni sa zone. Rien à vérifier tant qu&apos;il n&apos;a pas terminé son inscription.
                </p>
              )}

              {l.verifie && l.constat && (
                <p className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-2.5">
                  <span className="font-bold">Constat : </span>{l.constat}
                  {l.verifieLe && (
                    <span className="text-slate-400"> — {new Date(l.verifieLe).toLocaleDateString('fr-FR')}</span>
                  )}
                </p>
              )}

              {ouvert === l.id ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                    Ce que vous avez constaté au guichet
                  </label>
                  <textarea
                    value={constat}
                    onChange={(e) => setConstat(e.target.value)}
                    rows={3}
                    placeholder="Pièce présentée, permis, assurance, état de la moto, réserves…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-slate-900"
                  />
                  {erreur && <p className="text-[11px] text-red-700 font-medium">{erreur}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => decider(l.id, true)}
                      disabled={enCours === l.id || !l.dossierComplet}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-transform active:scale-[0.98]"
                    >
                      {enCours === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>Vérifié — autoriser les courses</span>
                    </button>
                    <button
                      onClick={() => { setOuvert(null); setConstat(''); setErreur(''); }}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!l.verifie ? (
                    <button
                      onClick={() => { setOuvert(l.id); setConstat(''); setErreur(''); }}
                      disabled={!l.dossierComplet}
                      className="flex-1 h-11 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition-transform active:scale-[0.98]"
                    >
                      Enregistrer la vérification
                    </button>
                  ) : (
                    <button
                      onClick={() => decider(l.id, false)}
                      disabled={enCours === l.id}
                      className="flex-1 h-11 bg-white hover:bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5"
                    >
                      {enCours === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                      <span>Retirer l&apos;autorisation</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        Un compte livreur fonctionne dès l&apos;inscription : il peut se connecter et voir
        son espace. Ce panneau décide seulement du droit de recevoir des courses.
      </p>
    </div>
  );
}
