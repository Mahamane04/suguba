'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, Loader2, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  calculerTarif,
  coutFixeParCommande,
  totalCoutsFixes,
  validerReglages,
  type ReglagesPlateforme,
} from '@/lib/pricing';

/**
 * Réglages économiques de la plateforme — le tableau de bord de l'admin.
 *
 * Tout ce qui détermine l'argent de Suguba est ici, au même endroit : coûts
 * variables et fixes, livraison, points relais, part revendeur, marge
 * minimale, codes promo, retrait minimum. Ces valeurs étaient jusqu'ici
 * éparpillées dans le code, souvent calculées dans le navigateur.
 *
 * Enregistrer recalcule automatiquement la commission de tous les produits
 * approuvés. Les prix de vente, eux, ne changent jamais tout seuls : la liste
 * des produits passés sous le plancher s'affiche pour que l'admin décide.
 */
export default function EconomicSettingsPanel() {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<ReglagesPlateforme | null>(null);
  const [confirme, setConfirme] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [alertes, setAlertes] = useState<{ id: string; nom: string; statut: string; prixVente: number; prixMinimal: number }[]>([]);
  const [exemple, setExemple] = useState({ fournisseur: 8000, vente: 13000 });

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((json) => {
        if (json.reglages) {
          setR(json.reglages);
          setConfirme(Boolean(json.confirme));
          if (!json.confirme) setOuvert(true);
        }
      })
      .catch(() => setErreur('Impossible de charger les réglages.'))
      .finally(() => setChargement(false));
  }, []);

  const apercu = useMemo(() => (r ? calculerTarif(exemple.fournisseur, exemple.vente, r) : null), [r, exemple]);
  const erreursLocales = useMemo(() => (r ? validerReglages(r) : []), [r]);

  const maj = <K extends keyof ReglagesPlateforme>(cle: K, valeur: ReglagesPlateforme[K]) =>
    setR((prev) => (prev ? { ...prev, [cle]: valeur } : prev));

  const enregistrer = async () => {
    if (!r) return;
    setErreur('');
    setMessage('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reglages: r }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreur(json.error || 'Échec de l\'enregistrement.');
        return;
      }
      setConfirme(true);
      setAlertes(json.alertes || []);
      setMessage(`Réglages enregistrés. Commission recalculée sur ${json.recalcules} produit(s) approuvé(s).`);
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  };

  const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
      <button type="button" onClick={() => setOuvert((o) => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center space-x-2 text-left">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Réglages économiques</h3>
            <p className="text-[11px] text-slate-500">
              {chargement ? 'Chargement…' : confirme
                ? 'Coûts, marge minimale, commissions, livraison, codes promo'
                : '⚠️ Coûts non confirmés — estimation provisoire en vigueur'}
            </p>
          </div>
        </div>
        {ouvert ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {ouvert && r && (
        <div className="space-y-5">
          {!confirme && (
            <div className="flex items-start space-x-2 bg-amber-50 border border-amber-300 rounded-2xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900">
                Les coûts fixes affichés sont une <strong>estimation provisoire</strong> (300 000 F/mois),
                pas vos vraies dépenses. Toutes les commissions et marges en dépendent : remplacez-les
                par le détail réel, puis enregistrez.
              </p>
            </div>
          )}

          <Section titre="Coûts variables, par commande">
            <Num l="Frais de paiement SasPay" suffixe="%" v={r.fraisPaiementPct} on={(v) => maj('fraisPaiementPct', v)} />
            <Num l="Frais de versement des commissions" suffixe="%" v={r.fraisVersementPct} on={(v) => maj('fraisVersementPct', v)} />
            <Num l="Provision pour refus à la livraison" suffixe="%" v={r.provisionRefusPct} on={(v) => maj('provisionRefusPct', v)} />
            <Num l="Message au client (SMS / WhatsApp)" suffixe="F" v={r.coutMessageParCommande} on={(v) => maj('coutMessageParCommande', v)} />
          </Section>

          <Section titre="Coûts fixes mensuels">
            <div className="sm:col-span-2 space-y-2">
              {r.coutsFixesMensuels.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.libelle} onChange={(e) => {
                    const c = [...r.coutsFixesMensuels]; c[i] = { ...c[i], libelle: e.target.value }; maj('coutsFixesMensuels', c);
                  }} className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-xs" />
                  <input type="number" min={0} value={l.montant} onChange={(e) => {
                    const c = [...r.coutsFixesMensuels]; c[i] = { ...c[i], montant: Number(e.target.value) || 0 }; maj('coutsFixesMensuels', c);
                  }} className="w-28 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-right" />
                  <button type="button" onClick={() => maj('coutsFixesMensuels', r.coutsFixesMensuels.filter((_, j) => j !== i))}
                    className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => maj('coutsFixesMensuels', [...r.coutsFixesMensuels, { libelle: 'Nouveau coût', montant: 0 }])}
                className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Plus className="w-3.5 h-3.5" /><span>Ajouter un coût</span>
              </button>
            </div>
            <Num l="Volume de référence (commandes/mois)" v={r.volumeReference} on={(v) => maj('volumeReference', v)} />
            <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-700 self-end">
              Total : <strong>{f(totalCoutsFixes(r))}</strong> / mois, soit <strong>{f(coutFixeParCommande(r))}</strong> par commande.
            </div>
          </Section>

          <Section titre="Politique commerciale">
            <Num l="Marge nette minimale Suguba" suffixe="% du prix" v={r.margeNetteMinPct} on={(v) => maj('margeNetteMinPct', v)} />
            <Num l="Part revendeur du reste à partager" suffixe="%" v={r.partRevendeurPct} on={(v) => maj('partRevendeurPct', v)} />
            <Num l="Commission minimale pour être partagé" suffixe="F" v={r.commissionMinimale} on={(v) => maj('commissionMinimale', v)} />
            <Num l="Commission visée (prix recommandé)" suffixe="% du prix fourn." v={r.commissionCiblePct} on={(v) => maj('commissionCiblePct', v)} />
            <Num l="Retrait minimum revendeur" suffixe="F" v={r.retraitMinimum} on={(v) => maj('retraitMinimum', v)} />
          </Section>

          <Section titre="Livraison">
            <Num l="Frais par défaut (ville sans tarif)" suffixe="F" v={r.fraisLivraisonClient} on={(v) => maj('fraisLivraisonClient', v)} />
            <Num l="Rémunération du livreur" suffixe="F" v={r.remunerationLivreur} on={(v) => maj('remunerationLivreur', v)} />
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[11px] font-bold text-slate-600">Frais par ville</p>
              {Object.entries(r.livraisonParVille).map(([ville, frais]) => (
                <div key={ville} className="flex gap-2">
                  <input value={ville} readOnly className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50" />
                  <input type="number" min={0} value={frais} onChange={(e) =>
                    maj('livraisonParVille', { ...r.livraisonParVille, [ville]: Number(e.target.value) || 0 })}
                    className="w-28 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-right" />
                  <button type="button" onClick={() => {
                    const c = { ...r.livraisonParVille }; delete c[ville]; maj('livraisonParVille', c);
                  }} className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <AjoutVille onAjout={(ville) => maj('livraisonParVille', { ...r.livraisonParVille, [ville]: r.fraisLivraisonClient })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[11px] font-bold text-slate-600">Points relais</p>
              {r.pointsRelais.map((p, i) => (
                <div key={p.id} className="flex gap-2">
                  <input value={p.nom} onChange={(e) => {
                    const c = [...r.pointsRelais]; c[i] = { ...c[i], nom: e.target.value }; maj('pointsRelais', c);
                  }} className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-xs" />
                  <input type="number" min={0} value={p.frais} onChange={(e) => {
                    const c = [...r.pointsRelais]; c[i] = { ...c[i], frais: Number(e.target.value) || 0 }; maj('pointsRelais', c);
                  }} className="w-24 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-right" />
                </div>
              ))}
            </div>
          </Section>

          <Section titre="Codes promo">
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[11px] text-slate-500">
                La remise est prise sur la marge Suguba, jamais sur la commission du revendeur, et
                plafonnée pour ne jamais vendre à perte.
              </p>
              {r.codesPromo.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={c.code} onChange={(e) => {
                    const l = [...r.codesPromo]; l[i] = { ...l[i], code: e.target.value.toUpperCase() }; maj('codesPromo', l);
                  }} className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono" />
                  <input type="number" min={0} value={c.remise} onChange={(e) => {
                    const l = [...r.codesPromo]; l[i] = { ...l[i], remise: Number(e.target.value) || 0 }; maj('codesPromo', l);
                  }} className="w-24 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-right" />
                  <label className="flex items-center space-x-1 text-[11px] text-slate-600">
                    <input type="checkbox" checked={c.actif} onChange={(e) => {
                      const l = [...r.codesPromo]; l[i] = { ...l[i], actif: e.target.checked }; maj('codesPromo', l);
                    }} /><span>actif</span>
                  </label>
                  <button type="button" onClick={() => maj('codesPromo', r.codesPromo.filter((_, j) => j !== i))}
                    className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => maj('codesPromo', [...r.codesPromo, { code: 'NOUVEAU', remise: 1000, actif: false }])}
                className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Plus className="w-3.5 h-3.5" /><span>Ajouter un code</span>
              </button>
            </div>
          </Section>

          {apercu && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aperçu sur un produit exemple</p>
              <div className="flex gap-2">
                <label className="flex-1 text-[10px] text-slate-400">Prix fournisseur
                  <input type="number" value={exemple.fournisseur} onChange={(e) => setExemple({ ...exemple, fournisseur: Number(e.target.value) || 0 })}
                    className="w-full h-9 mt-1 px-2 rounded-lg bg-slate-800 text-white font-mono" />
                </label>
                <label className="flex-1 text-[10px] text-slate-400">Prix de vente
                  <input type="number" value={exemple.vente} onChange={(e) => setExemple({ ...exemple, vente: Number(e.target.value) || 0 })}
                    className="w-full h-9 mt-1 px-2 rounded-lg bg-slate-800 text-white font-mono" />
                </label>
              </div>
              <div className="flex justify-between text-amber-300"><span>Plancher Suguba</span><span>{f(apercu.plancher)}</span></div>
              <div className="flex justify-between text-emerald-400 font-black"><span>Commission revendeur</span><span>{f(apercu.commission)}</span></div>
              <div className="flex justify-between text-purple-200 font-black"><span>Marge nette Suguba</span><span>{f(apercu.margeNetteSuguba)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Prix minimal / recommandé</span><span>{f(apercu.prixMinimal)} / {f(apercu.prixRecommande)}</span></div>
            </div>
          )}

          {(erreursLocales.length > 0 || erreur) && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-[11px] text-rose-800 space-y-1">
              {[...erreursLocales, ...(erreur ? [erreur] : [])].map((e) => <p key={e}>• {e}</p>)}
            </div>
          )}

          {message && (
            <div className="flex items-start space-x-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-[11px] text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{message}</span>
            </div>
          )}

          {alertes.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2">
              <p className="text-[11px] font-black text-amber-900">
                {alertes.length} produit(s) à revoir — leur prix de vente n&apos;a PAS été modifié :
              </p>
              {alertes.map((a) => (
                <p key={a.id} className="text-[11px] text-amber-900">
                  • {a.nom} : vendu {f(a.prixVente)}, {a.statut === 'sous_plancher' ? `sous le plancher (minimal ${f(a.prixMinimal)})` : 'commission trop faible pour être partagé'}
                </p>
              ))}
            </div>
          )}

          <button type="button" onClick={enregistrer} disabled={envoi || erreursLocales.length > 0}
            className="w-full h-[52px] bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Enregistrer et recalculer les commissions</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{titre}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Num({ l, v, on, suffixe }: { l: string; v: number; on: (v: number) => void; suffixe?: string }) {
  return (
    <label className="block text-[11px] font-bold text-slate-600">
      {l}
      <div className="flex items-center mt-1">
        <input type="number" min={0} step="any" value={v} onChange={(e) => on(Number(e.target.value) || 0)}
          className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900" />
        {suffixe && <span className="ml-2 text-[10px] text-slate-400 whitespace-nowrap">{suffixe}</span>}
      </div>
    </label>
  );
}

function AjoutVille({ onAjout }: { onAjout: (ville: string) => void }) {
  const [ville, setVille] = useState('');
  return (
    <div className="flex gap-2">
      <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Nouvelle ville"
        className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-slate-200 text-xs" />
      <button type="button" disabled={!ville.trim()} onClick={() => { onAjout(ville.trim()); setVille(''); }}
        className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 disabled:opacity-50 flex items-center space-x-1">
        <Plus className="w-3.5 h-3.5" /><span>Ajouter</span>
      </button>
    </div>
  );
}
