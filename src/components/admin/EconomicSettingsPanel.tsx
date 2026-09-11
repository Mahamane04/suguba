'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, Loader2, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  calculerTarif,
  coutFixeParCommande,
  prixDepuisPartRevendeur,
  totalCoutsFixes,
  validerReglages,
  type ModePartSuguba,
  type ReglagesPlateforme,
} from '@/lib/pricing';

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

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

  // Tableau de simulation : pour chaque couple (prix fournisseur, part
  // revendeur), le prix client et le partage, avec les réglages EN COURS
  // d'édition — l'admin voit l'effet d'un changement avant d'enregistrer.
  const [simulations, setSimulations] = useState([
    { fournisseur: 8000, part: 1000 },
    { fournisseur: 30000, part: 3000 },
    { fournisseur: 155000, part: 15000 },
  ]);
  const lignesSimulation = useMemo(() => {
    if (!r) return [];
    return simulations.map((s) => {
      const auto = r.modePartSuguba === 'auto' || !(s.part > 0);
      if (auto) {
        const prix = calculerTarif(s.fournisseur, 0, r).prixRecommande;
        const t = calculerTarif(s.fournisseur, prix, r);
        return {
          ...s, prix, commission: t.commission, partSuguba: prix - s.fournisseur - t.commission,
          couts: t.coutParCommande + t.fraisVersement, margeNette: t.margeNetteSuguba,
          note: `calcul auto : ${enF(t.commission)} au revendeur`,
        };
      }
      const d = prixDepuisPartRevendeur(s.fournisseur, s.part, r);
      const t = calculerTarif(s.fournisseur, d.prixVente, r, s.part);
      return {
        ...s, prix: d.prixVente, commission: t.commission, partSuguba: d.partSuguba,
        couts: t.coutParCommande + t.fraisVersement, margeNette: t.margeNetteSuguba,
        note: d.releveAuPlancher
          ? `relevé au plancher (le % seul donnait ${enF(d.prixCalcule)})`
          : t.statut === 'commission_faible' ? 'part trop faible : pas proposé au partage' : '',
      };
    });
  }, [r, simulations]);

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
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
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

          <Section titre="Part revendeur fixée par le fournisseur">
            <div className="sm:col-span-2 space-y-2">
              <p className="text-[11px] text-slate-500">
                Le fournisseur indique combien il laisse au revendeur. Choisissez comment Suguba se rémunère :
                le prix client est calculé automatiquement, et relevé au plancher s&apos;il ne couvre pas vos coûts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['prix_vente', '% du prix de vente', 'Suguba prend un pourcentage du prix payé par le client.'],
                  ['part_revendeur', '% de la part revendeur', 'Suguba prend un pourcentage de ce que le fournisseur laisse au revendeur.'],
                  ['auto', 'Automatique', 'Le fournisseur ne choisit rien : Suguba calcule la commission.'],
                ] as [ModePartSuguba, string, string][]).map(([cle, titre, detail]) => (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => maj('modePartSuguba', cle)}
                    className={`text-left p-3 rounded-2xl border transition-colors ${
                      r.modePartSuguba === cle ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900">{titre}</p>
                    <p className="text-[11px] text-slate-500">{detail}</p>
                  </button>
                ))}
              </div>
            </div>
            {r.modePartSuguba !== 'auto' && (
              <>
                <Num
                  l={r.modePartSuguba === 'prix_vente' ? 'Part Suguba (% du prix de vente)' : 'Part Suguba (% de la part revendeur)'}
                  suffixe="%"
                  v={r.tauxPartSuguba}
                  on={(v) => maj('tauxPartSuguba', v)}
                />
                <Num l="Part minimale Suguba par vente" suffixe="F" v={r.minimumPartSuguba} on={(v) => maj('minimumPartSuguba', v)} />
              </>
            )}

            <div className="sm:col-span-2 space-y-2">
              <p className="text-[11px] font-bold text-slate-600">Tableau de simulation (réglages en cours, avant enregistrement)</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1.5 pr-2 font-bold">Prix fournisseur</th>
                      <th className="pr-2 font-bold">Part revendeur</th>
                      <th className="pr-2 font-bold text-right">Prix client</th>
                      <th className="pr-2 font-bold text-right">Part Suguba</th>
                      <th className="pr-2 font-bold text-right">Coûts</th>
                      <th className="pr-2 font-bold text-right">Marge nette</th>
                      <th className="font-bold">Remarque</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lignesSimulation.map((l, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">
                          <input type="number" min={0} value={l.fournisseur}
                            onChange={(e) => setSimulations((s) => s.map((x, j) => (j === i ? { ...x, fournisseur: Number(e.target.value) || 0 } : x)))}
                            className="w-24 h-8 px-2 rounded-lg border border-slate-200 font-mono" />
                        </td>
                        <td className="pr-2">
                          <input type="number" min={0} value={l.part}
                            onChange={(e) => setSimulations((s) => s.map((x, j) => (j === i ? { ...x, part: Number(e.target.value) || 0 } : x)))}
                            className="w-20 h-8 px-2 rounded-lg border border-slate-200 font-mono" />
                        </td>
                        <td className="pr-2 text-right font-black text-slate-900">{enF(l.prix)}</td>
                        <td className="pr-2 text-right">{enF(l.partSuguba)}</td>
                        <td className="pr-2 text-right text-slate-500">{enF(l.couts)}</td>
                        <td className={`pr-2 text-right font-black ${l.margeNette < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{enF(l.margeNette)}</td>
                        <td className="pr-2 text-amber-700">{l.note}</td>
                        <td>
                          <button type="button" aria-label="Supprimer la ligne"
                            onClick={() => setSimulations((s) => s.filter((_, j) => j !== i))}
                            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setSimulations((s) => [...s, { fournisseur: 20000, part: 2000 }])}
                className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Plus className="w-3.5 h-3.5" /><span>Ajouter une ligne</span>
              </button>
              <p className="text-[11px] text-slate-500">
                Coûts = paiement, provision pour refus, message, livraison non couverte, coûts fixes par commande et frais de
                versement de la commission. Marge nette = ce qui reste réellement à Suguba.
              </p>
            </div>
          </Section>

          {apercu && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aperçu sur un produit exemple</p>
              <div className="flex gap-2">
                <label className="flex-1 text-[11px] text-slate-400">Prix fournisseur
                  <input type="number" value={exemple.fournisseur} onChange={(e) => setExemple({ ...exemple, fournisseur: Number(e.target.value) || 0 })}
                    className="w-full h-9 mt-1 px-2 rounded-lg bg-slate-800 text-white font-mono" />
                </label>
                <label className="flex-1 text-[11px] text-slate-400">Prix de vente
                  <input type="number" value={exemple.vente} onChange={(e) => setExemple({ ...exemple, vente: Number(e.target.value) || 0 })}
                    className="w-full h-9 mt-1 px-2 rounded-lg bg-slate-800 text-white font-mono" />
                </label>
              </div>
              <div className="flex justify-between text-amber-300"><span>Plancher Suguba</span><span>{f(apercu.plancher)}</span></div>
              <div className="flex justify-between text-emerald-400 font-black"><span>Commission revendeur</span><span>{f(apercu.commission)}</span></div>
              <div className="flex justify-between text-slate-200 font-black"><span>Marge nette Suguba</span><span>{f(apercu.margeNetteSuguba)}</span></div>
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
            className="w-full h-[52px] bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]">
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
        {suffixe && <span className="ml-2 text-[11px] text-slate-400 whitespace-nowrap">{suffixe}</span>}
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
