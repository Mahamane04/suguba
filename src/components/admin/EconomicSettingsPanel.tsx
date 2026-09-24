'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator, ChevronDown, ChevronUp, Loader2, Plus, Trash2, AlertCircle, CheckCircle2, RotateCcw, ArrowRight,
} from 'lucide-react';
import {
  calculerTarif,
  coutCourseRefusee,
  coutFixeParCommande,
  prixDepuisPartRevendeur,
  totalCoutsFixes,
  validerReglages,
  type DetailTarif,
  type ModePartSuguba,
  type ReglagesPlateforme,
} from '@/lib/pricing';

// Espace insécable avant « F » : « 20 000 » et « F » ne se séparent jamais en fin de ligne.
const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}\u00a0F`;

interface ProduitEnLigne {
  id: string;
  name: string;
  supplier_price: number;
  public_price: number;
  reseller_commission: number | null;
  commission_proposee: number | null;
}

const MODES: [ModePartSuguba, string, string][] = [
  ['prelevement_revendeur', 'Prélevé sur le revendeur', 'Le client paie prix fournisseur + part revendeur. Suguba garde un % de la part revendeur (ex. 1 % au lancement).'],
  ['prix_vente', '% du prix de vente', 'Suguba ajoute un pourcentage au prix payé par le client.'],
  ['part_revendeur', '% de la part revendeur, payé par le client', 'Suguba ajoute au prix client un % de ce que le fournisseur laisse au revendeur.'],
  ['auto', 'Automatique', 'Le fournisseur ne choisit rien : Suguba calcule la commission.'],
];

const SECTIONS = [
  ['modele', 'Rémunération'],
  ['impact', 'Vos produits'],
  ['couts', 'Coûts'],
  ['livraison', 'Livraison'],
  ['promo', 'Codes promo'],
  ['simulation', 'Simulation'],
] as const;

/**
 * Réglages économiques de la plateforme — le tableau de bord de l'admin.
 *
 * Tout ce qui détermine l'argent de Suguba est ici, au même endroit : coûts
 * variables et fixes, livraison, points relais, part revendeur, marge
 * minimale, codes promo, retrait minimum.
 *
 * Refonte du 2026-09-24, après test sur les réglages réels :
 * - « Où va l'argent » : le partage d'une vente exemple en barre, et surtout
 *   POURQUOI le prix est relevé. Avec 1 % de part Suguba, le taux n'avait en
 *   pratique aucun effet : le plancher de coûts fixait seul le prix, sans que
 *   l'écran le dise.
 * - Provision pour refus au choix sur le prix ou sur la course perdue.
 * - Impact en direct sur les produits en ligne, avant d'enregistrer.
 * - Barre d'enregistrement fixe, modifications non enregistrées signalées,
 *   champs à 16 px sur téléphone (sinon iPhone zoome à la saisie), virgule
 *   décimale acceptée.
 *
 * Enregistrer recalcule automatiquement la commission de tous les produits
 * approuvés. Les prix de vente, eux, ne changent jamais tout seuls.
 */
export default function EconomicSettingsPanel() {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<ReglagesPlateforme | null>(null);
  const [initial, setInitial] = useState('');
  const [confirme, setConfirme] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [alertes, setAlertes] = useState<{ id: string; nom: string; statut: string; prixVente: number; prixMinimal: number }[]>([]);
  const [produits, setProduits] = useState<ProduitEnLigne[]>([]);
  const [exemple, setExemple] = useState({ fournisseur: 20000, part: 2000 });

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((json) => {
        if (json.reglages) {
          setR(json.reglages);
          setInitial(JSON.stringify(json.reglages));
          setConfirme(Boolean(json.confirme));
          setProduits(json.produits || []);
          if (!json.confirme) setOuvert(true);
        }
      })
      .catch(() => setErreur('Impossible de charger les réglages.'))
      .finally(() => setChargement(false));
  }, []);

  const modifie = !!r && JSON.stringify(r) !== initial;

  // Quitter la page avec des modifications non enregistrées : le navigateur demande confirmation.
  useEffect(() => {
    if (!modifie) return;
    const avant = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [modifie]);

  const erreursLocales = useMemo(() => (r ? validerReglages(r) : []), [r]);

  // Tableau de simulation : pour chaque couple (prix fournisseur, part
  // revendeur), le prix client et le partage, avec les réglages EN COURS.
  const [simulations, setSimulations] = useState([
    { fournisseur: 5000, part: 500 },
    { fournisseur: 30000, part: 3000 },
    { fournisseur: 155000, part: 15000 },
  ]);
  const lignesSimulation = useMemo(
    () => (r ? simulations.map((s) => ({ ...s, ...venteSimulee(r, s.fournisseur, s.part) })) : []),
    [r, simulations],
  );

  const impact = useMemo(() => {
    if (!r) return [];
    return produits.map((p) => {
      const pf = Number(p.supplier_price) || 0;
      const pv = Number(p.public_price) || 0;
      const t = calculerTarif(pf, pv, r, p.commission_proposee);
      const conseille = r.modePartSuguba !== 'auto' && Number(p.commission_proposee) > 0
        ? prixDepuisPartRevendeur(pf, Number(p.commission_proposee), r).prixVente
        : t.prixRecommande;
      return { p, t, avant: Number(p.reseller_commission) || 0, conseille };
    });
  }, [r, produits]);
  const nbCommissionChange = impact.filter((l) => l.t.commission !== l.avant).length;
  const nbARevoir = impact.filter((l) => l.t.statut !== 'ok').length;

  const maj = <K extends keyof ReglagesPlateforme>(cle: K, valeur: ReglagesPlateforme[K]) =>
    setR((prev) => (prev ? { ...prev, [cle]: valeur } : prev));

  const annuler = () => {
    if (!initial) return;
    setR(JSON.parse(initial));
    setMessage('');
    setErreur('');
  };

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
      setInitial(JSON.stringify(r));
      setAlertes(json.alertes || []);
      // Les commissions affichées « avant » deviennent celles qu'on vient d'écrire.
      setProduits((liste) => liste.map((p) => {
        const t = calculerTarif(Number(p.supplier_price), Number(p.public_price), r, p.commission_proposee);
        return { ...p, reseller_commission: t.commission };
      }));
      setMessage(`Réglages enregistrés. Commission recalculée sur ${json.recalcules} produit(s) en ligne.`);
    } catch {
      setErreur('Erreur réseau : rien n\'a été enregistré.');
    } finally {
      setEnvoi(false);
    }
  };

  const allerA = (id: string) => document.getElementById(`reglage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const coutProvisoire = r?.coutsFixesMensuels.some((l) => /provisoire/i.test(l.libelle) && Number(l.montant) > 0);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div className="w-9 h-9 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">Réglages économiques</h3>
            <p className="text-xs text-slate-500 truncate">
              {chargement ? 'Chargement…' : !confirme
                ? '⚠️ Coûts non confirmés — estimation provisoire en vigueur'
                : r ? `${libelleMode(r)} · coûts, livraison, codes promo` : 'Coûts, commissions, livraison, codes promo'}
            </p>
          </div>
        </div>
        {ouvert ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>

      {ouvert && r && (
        <div className="space-y-6">
          <nav aria-label="Sections des réglages" className="-mx-5 px-5 flex gap-2 overflow-x-auto scrollbar-none">
            {SECTIONS.map(([id, libelle]) => (
              <button key={id} type="button" onClick={() => allerA(id)}
                className="shrink-0 min-h-[36px] px-3.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-suguba-profond">
                {libelle}
              </button>
            ))}
          </nav>

          {!confirme && (
            <Avertissement>
              Les coûts fixes affichés sont une <strong>estimation provisoire</strong> (300 000 F/mois), pas vos vraies
              dépenses. Toutes les commissions et marges en dépendent : remplacez-les par le détail réel, puis enregistrez.
            </Avertissement>
          )}
          {confirme && coutProvisoire && (
            <Avertissement>
              Une ligne « estimation provisoire » est encore comptée dans les coûts fixes ({enF(coutFixeParCommande(r))} ajoutés
              à chaque commande). Remplacez-la par vos vraies dépenses dans <button type="button" className="underline font-semibold" onClick={() => allerA('couts')}>Coûts</button>.
            </Avertissement>
          )}

          {/* ── Rémunération de Suguba ─────────────────────────────────── */}
          <Section id="modele" titre="Comment Suguba gagne de l'argent"
            aide="Le fournisseur indique combien il laisse au revendeur. Choisissez comment Suguba se rémunère.">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de rémunération">
              {MODES.map(([cle, titre, detail]) => {
                const actif = r.modePartSuguba === cle;
                return (
                  <button key={cle} type="button" role="radio" aria-checked={actif} onClick={() => maj('modePartSuguba', cle)}
                    className={`text-left p-3 rounded-2xl border transition-colors ${
                      actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 hover:bg-suguba-sauge'
                    }`}>
                    <p className="text-sm font-semibold text-slate-900">{titre}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{detail}</p>
                  </button>
                );
              })}
            </div>
            {r.modePartSuguba !== 'auto' && (
              <>
                <Num
                  l={r.modePartSuguba === 'prix_vente' ? 'Part Suguba (% du prix de vente)'
                    : r.modePartSuguba === 'prelevement_revendeur' ? 'Prélèvement Suguba (% de la part revendeur)'
                      : 'Part Suguba (% de la part revendeur)'}
                  suffixe="%" v={r.tauxPartSuguba} on={(v) => maj('tauxPartSuguba', v)}
                />
                {/* Pas de minimum en francs quand Suguba se sert sur le revendeur :
                    1 000 F sur une part de 500 F n'aurait aucun sens. */}
                {r.modePartSuguba !== 'prelevement_revendeur' && (
                  <Num l="Part minimale Suguba par vente" suffixe="F" v={r.minimumPartSuguba} on={(v) => maj('minimumPartSuguba', v)} />
                )}
              </>
            )}
            <div className="sm:col-span-2">
              <OuVaLArgent r={r} exemple={exemple} setExemple={setExemple} />
            </div>
          </Section>

          {/* ── Impact sur les produits en ligne ───────────────────────── */}
          <Section id="impact" titre={`Vos produits en ligne (${impact.length})`}
            aide="Calculé en direct avec les réglages ci-dessus, avant d'enregistrer. Enregistrer met à jour la commission ; le prix affiché au client ne change jamais tout seul.">
            <div className="sm:col-span-2 space-y-2">
              {impact.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun produit en ligne pour l&apos;instant.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-700">
                    {modifie
                      ? <>Si vous enregistrez : <strong>{nbCommissionChange}</strong> commission(s) changent{nbARevoir > 0 && <>, <strong className="text-rose-700">{nbARevoir}</strong> produit(s) à revoir</>}.</>
                      : nbARevoir > 0 ? <><strong className="text-rose-700">{nbARevoir}</strong> produit(s) à revoir avec les réglages actuels.</> : 'Tous les produits en ligne sont rentables avec les réglages actuels.'}
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {impact.map(({ p, t, avant, conseille }) => (
                      <li key={p.id} className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 min-w-0 truncate">{p.name}</p>
                          <PastilleStatut statut={t.statut} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 [&>span]:whitespace-nowrap">
                          <span>Fournisseur <strong className="text-slate-900">{enF(t.prixFournisseur)}</strong></span>
                          <span>Prix client <strong className="text-slate-900">{enF(t.prixVente)}</strong></span>
                          <span className="inline-flex items-center gap-1">
                            Revendeur{' '}
                            {t.commission !== avant && <><s className="text-slate-400">{enF(avant)}</s><ArrowRight className="w-3 h-3" /></>}
                            <strong className="text-slate-900">{enF(t.commission)}</strong>
                          </span>
                          <span>Marge Suguba <strong className={t.margeNetteSuguba < 0 ? 'text-rose-700' : 'text-slate-900'}>{enF(t.margeNetteSuguba)}</strong></span>
                        </div>
                        {Math.abs(conseille - t.prixVente) >= r.arrondiPrix && (
                          <p className="text-xs text-slate-500">
                            Prix conseillé avec ces réglages : <strong className="text-slate-800">{enF(conseille)}</strong>{' '}
                            ({conseille < t.prixVente ? `${enF(t.prixVente - conseille)} de moins pour le client` : `${enF(conseille - t.prixVente)} de plus`}).
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>

          {/* ── Coûts ──────────────────────────────────────────────────── */}
          <Section id="couts" titre="Coûts variables, par commande"
            aide="Ils forment le « plancher » : aucun prix ne descend en dessous, quel que soit votre taux.">
            <Num l="Frais de paiement SasPay" suffixe="%" v={r.fraisPaiementPct} on={(v) => maj('fraisPaiementPct', v)}
              aide="Sur l'article + la livraison encaissés." />
            <Num l="Frais de versement des commissions" suffixe="%" v={r.fraisVersementPct} on={(v) => maj('fraisVersementPct', v)} />
            <div className="sm:col-span-2 space-y-2 rounded-2xl bg-suguba-sauge p-3">
              <p className="text-xs font-semibold text-slate-700">Provision pour refus à la livraison</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Base de la provision">
                {([
                  ['course', 'Sur la course perdue', 'Recommandé : le colis refusé revient, seule la course est perdue'],
                  ['prix', 'Sur le prix du produit', 'Ancien calcul : pèse lourd sur les articles chers'],
                ] as const).map(([valeur, libelle, aide]) => {
                  const actif = (r.baseProvisionRefus || 'prix') === valeur;
                  return (
                    <button key={valeur} type="button" role="radio" aria-checked={actif} onClick={() => maj('baseProvisionRefus', valeur)}
                      className={`rounded-2xl border p-2.5 text-left bg-white ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond' : 'border-slate-200'}`}>
                      <span className="block text-xs font-semibold text-slate-900">{libelle}</span>
                      <span className="block text-xs text-slate-500">{aide}</span>
                    </button>
                  );
                })}
              </div>
              <Num l={r.baseProvisionRefus === 'course' ? 'Part des livraisons refusées' : 'Provision (% du prix de vente)'}
                suffixe="%" v={r.provisionRefusPct} on={(v) => maj('provisionRefusPct', v)} />
              <p className="text-xs text-slate-600">
                {r.baseProvisionRefus === 'course'
                  ? <>Soit <strong>{enF((r.provisionRefusPct / 100) * coutCourseRefusee(r))}</strong> par commande ({r.provisionRefusPct} % × {enF(coutCourseRefusee(r))}, livreur aller + retour). En paiement à la livraison, 10 à 20 % de refus sont courants : mettez votre taux réel.</>
                  : <>Soit <strong>{enF(r.provisionRefusPct * 1000)}</strong> sur un article à 100 000 F, <strong>{enF(r.provisionRefusPct * 4000)}</strong> sur un article à 400 000 F.</>}
              </p>
            </div>
            <Num l="Message au client (SMS / WhatsApp)" suffixe="F" v={r.coutMessageParCommande} on={(v) => maj('coutMessageParCommande', v)} />
          </Section>

          <Section titre="Coûts fixes mensuels" aide="Répartis sur le volume de référence : c'est un objectif, pas le volume constaté.">
            <div className="sm:col-span-2 space-y-2">
              {r.coutsFixesMensuels.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.libelle} aria-label={`Libellé du coût ${i + 1}`} onChange={(e) => {
                    const c = [...r.coutsFixesMensuels]; c[i] = { ...c[i], libelle: e.target.value }; maj('coutsFixesMensuels', c);
                  }} className={`${CHAMP} flex-1 min-w-0`} />
                  <Montant valeur={l.montant} libelle={`Montant du coût ${i + 1}`} onChange={(v) => {
                    const c = [...r.coutsFixesMensuels]; c[i] = { ...c[i], montant: v }; maj('coutsFixesMensuels', c);
                  }} />
                  <BoutonSupprimer libelle={`Supprimer ${l.libelle}`} onClick={() => maj('coutsFixesMensuels', r.coutsFixesMensuels.filter((_, j) => j !== i))} />
                </div>
              ))}
              <BoutonAjouter onClick={() => maj('coutsFixesMensuels', [...r.coutsFixesMensuels, { libelle: 'Nouveau coût', montant: 0 }])}>
                Ajouter un coût
              </BoutonAjouter>
            </div>
            <Num l="Volume de référence (commandes/mois)" v={r.volumeReference} on={(v) => maj('volumeReference', v)} />
            <div className="bg-suguba-sauge rounded-2xl p-3 text-xs text-slate-700 self-end">
              Total : <strong>{enF(totalCoutsFixes(r))}</strong> / mois, soit <strong>{enF(coutFixeParCommande(r))}</strong> par commande.
            </div>
          </Section>

          <Section titre="Politique commerciale"
            aide={r.modePartSuguba === 'auto'
              ? 'Mode automatique : ces valeurs calculent la commission de chaque produit.'
              : 'La part revendeur et la commission visée ne servent qu’aux produits sans part revendeur choisie par le fournisseur.'}>
            <Num l="Marge nette minimale Suguba" suffixe="% du prix" v={r.margeNetteMinPct} on={(v) => maj('margeNetteMinPct', v)} />
            <Num l="Part revendeur du reste à partager" suffixe="%" v={r.partRevendeurPct} on={(v) => maj('partRevendeurPct', v)} />
            <Num l="Commission minimale pour être partagé" suffixe="F" v={r.commissionMinimale} on={(v) => maj('commissionMinimale', v)} />
            <Num l="Commission visée (prix recommandé)" suffixe="% du prix fourn." v={r.commissionCiblePct} on={(v) => maj('commissionCiblePct', v)} />
            <Num l="Retrait minimum revendeur" suffixe="F" v={r.retraitMinimum} on={(v) => maj('retraitMinimum', v)} />
          </Section>

          {/* ── Livraison ──────────────────────────────────────────────── */}
          <Section id="livraison" titre="Livraison">
            <Num l="Frais par défaut (ville sans tarif)" suffixe="F" v={r.fraisLivraisonClient} on={(v) => maj('fraisLivraisonClient', v)} />
            <Num l="Rémunération du livreur" suffixe="F" v={r.remunerationLivreur} on={(v) => maj('remunerationLivreur', v)}
              aide={r.remunerationLivreur > r.fraisLivraisonClient ? `${enF(r.remunerationLivreur - r.fraisLivraisonClient)} non couverts par le client, ajoutés au plancher.` : undefined} />
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Frais par ville</p>
              {Object.entries(r.livraisonParVille).map(([ville, frais]) => (
                <div key={ville} className="flex gap-2">
                  <input value={ville} readOnly aria-label="Ville" className={`${CHAMP} flex-1 min-w-0 bg-slate-50`} />
                  <Montant valeur={frais} libelle={`Frais pour ${ville}`} onChange={(v) => maj('livraisonParVille', { ...r.livraisonParVille, [ville]: v })} />
                  <BoutonSupprimer libelle={`Supprimer ${ville}`} onClick={() => {
                    const c = { ...r.livraisonParVille }; delete c[ville]; maj('livraisonParVille', c);
                  }} />
                </div>
              ))}
              <AjoutVille onAjout={(ville) => maj('livraisonParVille', { ...r.livraisonParVille, [ville]: r.fraisLivraisonClient })} />
            </div>
            <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700">Calcul de la livraison à Bamako</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de calcul">
                {([
                  ['distance', 'À la distance', 'Base + prix au km'],
                  ['zones', 'Par zones', 'Commune, rive, périphérie'],
                ] as const).map(([valeur, libelle, aide]) => {
                  const actif = (r.modeLivraisonBamako || 'distance') === valeur;
                  return (
                    <button key={valeur} type="button" role="radio" aria-checked={actif}
                      onClick={() => maj('modeLivraisonBamako', valeur)}
                      className={`rounded-2xl border p-2.5 text-left ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond bg-suguba-menthe' : 'border-slate-200 bg-white'}`}>
                      <span className="block text-xs font-semibold text-slate-900">{libelle}</span>
                      <span className="block text-xs text-slate-500">{aide}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {r.modeLivraisonBamako === 'zones' && r.livraisonZonesBamako ? (
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs text-slate-500">
                  Rive gauche : Communes I à IV. Rive droite : Communes V et VI. S&apos;applique quand les
                  quartiers du fournisseur et du client sont reconnus ; sinon, tarif « Bamako » ci-dessus.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Num l="Même commune" suffixe="F" v={r.livraisonZonesBamako.memeCommune}
                    on={(v) => maj('livraisonZonesBamako', { ...r.livraisonZonesBamako!, memeCommune: v })} />
                  <Num l="Même rive" suffixe="F" v={r.livraisonZonesBamako.memeRive}
                    on={(v) => maj('livraisonZonesBamako', { ...r.livraisonZonesBamako!, memeRive: v })} />
                  <Num l="Traverser le fleuve" suffixe="F" v={r.livraisonZonesBamako.autreRive}
                    on={(v) => maj('livraisonZonesBamako', { ...r.livraisonZonesBamako!, autreRive: v })} />
                  <Num l="Supplément périphérie" suffixe="F" v={r.livraisonZonesBamako.supplementPeripherie}
                    on={(v) => maj('livraisonZonesBamako', { ...r.livraisonZonesBamako!, supplementPeripherie: v })} />
                </div>
              </div>
            ) : (
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs text-slate-500">
                  Remplace le tarif « Bamako » quand les quartiers du fournisseur ET du client sont reconnus.
                  Base + (frais/km × distance à vol d&apos;oiseau), entre le minimum et le maximum.
                  Exemple à 3 km : <strong className="text-slate-800">{enF(Math.min(r.livraisonDistanceBamako.fraisMaximum, Math.max(r.livraisonDistanceBamako.fraisMinimum, r.livraisonDistanceBamako.fraisBase + 3 * r.livraisonDistanceBamako.fraisParKm)))}</strong>.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Num l="Frais de base" suffixe="F" v={r.livraisonDistanceBamako.fraisBase}
                    on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisBase: v })} />
                  <Num l="Frais par km" suffixe="F" v={r.livraisonDistanceBamako.fraisParKm}
                    on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisParKm: v })} />
                  <Num l="Minimum" suffixe="F" v={r.livraisonDistanceBamako.fraisMinimum}
                    on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisMinimum: v })} />
                  <Num l="Maximum" suffixe="F" v={r.livraisonDistanceBamako.fraisMaximum}
                    on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisMaximum: v })} />
                </div>
              </div>
            )}
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Points relais</p>
              {r.pointsRelais.map((p, i) => (
                <div key={p.id} className="flex gap-2">
                  <input value={p.nom} aria-label="Nom du point relais" onChange={(e) => {
                    const c = [...r.pointsRelais]; c[i] = { ...c[i], nom: e.target.value }; maj('pointsRelais', c);
                  }} className={`${CHAMP} flex-1 min-w-0`} />
                  <Montant valeur={p.frais} libelle={`Frais au point relais ${p.nom}`} onChange={(v) => {
                    const c = [...r.pointsRelais]; c[i] = { ...c[i], frais: v }; maj('pointsRelais', c);
                  }} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Codes promo ────────────────────────────────────────────── */}
          <Section id="promo" titre="Codes promo"
            aide="La remise est prise sur la marge Suguba, jamais sur la commission du revendeur, et plafonnée pour ne jamais vendre à perte.">
            <div className="sm:col-span-2 space-y-2">
              {r.codesPromo.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={c.code} aria-label="Code" onChange={(e) => {
                    const l = [...r.codesPromo]; l[i] = { ...l[i], code: e.target.value.toUpperCase().replace(/\s/g, '') }; maj('codesPromo', l);
                  }} className={`${CHAMP} flex-1 min-w-0 font-mono`} />
                  <Montant valeur={c.remise} libelle={`Remise du code ${c.code}`} onChange={(v) => {
                    const l = [...r.codesPromo]; l[i] = { ...l[i], remise: v }; maj('codesPromo', l);
                  }} />
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 min-h-[44px]">
                    <input type="checkbox" className="w-4 h-4 accent-suguba-profond" checked={c.actif} onChange={(e) => {
                      const l = [...r.codesPromo]; l[i] = { ...l[i], actif: e.target.checked }; maj('codesPromo', l);
                    }} /><span>actif</span>
                  </label>
                  <BoutonSupprimer libelle={`Supprimer le code ${c.code}`} onClick={() => maj('codesPromo', r.codesPromo.filter((_, j) => j !== i))} />
                </div>
              ))}
              <BoutonAjouter onClick={() => maj('codesPromo', [...r.codesPromo, { code: 'NOUVEAU', remise: 1000, actif: false }])}>
                Ajouter un code
              </BoutonAjouter>
            </div>
          </Section>

          {/* ── Simulation ─────────────────────────────────────────────── */}
          <Section id="simulation" titre="Simulation"
            aide="Essayez des produits imaginaires avec les réglages en cours. Coûts = paiement, refus, message, livraison non couverte, coûts fixes et versement de la commission.">
            <div className="sm:col-span-2 space-y-2">
              {lignesSimulation.map((l, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-xs font-semibold text-slate-700">Prix fournisseur
                      <Montant large valeur={l.fournisseur} libelle="Prix fournisseur" onChange={(v) => setSimulations((s) => s.map((x, j) => (j === i ? { ...x, fournisseur: v } : x)))} />
                    </label>
                    <label className="flex-1 text-xs font-semibold text-slate-700">Part revendeur
                      <Montant large valeur={l.part} libelle="Part revendeur" onChange={(v) => setSimulations((s) => s.map((x, j) => (j === i ? { ...x, part: v } : x)))} />
                    </label>
                    <BoutonSupprimer libelle="Supprimer la ligne" onClick={() => setSimulations((s) => s.filter((_, j) => j !== i))} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 [&>span]:whitespace-nowrap">
                    <span>Prix client <strong className="text-slate-900">{enF(l.prix)}</strong></span>
                    <span>Revendeur <strong className="text-slate-900">{enF(l.t.commission)}</strong></span>
                    <span>Part Suguba <strong className="text-slate-900">{enF(l.prix - l.fournisseur - l.t.commission)}</strong></span>
                    <span>Coûts <strong className="text-slate-900">{enF(l.t.coutParCommande + l.t.fraisVersement)}</strong></span>
                    <span>Marge nette <strong className={l.t.margeNetteSuguba < 0 ? 'text-rose-700' : 'text-slate-900'}>{enF(l.t.margeNetteSuguba)}</strong></span>
                  </div>
                  {l.notes.length > 0 && <p className="text-xs text-amber-800">{l.notes.join(' · ')}</p>}
                </div>
              ))}
              <BoutonAjouter onClick={() => setSimulations((s) => [...s, { fournisseur: 20000, part: 2000 }])}>
                Ajouter une ligne
              </BoutonAjouter>
            </div>
          </Section>

          {alertes.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-900">
                {alertes.length} produit(s) à revoir — leur prix de vente n&apos;a PAS été modifié :
              </p>
              {alertes.map((a) => (
                <p key={a.id} className="text-xs text-amber-900">
                  • {a.nom} : vendu {enF(a.prixVente)}, {a.statut === 'sous_plancher' ? `sous le plancher (minimal ${enF(a.prixMinimal)})` : 'commission trop faible pour être partagé'}
                </p>
              ))}
            </div>
          )}

          {/* Barre d'enregistrement : reste visible pendant le défilement, au-dessus
              de la barre de navigation du bas sur téléphone (80 px + zone sûre). */}
          {(modifie || erreur || erreursLocales.length > 0 || message) && (
          <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-3 z-30 -mx-2 rounded-3xl bg-white/95 backdrop-blur border border-slate-200 shadow-float p-3 space-y-2">
            {(erreursLocales.length > 0 || erreur) && (
              <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 text-xs text-rose-800 space-y-0.5">
                {[...erreursLocales, ...(erreur ? [erreur] : [])].map((e) => <p key={e}>• {e}</p>)}
              </div>
            )}
            {message && !modifie && (
              <div role="status" className="flex items-start gap-2 bg-suguba-menthe rounded-2xl p-2.5 text-xs text-suguba-profond">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{message}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-xs text-slate-600">
                {modifie ? <strong className="text-slate-900">Non enregistré<span className="hidden sm:inline"> : vos modifications attendent</span></strong> : 'Tout est enregistré'}
              </p>
              {modifie && (
                <button type="button" onClick={annuler}
                  className="min-h-[44px] px-3.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Annuler
                </button>
              )}
              <button type="button" onClick={enregistrer} disabled={envoi || !modifie || erreursLocales.length > 0}
                className="min-h-[44px] px-5 rounded-full bg-suguba-profond text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform">
                {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Calculs d'affichage ───────────────────────────

function libelleMode(r: ReglagesPlateforme): string {
  switch (r.modePartSuguba) {
    case 'prelevement_revendeur': return `${r.tauxPartSuguba} % prélevés sur le revendeur`;
    case 'prix_vente': return `${r.tauxPartSuguba} % du prix de vente`;
    case 'part_revendeur': return `${r.tauxPartSuguba} % de la part revendeur`;
    default: return 'Commission automatique';
  }
}

/** Prix client et partage d'une vente, exactement comme à la publication d'un produit. */
function venteSimulee(r: ReglagesPlateforme, fournisseur: number, part: number) {
  const auto = r.modePartSuguba === 'auto' || !(part > 0);
  if (auto) {
    const prix = calculerTarif(fournisseur, 0, r).prixRecommande;
    const t = calculerTarif(fournisseur, prix, r);
    return { prix, t, prixCalcule: prix, releve: false, notes: [`calcul auto : ${enF(t.commission)} au revendeur`] };
  }
  const d = prixDepuisPartRevendeur(fournisseur, part, r);
  const t = calculerTarif(fournisseur, d.prixVente, r, part);
  const notes = [
    t.prelevementSuguba > 0 ? `${enF(t.prelevementSuguba)} prélevés sur le revendeur` : '',
    d.releveAuPlancher ? `relevé au plancher (sans lui : ${enF(d.prixCalcule)})` : '',
    t.statut === 'commission_faible' ? 'part trop faible : pas proposé au partage' : '',
  ].filter(Boolean);
  return { prix: d.prixVente, t, prixCalcule: d.prixCalcule, releve: d.releveAuPlancher, notes };
}

/** Le plus gros coût d'une vente, pour expliquer un prix relevé. */
function plusGrosCout(t: DetailTarif): [string, number] {
  const couts: [string, number][] = [
    ['la provision pour refus', t.provisionRefus],
    ['les frais de paiement', t.coutPaiement],
    ['les coûts fixes', t.coutFixe],
    ['la livraison non couverte', t.deficitLivraison],
    ['le versement de la commission', t.fraisVersement],
  ];
  return couts.sort((a, b) => b[1] - a[1])[0];
}

// ─────────────────────────── Où va l'argent ───────────────────────────

function OuVaLArgent({ r, exemple, setExemple }: {
  r: ReglagesPlateforme;
  exemple: { fournisseur: number; part: number };
  setExemple: (e: { fournisseur: number; part: number }) => void;
}) {
  const v = venteSimulee(r, exemple.fournisseur, exemple.part);
  const { t, prix } = v;
  const couts = t.coutParCommande + t.fraisVersement;
  const marge = t.margeNetteSuguba;
  const total = Math.max(1, prix);
  const segments = [
    { cle: 'Fournisseur', montant: t.prixFournisseur, classe: 'bg-slate-300' },
    { cle: 'Revendeur', montant: t.commission, classe: 'bg-suguba-citron' },
    { cle: 'Coûts', montant: couts, classe: 'bg-amber-300' },
    { cle: 'Suguba', montant: Math.max(0, marge), classe: 'bg-suguba-profond' },
  ];
  const [nomCout, montantCout] = plusGrosCout(t);

  return (
    <div className="rounded-3xl bg-suguba-sauge p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Où va l&apos;argent d&apos;une vente</p>
          <p className="text-xs text-slate-600">Un produit exemple, avec les réglages en cours.</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-600">Le client paie</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{enF(prix)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-slate-700">Prix fournisseur
          <Montant large valeur={exemple.fournisseur} libelle="Prix fournisseur de l'exemple" onChange={(f) => setExemple({ ...exemple, fournisseur: f })} />
        </label>
        <label className="text-xs font-semibold text-slate-700">Part revendeur
          <Montant large valeur={exemple.part} libelle="Part revendeur de l'exemple" onChange={(p) => setExemple({ ...exemple, part: p })} />
        </label>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white" aria-hidden="true">
        {segments.map((s) => s.montant > 0 && (
          <div key={s.cle} className={s.classe} style={{ width: `${(s.montant / total) * 100}%` }} />
        ))}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {segments.map((s) => (
          <div key={s.cle} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${s.classe}`} />{s.cle === 'Suguba' ? 'Suguba (net)' : s.cle}</dt>
            <dd className="font-semibold text-slate-900 tabular-nums whitespace-nowrap">{s.cle === 'Suguba' ? enF(marge) : enF(s.montant)}</dd>
          </div>
        ))}
      </dl>
      {t.prelevementSuguba > 0 && (
        <p className="text-xs text-slate-600">
          Dont <strong>{enF(t.prelevementSuguba)}</strong> prélevés sur la part revendeur ({enF(t.commissionBrute)} → {enF(t.commission)}).
        </p>
      )}
      {v.releve && (
        <p className="text-xs text-slate-800 bg-white rounded-2xl p-2.5">
          <strong>Prix relevé au plancher.</strong> Fournisseur + revendeur{r.modePartSuguba !== 'prelevement_revendeur' ? ' + part Suguba' : ''} donnaient{' '}
          {enF(v.prixCalcule)} ; il faut {enF(prix)} pour couvrir {enF(couts)} de coûts par commande. Le plus lourd :{' '}
          {nomCout} ({enF(montantCout)}). Tant que le plancher décide, changer votre taux ne change pas le prix client.
        </p>
      )}
      {t.statut === 'commission_faible' && (
        <p className="text-xs text-amber-800">Part revendeur sous le minimum ({enF(r.commissionMinimale)}) : ce produit ne serait pas proposé au partage.</p>
      )}
    </div>
  );
}

// ─────────────────────────── Éléments de formulaire ───────────────────────────

/** 16 px sur téléphone : en dessous, iPhone zoome dès qu'on touche le champ. */
const CHAMP = 'h-11 px-3 rounded-xl border border-slate-200 bg-white text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond/30 focus:border-suguba-profond';

/** Accepte « 1,5 » comme « 1.5 » et les espaces de milliers ; vide = 0. */
function lireNombre(texte: string): number | null {
  const net = texte.replace(/\s/g, '').replace(',', '.');
  if (net === '') return 0;
  const n = Number(net);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Champ numérique tolérant : on peut l'effacer ou taper une virgule sans que la valeur saute. */
function ChampNombre({ valeur, onChange, libelle, className }: { valeur: number; onChange: (v: number) => void; libelle?: string; className: string }) {
  const [texte, setTexte] = useState(String(valeur));
  useEffect(() => {
    if (lireNombre(texte) !== valeur) setTexte(String(valeur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);
  return (
    <input type="text" inputMode="decimal" aria-label={libelle} value={texte}
      onChange={(e) => {
        setTexte(e.target.value);
        const n = lireNombre(e.target.value);
        if (n !== null) onChange(n);
      }}
      className={`${CHAMP} ${className} tabular-nums`} />
  );
}

function Montant({ valeur, onChange, libelle, large = false }: { valeur: number; onChange: (v: number) => void; libelle: string; large?: boolean }) {
  return <ChampNombre valeur={valeur} onChange={onChange} libelle={libelle} className={large ? 'w-full mt-1 text-right' : 'w-28 shrink-0 text-right'} />;
}

function Section({ id, titre, aide, children }: { id?: string; titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section id={id ? `reglage-${id}` : undefined} className="space-y-3 scroll-mt-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{titre}</h4>
        {aide && <p className="text-xs text-slate-500 mt-0.5">{aide}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Num({ l, v, on, suffixe, aide }: { l: string; v: number; on: (v: number) => void; suffixe?: string; aide?: string }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {l}
      <div className="flex items-center mt-1">
        <ChampNombre valeur={v} onChange={on} className="flex-1 min-w-0" />
        {suffixe && <span className="ml-2 text-xs font-normal text-slate-500 whitespace-nowrap">{suffixe}</span>}
      </div>
      {aide && <span className="block mt-1 text-xs font-normal text-slate-500">{aide}</span>}
    </label>
  );
}

function PastilleStatut({ statut }: { statut: string }) {
  if (statut === 'ok') return <span className="shrink-0 rounded-full bg-suguba-menthe text-suguba-profond text-xs font-semibold px-2 py-0.5">Rentable</span>;
  return (
    <span className="shrink-0 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold px-2 py-0.5">
      {statut === 'sous_plancher' ? 'Sous le plancher' : 'Commission trop faible'}
    </span>
  );
}

function Avertissement({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-2xl p-3">
      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-900">{children}</p>
    </div>
  );
}

function BoutonSupprimer({ libelle, onClick }: { libelle: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={libelle} onClick={onClick}
      className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

function BoutonAjouter({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="min-h-[40px] px-3.5 rounded-full bg-suguba-menthe text-xs font-semibold text-suguba-profond inline-flex items-center gap-1.5">
      <Plus className="w-3.5 h-3.5" />{children}
    </button>
  );
}

function AjoutVille({ onAjout }: { onAjout: (ville: string) => void }) {
  const [ville, setVille] = useState('');
  return (
    <div className="flex gap-2">
      <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Nouvelle ville" aria-label="Nouvelle ville"
        className={`${CHAMP} flex-1 min-w-0`} />
      <button type="button" disabled={!ville.trim()} onClick={() => { onAjout(ville.trim()); setVille(''); }}
        className="min-h-[44px] px-3.5 rounded-full bg-suguba-menthe text-xs font-semibold text-suguba-profond disabled:opacity-40 inline-flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />Ajouter
      </button>
    </div>
  );
}
