'use client';

import BarreEnregistrement from '@/components/ui/BarreEnregistrement';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import {
  Calculator, ChevronDown, ChevronUp, Plus, Trash2, AlertCircle, RotateCcw, ArrowRight, Info,
} from 'lucide-react';
import {
  calculerFraisRetrait,
  calculerTarifGros,
  coutCourseRefusee,
  prixConseilleGros,
  prixMinimalGros,
  tarifProduit,
  type ModeGainGros,
  type ReglagesPrixDeGros,
  coutFixeParCommande,
  prixDepuisPartRevendeur,
  totalCoutsFixes,
  validerReglages,
  type ModePartSuguba,
  type ReglagesPlateforme,
  ROLES_RETRAIT,
  tauxRetraitSuguba,
  type DetailFraisRetrait,
  type MoyenRetrait,
  type RoleRetrait,
} from '@/lib/pricing';
import {
  calculerFraisPaiement,
  completerFraisPaiement,
  estimerRetraitAgent,
  LIBELLES_MOYENS,
  OPERATEURS_RETRAIT,
  texteTranche,
  type GrilleRetraitOperateur,
  type MoyenPaiementClient,
  type PalierSasPay,
  type ReglagesFraisPaiement,
  type TarifsSasPay,
  type TrancheRetrait,
} from '@/lib/frais-paiement';
import { commissionExpliquee, simulerCycle, type EntreeCycle } from '@/lib/cycle-vente';
import { formatF, FORMAT_DATE } from '@/lib/montant';

// Espace insécable avant « F » : « 20 000 » et « F » ne se séparent jamais en fin de ligne.
const enF = formatF;

interface ProduitEnLigne {
  id: string;
  name: string;
  supplier_price: number;
  public_price: number;
  reseller_commission: number | null;
  commission_proposee: number | null;
  mode_prix?: string | null;
  prix_conseille?: number | null;
}

const MODES_GROS: [ModeGainGros, string, string][] = [
  ['marge_revendeur', '% de la marge du revendeur', 'Le revendeur vend au prix qu’il veut ; Suguba garde un % de ce qu’il gagne.'],
  ['ajout_prix_gros', '% ajouté au prix de gros', 'Le revendeur achète au prix de gros + ce % ; tout ce qu’il vend au-dessus est pour lui.'],
  ['montant_fixe', 'Montant fixe par article', 'Suguba prend la même somme sur chaque article vendu.'],
  ['aucun', 'Aucun gain (lancement)', 'Suguba ne prend rien au-delà de ses coûts couverts.'],
];

const MODES: [ModePartSuguba, string, string][] = [
  ['prelevement_revendeur', 'Prélevé sur le revendeur', 'Le client paie prix fournisseur + part revendeur. Suguba garde un % de la part revendeur (ex. 1 % au lancement).'],
  ['prix_vente', '% du prix de vente', 'Suguba ajoute un pourcentage au prix payé par le client.'],
  ['part_revendeur', '% de la part revendeur, payé par le client', 'Suguba ajoute au prix client un % de ce que le fournisseur laisse au revendeur.'],
  ['auto', 'Automatique', 'Le fournisseur ne choisit rien : Suguba calcule la commission.'],
];

const SectionActive = React.createContext('bloc-commission');

const SECTIONS = [
  ['bloc-commission', 'Commission'],
  ['bloc-paiement', 'Paiement'],
  ['bloc-retraits', 'Retraits'],
  ['bloc-rentabilite', 'Rentabilité'],
  ['bloc-autres', 'Livraison et formules'],
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
export default function EconomicSettingsPanel({ ouvertParDefaut = false }: { ouvertParDefaut?: boolean } = {}) {
  const { demander } = useToast();
  // Page dédiée « Paramètres et commissions » (U2) : ouvert d'emblée.
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const [sectionActive, setSectionActive] = useState('bloc-commission');
  const panneau = React.useRef<HTMLDivElement>(null);
  const [r, setR] = useState<ReglagesPlateforme | null>(null);
  const [initial, setInitial] = useState('');
  const [confirme, setConfirme] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [recalculAReprendre, setRecalculAReprendre] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [alertes, setAlertes] = useState<{ id: string; nom: string; statut: string; prixVente: number; prixMinimal: number }[]>([]);
  const [produits, setProduits] = useState<ProduitEnLigne[]>([]);
  // Tarifs SasPay relus automatiquement : ancien = relevé de plus de 6 heures.
  const [releveAncien, setReleveAncien] = useState(false);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (SECTIONS.some(([id]) => id === section)) setSectionActive(section!);
    fetch('/api/admin/settings')
      .then(async (res) => { const json = await res.json(); if (!res.ok || !json.reglages) throw new Error(json.error || 'Réglages indisponibles.'); return json; })
      .then((json) => {
        if (json.reglages) {
          setR(json.reglages);
          setInitial(JSON.stringify(json.reglages));
          setConfirme(Boolean(json.confirme));
          setProduits(json.produits || []);
          setReleveAncien(json.tarifsSasPay?.ancien === true);
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

  const impact = useMemo(() => {
    if (!r) return [];
    return produits.map((p) => {
      const pf = Number(p.supplier_price) || 0;
      const pv = Number(p.public_price) || 0;
      const gros = p.mode_prix === 'gros';
      const t = tarifProduit({ prixFournisseur: pf, prixVente: pv, commissionProposee: p.commission_proposee, modePrix: gros ? 'gros' : 'fixe' }, r);
      const conseille = gros
        ? prixConseilleGros(pf, r, p.prix_conseille)
        : r.modePartSuguba !== 'auto' && Number(p.commission_proposee) > 0
          ? prixDepuisPartRevendeur(pf, Number(p.commission_proposee), r).prixVente
          : t.prixRecommande;
      return { p, t, avant: Number(p.reseller_commission) || 0, conseille };
    });
  }, [r, produits]);
  const nbCommissionChange = impact.filter((l) => l.t.commission !== l.avant).length;
  const nbARevoir = impact.filter((l) => l.t.statut !== 'ok' || l.t.margeNetteSuguba < 0).length;

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
    const invalide = panneau.current?.querySelector<HTMLInputElement>('input:invalid');
    if (invalide) { invalide.reportValidity(); return; }
    setErreur('');
    setMessage('');
    setEnvoi(true);
    try {
      const envoyer = (motif?: string) => fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reglages: r, baseReglages: JSON.parse(initial), motif }),
      });
      let res = await envoyer();
      let json = await res.json();
      // Baisse de la part Suguba (Protection Suguba, lot 3) : motif obligatoire, gardé au journal.
      if (res.status === 409 && json.motifRequis) {
        const liste = (json.baisses || []).map((b: { libelle: string }) => `• ${b.libelle}`).join('\n');
        const motif = await demander({
          titre: 'Ces changements réduisent la part de Suguba', message: liste,
          libelle: 'Motif (promotion, lancement, accord commercial…)', min: 5, confirmer: 'Enregistrer',
        });
        if (!motif) { setErreur('Rien n’a été enregistré : un motif est obligatoire pour baisser la part de Suguba.'); return; }
        res = await envoyer(motif);
        json = await res.json();
      }
      if (!res.ok) {
        setErreur(json.error || 'Échec de l\'enregistrement.');
        return;
      }
      setConfirme(true);
      setR(json.reglages || r);
      setInitial(JSON.stringify(json.reglages || r));
      setAlertes(json.alertes || []);
      setRecalculAReprendre(Boolean(json.avertissement));
      // Les commissions affichées « avant » deviennent celles qu'on vient d'écrire.
      if (!json.avertissement) setProduits((liste) => liste.map((p) => {
        const t = tarifProduit({
          prixFournisseur: Number(p.supplier_price), prixVente: Number(p.public_price),
          commissionProposee: p.commission_proposee, modePrix: p.mode_prix === 'gros' ? 'gros' : 'fixe',
        }, json.reglages || r);
        return { ...p, reseller_commission: t.commission };
      }));
      setMessage(`Réglages enregistrés. Commission recalculée sur ${json.recalcules} produit(s) en ligne.${json.avertissement ? ` ${json.avertissement}` : ''}`);
    } catch {
      setErreur('Connexion interrompue : l’enregistrement n’a pas pu être confirmé. Rechargez avant de réessayer.');
    } finally {
      setEnvoi(false);
    }
  };

  const allerA = (id: string) => {
    const invalide = panneau.current?.querySelector<HTMLInputElement>('input:invalid');
    if (invalide) { invalide.reportValidity(); return; }
    const groupes: Record<string, string> = { couts: 'bloc-rentabilite', impact: 'bloc-rentabilite', simulation: 'bloc-rentabilite', paiement: 'bloc-paiement', livraison: 'bloc-autres' };
    setSectionActive(groupes[id] || id);
    setOuvert(true);
    requestAnimationFrame(() => panneau.current?.scrollIntoView({ block: 'start' }));
  };
  const coutProvisoire = r?.coutsFixesMensuels.some((l) => /provisoire/i.test(l.libelle) && Number(l.montant) > 0);

  return (
    <div ref={panneau} className="scroll-mt-16 lg:scroll-mt-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div className="w-9 h-9 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">Réglages économiques</h3>
            <p className="text-xs text-slate-600 truncate">
              {chargement ? <><SugubaLoader className="mr-2 h-4 w-4" />Chargement…</> : !confirme
                ? '⚠️ Coûts non confirmés — estimation provisoire en vigueur'
                : r ? `${libelleMode(r)} · coûts, livraison, codes promo` : 'Coûts, commissions, livraison, codes promo'}
            </p>
          </div>
        </div>
        {ouvert ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />}
      </button>

      {erreur && !r && <div role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800">{erreur} <button onClick={() => window.location.reload()} className="underline">Réessayer</button></div>}
      {ouvert && r && (
        <SectionActive.Provider value={sectionActive}><div className="space-y-6">
          <nav aria-label="Sections des réglages" className="sticky top-14 lg:top-0 z-20 bg-white py-3 grid grid-cols-2 xl:grid-cols-5 gap-2">
            {SECTIONS.map(([id, libelle]) => (
              <button key={id} type="button" onClick={() => allerA(id)} aria-pressed={sectionActive === id}
                className={`min-h-[44px] px-3.5 rounded-xl border text-sm font-semibold ${sectionActive === id ? "bg-suguba-profond text-white border-suguba-profond" : "border-slate-200 bg-white text-slate-700 hover:border-suguba-profond"}`}>
                {libelle}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><p>Les changements restent en brouillon jusqu’à l’enregistrement. Les commandes existantes ne changent pas.</p><button type="button" className="font-semibold underline" onClick={() => allerA('impact')}>Simuler et voir l’impact</button></div>

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

          <Bloc id="bloc-commission" titre="Commission commerciale Suguba" moment="S’applique à la vente">
            {/* ── Rémunération de Suguba ─────────────────────────────────── */}
            <Section id="modele" titre="Commission sur les articles à prix fixe"
              aide="Le fournisseur indique combien il laisse au revendeur. Choisissez sur quoi Suguba prend sa commission, et qui la paie.">
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
              <div className="sm:col-span-2 space-y-2 rounded-2xl bg-suguba-sauge p-3">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                  Les coûts de Suguba (refus, message, coûts fixes…)
                  <InfoBulle texte="Recommandé : « Payés sur la part Suguba ». Le client paie alors exactement prix fournisseur + part revendeur, rien de plus. Si votre part ne suffit pas à couvrir vos coûts, la perte apparaît dans le simulateur (bloc Coûts et rentabilité)." />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Qui paie les coûts de Suguba">
                  {([
                    [false, 'Payés sur la part Suguba', 'Les coûts sont absorbés par Suguba, sans supplément de coûts au client'],
                    [true, 'Ajoutés au prix client', 'Le prix est relevé jusqu’à couvrir les coûts (plancher)'],
                  ] as const).map(([valeur, libelle, detail]) => {
                    const actif = (r.couvrirCoutsDansLePrix === true) === valeur;
                    return (
                      <button key={libelle} type="button" role="radio" aria-checked={actif} onClick={() => maj('couvrirCoutsDansLePrix', valeur)}
                        className={`rounded-2xl border p-2.5 text-left bg-white ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond' : 'border-slate-200'}`}>
                        <span className="block text-xs font-semibold text-slate-900">{libelle}</span>
                        <span className="block text-xs text-slate-600">{detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {r.modePartSuguba !== 'auto' && (
                <>
                  <Num
                    l={r.modePartSuguba === 'prix_vente' ? 'Part Suguba (% du prix de vente)'
                      : r.modePartSuguba === 'prelevement_revendeur' ? 'Prélèvement Suguba (% de la part revendeur)'
                        : 'Part Suguba (% de la part revendeur)'}
                    suffixe="%" v={r.tauxPartSuguba} on={(v) => maj('tauxPartSuguba', v)}
                    info={r.modePartSuguba === 'prelevement_revendeur'
                      ? "Suguba garde ce % de la part que le fournisseur laisse au revendeur. Rien n'est ajouté au prix client. Exemple : part revendeur 500 F à 1 % → Suguba 5 F, le revendeur reçoit 495 F."
                      : "Attention : dans ce mode, ce % est AJOUTÉ au prix payé par le client. Pour que le client paie seulement fournisseur + revendeur, choisissez « Prélevé sur le revendeur »."}
                  />
                  {/* Pas de minimum en francs quand Suguba se sert sur le revendeur :
                      1 000 F sur une part de 500 F n'aurait aucun sens. */}
                  {r.modePartSuguba !== 'prelevement_revendeur' && (
                    <Num l="Part minimale Suguba par vente" suffixe="F" v={r.minimumPartSuguba} on={(v) => maj('minimumPartSuguba', v)}
                      info="Montant ajouté au prix client si le pourcentage ci-dessus donne moins que ça. À 0, rien de plus n'est ajouté." />
                  )}
                </>
              )}
              <ExplicationCommission c={commissionExpliquee(r, 'fixe')} />
            </Section>

            {/* ── Prix de gros ──────────────────────────────────────────── */}
            <Section id="gros" titre="Articles au prix de gros"
              aide="Le fournisseur donne son prix de gros, le revendeur vend au prix qu’il veut (jamais sous le minimal). Choisissez comment Suguba se rémunère sur ces ventes : vous pouvez changer à tout moment.">
              <PrixDeGrosReglages g={r.prixDeGros as ReglagesPrixDeGros} r={r} onChange={(g) => maj('prixDeGros', g)} />
              <ExplicationCommission c={commissionExpliquee(r, 'gros')} />
            </Section>

            <Section titre="Politique commerciale"
              aide={r.modePartSuguba === 'auto'
                ? 'Mode automatique : ces valeurs calculent la commission de chaque produit.'
                : 'La part revendeur et la commission visée ne servent qu’aux produits sans part revendeur choisie par le fournisseur.'}>
              {r.couvrirCoutsDansLePrix && (
                <Num l="Marge nette minimale Suguba" suffixe="% du prix" v={r.margeNetteMinPct} on={(v) => maj('margeNetteMinPct', v)}
                  info="Seulement quand les coûts sont ajoutés au prix client : le prix est relevé jusqu'à ce que Suguba garde au moins ce % du prix de vente, une fois tous ses coûts payés." />
              )}
              <Num l="Part revendeur du reste à partager" suffixe="%" v={r.partRevendeurPct} on={(v) => maj('partRevendeurPct', v)}
                info="Ne sert qu'en mode Automatique, ou pour un fournisseur qui n'a pas proposé de part revendeur : une fois les coûts et la marge minimale couverts, ce % du reste va au revendeur, le reste à Suguba." />
              <Num l="Commission minimale pour être partagé" suffixe="F" v={r.commissionMinimale} on={(v) => maj('commissionMinimale', v)}
                info="En dessous de ce montant, la commission est jugée trop faible : le produit reste vendable, mais n'est plus proposé au partage avec les revendeurs (statut « Commission trop faible » dans « Vos produits »)." />
              <Num l="Commission visée (prix recommandé)" suffixe="% du prix fourn." v={r.commissionCiblePct} on={(v) => maj('commissionCiblePct', v)}
                info="Sert seulement à calculer le « prix conseillé » suggéré au fournisseur — un objectif de commission pour le revendeur, en % du prix fournisseur. N'affecte jamais un prix déjà en ligne." />
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
          </Bloc>

          <Bloc id="bloc-paiement" titre="Frais de paiement du client" moment="S’applique à l’encaissement">
            {/* ── Frais de paiement, payés par le client ─────────────────── */}
            <Section id="paiement" titre="Frais de paiement (payés par le client)"
              aide="En espèces à la livraison : aucun frais. En Mobile Money : le client paie sa commande plus les frais ci-dessous, détaillés ligne par ligne avant qu'il valide.">
              <FraisPaiementReglages f={completerFraisPaiement(r.fraisPaiement)} ancien={releveAncien}
                onChange={(f) => maj('fraisPaiement', f)}
                onRelu={(tarifs) => {
                  // Déjà enregistrés par la relecture : mis à jour à l'écran ET dans
                  // la référence, pour ne pas les signaler « non enregistrés ».
                  const avec = <T extends { fraisPaiement?: ReglagesFraisPaiement }>(o: T): T => ({ ...o, fraisPaiement: { ...completerFraisPaiement(o.fraisPaiement), saspay: tarifs } });
                  setR((prev) => (prev ? avec(prev) : prev));
                  setInitial((prev) => (prev ? JSON.stringify(avec(JSON.parse(prev))) : prev));
                  setReleveAncien(false);
                }} />
            </Section>
          </Bloc>

          <Bloc id="bloc-retraits" titre="Frais de retrait des partenaires" moment="S’applique au retrait">
            {/* ── Retraits : frais Suguba, au moment du retrait ─────────────── */}
            <Section id="retraits" titre="Frais Suguba sur les retraits"
              aide="Calculés au moment du retrait, sur le montant retiré du solde : retirer 10 000 F débite 10 000 F, les frais sont déduits et le bénéficiaire reçoit le reste. Jamais prélevés à la vente. 0 % est accepté tel quel.">
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES_RETRAIT.map((role) => (
                  <div key={role} className="rounded-2xl border border-slate-200 p-3 space-y-2">
                    <p className="text-sm font-semibold text-slate-900">{role === 'revendeur' ? 'Revendeur' : 'Fournisseur'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['caisse', 'mobile'] as const).map((cle) => (
                        <Num key={cle} l={cle === 'caisse' ? 'À la caisse' : 'Mobile Money'} suffixe="%"
                          v={tousLesTaux(r)[role][cle]}
                          on={(v) => { const t = tousLesTaux(r); maj('fraisRetraitSuguba', { ...t, [role]: { ...t[role], [cle]: v } }); }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="sm:col-span-2 text-xs text-slate-600">
                Le fournisseur retire son argent depuis « Mes paiements », au taux fournisseur. Remettre à Suguba les espèces collectées n&apos;est pas un retrait : aucun frais.
              </p>
              <div className="sm:col-span-2 rounded-2xl bg-suguba-sauge p-3 text-xs text-slate-700 space-y-0.5">
                <p className="font-semibold">Autres frais d&apos;un retrait Mobile Money : le virement SasPay (tarif du compte, relu seul)</p>
                {(['orange_ml', 'moov_ml', 'wave_ml'] as const).map((code) => {
                  const p = completerFraisPaiement(r.fraisPaiement).saspay.reseaux[code]?.versement[0];
                  return <p key={code}>{LIBELLES_MOYENS[code]} : <strong>{p ? textePalier(p) : `inconnu, taux de secours ${r.fraisVersementPct} %`}</strong></p>;
                })}
              </div>
              <Num l="Taux SasPay de secours" suffixe="%" v={r.fraisVersementPct} on={(v) => maj('fraisVersementPct', v)}
                info="Ne sert que pour un réseau dont SasPay n'a pas donné de tarif. Sinon, le vrai tarif SasPay s'applique. Payé par celui qui retire." />
              {([['orange_money', 'Frais Orange Money en plus'], ['moov', 'Frais Moov Money en plus'], ['wave', 'Frais Wave en plus']] as const).map(([cle, libelle]) => (
                <Num key={cle} l={libelle} suffixe="%" v={r.fraisOperateurRetraitPct?.[cle] ?? 0}
                  on={(v) => maj('fraisOperateurRetraitPct', { orange_money: 0, moov: 0, wave: 0, mobi_cash: 0, ...r.fraisOperateurRetraitPct, [cle]: v })}
                  info="Frais de l'opérateur sur le virement lui-même, en plus de SasPay. Laissez 0 si le tarif SasPay les inclut déjà : un même coût ne doit jamais être compté deux fois." />
              ))}
              <Num l="Retrait minimum" suffixe="F" v={r.retraitMinimum} on={(v) => maj('retraitMinimum', v)}
                info="Le solde minimum qu'un bénéficiaire doit atteindre avant de pouvoir demander un retrait." />
              {/* Lot C (2026-09-27) : lu aussi par la base, à chaque livraison. */}
              <Num l="Délai avant retrait des fournisseurs" suffixe="jours" v={r.delaiGainFournisseurJours} on={(v) => maj('delaiGainFournisseurJours', v)}
                info="Après la livraison, le montant dû au fournisseur reste bloqué ce nombre de jours (le temps d'un éventuel retour), puis devient retirable dès que l'argent de la vente est chez Suguba. Entre 0 et 60 jours. S'applique aux livraisons suivantes." />
              <div className="sm:col-span-2 rounded-2xl bg-suguba-sauge p-3 text-xs text-slate-700 space-y-1">
                <p className="font-semibold">Exemple : retrait de 10 000 F</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem]">
                    <thead>
                      <tr className="text-left text-slate-600">
                        <th className="font-semibold py-1 pr-2">Moyen</th>
                        <th className="font-semibold py-1 pr-2 text-right">Le revendeur reçoit</th>
                        <th className="font-semibold py-1 text-right">Le fournisseur reçoit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOYENS_RETRAIT_EXEMPLE.map(([moyen, libelle]) => {
                        const rev = calculerFraisRetrait(10000, moyen, r, 'revendeur');
                        const fou = calculerFraisRetrait(10000, moyen, r, 'fournisseur');
                        return (
                          <tr key={moyen} className="border-t border-white">
                            <td className="py-1 pr-2">{libelle}</td>
                            <td className="py-1 pr-2 text-right tabular-nums"><strong>{enF(rev.montantNet)}</strong> <span className="text-slate-600">(Suguba {enF(rev.fraisSuguba)})</span></td>
                            <td className="py-1 text-right tabular-nums"><strong>{enF(fou.montantNet)}</strong> <span className="text-slate-600">(Suguba {enF(fou.fraisSuguba)})</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>

            <Section id="agent" titre="Retrait en espèces chez un agent (pour information)"
              aide="Prélevés par l'opérateur quand un bénéficiaire retire des espèces chez un agent Orange, Moov ou Wave. Suguba ne les encaisse pas et ne les facture à personne : ils sont montrés au revendeur avant son retrait. Aucune API ne publie ces grilles : corrigez-les ici dès qu'un opérateur change ses prix.">
              <GrillesAgent f={completerFraisPaiement(r.fraisPaiement)} onChange={(f) => maj('fraisPaiement', f)} />
            </Section>
          </Bloc>

          <Bloc id="bloc-rentabilite" titre="Coûts et rentabilité" moment="Pour l’analyse : rien n’est prélevé">
            {/* ── Simulateur du cycle complet ────────────────────────────── */}
            <Section id="simulation" titre="Simulateur : vente, encaissement, retraits"
              aide="Un article imaginaire, avec les réglages en cours. Chaque frais est rattaché à son opération ; les retraits restent prévisionnels.">
              <SimulateurCycle r={r} />
            </Section>

            {/* ── Impact sur les produits en ligne ───────────────────────── */}
            <Section id="impact" titre={`Produits analysés (${impact.length}${impact.length === 300 ? ' — aperçu limité à 300' : ''})`}
              aide="Calculé en direct avec les réglages ci-dessus, avant d'enregistrer. Enregistrer met à jour la commission ; le prix affiché au client ne change jamais tout seul.">
              <div className="sm:col-span-2 space-y-2">
                {impact.length === 0 ? (
                  <p className="text-xs text-slate-600">Aucun produit en ligne pour l&apos;instant.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-700">
                      {modifie
                        ? <>Si vous enregistrez : <strong>{nbCommissionChange}</strong> commission(s) changent{nbARevoir > 0 && <>, <strong className="text-rose-700">{nbARevoir}</strong> produit(s) à revoir</>}.</>
                        : nbARevoir > 0 ? <><strong className="text-rose-700">{nbARevoir}</strong> produit(s) à revoir avec les réglages actuels.</> : 'Les produits de cet aperçu sont rentables avec les réglages actuels.'}
                    </p>
                    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                      {impact.map(({ p, t, avant, conseille }) => (
                        <li key={p.id} className="p-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 min-w-0 truncate">
                              {p.name}
                              {p.mode_prix === 'gros' && <span className="ml-1.5 align-middle rounded-full bg-suguba-citron text-suguba-profond text-xs font-semibold px-2 py-0.5">Prix de gros</span>}
                            </p>
                            <PastilleStatut statut={t.statut} margeNette={t.margeNetteSuguba} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 [&>span]:whitespace-nowrap">
                            <span>Fournisseur <strong className="text-slate-900">{enF(t.prixFournisseur)}</strong></span>
                            <span>Prix client <strong className="text-slate-900">{enF(t.prixVente)}</strong></span>
                            <span className="inline-flex items-center gap-1">
                              Revendeur{' '}
                              {t.commission !== avant && <><s className="text-slate-600">{enF(avant)}</s><ArrowRight className="w-3 h-3" /></>}
                              <strong className="text-slate-900">{enF(t.commission)}</strong>
                            </span>
                            <span>Marge Suguba <strong className={t.margeNetteSuguba < 0 ? 'text-rose-700' : 'text-slate-900'}>{enF(t.margeNetteSuguba)}</strong></span>
                          </div>
                          {Math.abs(conseille - t.prixVente) >= r.arrondiPrix && (
                            <p className="text-xs text-slate-600">
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
              aide={r.couvrirCoutsDansLePrix
                ? 'Ils forment le « plancher » : aucun prix ne descend en dessous, quel que soit votre taux.'
                : 'Payés sur la part Suguba : ils ne changent pas le prix client. Ils servent à calculer votre marge nette réelle.'}>
              <p className="sm:col-span-2 text-xs text-slate-600">
                Les frais de paiement Mobile Money ne sont plus un coût de Suguba : le client les paie (voir{' '}
                <button type="button" className="underline font-semibold" onClick={() => allerA('paiement')}>Frais de paiement</button>).
              </p>
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
                        <span className="block text-xs text-slate-600">{aide}</span>
                      </button>
                    );
                  })}
                </div>
                <Num l={r.baseProvisionRefus === 'course' ? 'Part des livraisons refusées' : 'Provision (% du prix de vente)'}
                  suffixe="%" v={r.provisionRefusPct} on={(v) => maj('provisionRefusPct', v)}
                  info="Une réserve mise de côté sur chaque vente pour absorber les livraisons refusées à la porte (fréquent en paiement à la livraison : 10 à 20 % de refus est courant). Sans elle, chaque refus serait une perte sèche pour Suguba." />
                <p className="text-xs text-slate-600">
                  {r.baseProvisionRefus === 'course'
                    ? <>Soit <strong>{enF((r.provisionRefusPct / 100) * coutCourseRefusee(r))}</strong> par commande ({r.provisionRefusPct} % × {enF(coutCourseRefusee(r))}, livreur aller + retour). En paiement à la livraison, 10 à 20 % de refus sont courants : mettez votre taux réel.</>
                    : <>Soit <strong>{enF(r.provisionRefusPct * 1000)}</strong> sur un article à 100 000 F, <strong>{enF(r.provisionRefusPct * 4000)}</strong> sur un article à 400 000 F.</>}
                </p>
              </div>
              <Num l="Message au client (SMS / WhatsApp)" suffixe="F" v={r.coutMessageParCommande} on={(v) => maj('coutMessageParCommande', v)}
                info="Le coût du message envoyé au client pour chaque commande (confirmation, suivi). Compté comme un coût variable, donc inclus dans le plancher de prix de chaque vente." />
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
              <Num l="Volume de référence (commandes/mois)" v={r.volumeReference} on={(v) => maj('volumeReference', v)}
                info="Le total des coûts fixes ci-dessus (hébergement, salaires…) est divisé par ce nombre pour obtenir le coût fixe ajouté à chaque commande. Ce n'est pas le volume réellement constaté, juste un objectif : trop bas, ce coût explose et fait grimper tous les prix ; trop haut, il devient presque nul." />
              <div className="bg-suguba-sauge rounded-2xl p-3 text-xs text-slate-700 self-end">
                Total : <strong>{enF(totalCoutsFixes(r))}</strong> / mois, soit <strong>{enF(coutFixeParCommande(r))}</strong> par commande.
              </div>
            </Section>
          </Bloc>

          <Bloc id="bloc-autres" titre="Livraison et formules" moment="Autres réglages">
            {/* ── Livraison ──────────────────────────────────────────────── */}
            <Section id="livraison" titre="Livraison">
              <Num l="Frais par défaut (ville sans tarif)" suffixe="F" v={r.fraisLivraisonClient} on={(v) => maj('fraisLivraisonClient', v)}
                info="Le tarif de livraison facturé au client quand sa ville n'a pas de tarif spécifique ci-dessous (ou, à Bamako, quand les quartiers ne sont pas reconnus pour le calcul à la distance)." />
              <Num l="Rémunération du livreur" suffixe="F" v={r.remunerationLivreur} on={(v) => maj('remunerationLivreur', v)}
                aide={r.remunerationLivreur > r.fraisLivraisonClient ? `${enF(r.remunerationLivreur - r.fraisLivraisonClient)} non couverts par le client, ajoutés au plancher.` : undefined}
                info="Ce que Suguba paie au livreur par course. Si c'est plus que les frais de livraison facturés au client, la différence n'est pas couverte par le client : elle est ajoutée au plancher de coûts, ce qui relève le prix ailleurs." />
              <div className="sm:col-span-2 space-y-2 rounded-2xl bg-suguba-sauge p-3">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                  Espèces encaissées par le livreur
                  <InfoBulle texte="Pour une commande payée à la livraison, le livreur encaisse l'argent puis le remet à la caisse Suguba (écran « Caisse livreurs »). Il peut garder sa rémunération sur place, ou tout verser et être payé à part." />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Rémunération du livreur sur les espèces">
                  {([
                    [true, 'Il garde sa rémunération', `Il verse les espèces moins ${enF(r.remunerationLivreur)} par course`],
                    [false, 'Il verse tout', 'Suguba lui paie sa rémunération à part'],
                  ] as const).map(([valeur, libelle, detail]) => {
                    const actif = (r.livreurGardeRemuneration !== false) === valeur;
                    return (
                      <button key={libelle} type="button" role="radio" aria-checked={actif} onClick={() => maj('livreurGardeRemuneration', valeur)}
                        className={`rounded-2xl border p-2.5 text-left bg-white ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond' : 'border-slate-200'}`}>
                        <span className="block text-xs font-semibold text-slate-900">{libelle}</span>
                        <span className="block text-xs text-slate-600">{detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Lot 4 de l'audit UI/UX (arbitrage) : le portefeuille du livreur dit où verser. */}
              <div className="sm:col-span-2 space-y-2 rounded-2xl bg-suguba-sauge p-3">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                  Où les livreurs versent les espèces
                  <InfoBulle texte="Affiché dans le portefeuille des livreurs connectés (jamais sur le site public). Laissé vide, le livreur demande le lieu et l'heure à Suguba sur WhatsApp." />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="block text-xs font-semibold text-slate-700">Lieu de la caisse</span>
                    <input value={r.caisseLivreurs?.lieu ?? ''} maxLength={160} placeholder="Ex. : bureau Suguba, Hamdallaye, en face de …"
                      onChange={(e) => maj('caisseLivreurs', { lieu: e.target.value, horaires: r.caisseLivreurs?.horaires ?? '' })}
                      className={`${CHAMP} w-full`} />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-semibold text-slate-700">Horaires</span>
                    <input value={r.caisseLivreurs?.horaires ?? ''} maxLength={120} placeholder="Ex. : lundi au samedi, 17 h – 20 h"
                      onChange={(e) => maj('caisseLivreurs', { lieu: r.caisseLivreurs?.lieu ?? '', horaires: e.target.value })}
                      className={`${CHAMP} w-full`} />
                  </label>
                </div>
              </div>
              <Num l="Alerte espèces non versées après" suffixe="h" v={r.delaiVersementEspecesHeures ?? 24} on={(v) => maj('delaiVersementEspecesHeures', v)}
                info="Au-delà de ce délai après la livraison, la Caisse livreurs signale le livreur en orange ; au double, en rouge." />
              <Num l="Plafond d’espèces non versées" suffixe="F" v={r.plafondEspecesCollecteur ?? 150000} on={(v) => maj('plafondEspecesCollecteur', v)}
                info="Au-delà (ou après le double du délai), le livreur ou le fournisseur ne reçoit plus de nouvelle commande payée en espèces jusqu’à son versement. Les courses en cours, le SAV et le versement restent possibles. 0 = pas de plafond." />
              <div className="sm:col-span-2 space-y-2 rounded-2xl bg-suguba-sauge p-3">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                  Paiement par carte bancaire (diaspora)
                  <InfoBulle texte="Ouvrez-le seulement après un vrai paiement test réussi par carte sur SasPay. Fermé, la page diaspora propose le paiement à la réception par le proche, et le serveur refuse la carte." />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Paiement par carte bancaire">
                  {([
                    [false, 'Fermé', 'Le proche paie à la réception'],
                    [true, 'Ouvert', 'Carte proposée sur la page diaspora'],
                  ] as const).map(([valeur, libelle, detail]) => {
                    const actif = (r.paiementCarteVerifie === true) === valeur;
                    return (
                      <button key={libelle} type="button" role="radio" aria-checked={actif} onClick={() => maj('paiementCarteVerifie', valeur)}
                        className={`rounded-2xl border p-2.5 text-left bg-white ${actif ? 'border-suguba-profond ring-1 ring-suguba-profond' : 'border-slate-200'}`}>
                        <span className="block text-xs font-semibold text-slate-900">{libelle}</span>
                        <span className="block text-xs text-slate-600">{detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                        <span className="block text-xs text-slate-600">{aide}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {r.modeLivraisonBamako === 'zones' && r.livraisonZonesBamako ? (
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-xs text-slate-600">
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
                  <p className="text-xs text-slate-600">
                    Remplace le tarif « Bamako » quand les quartiers du fournisseur ET du client sont reconnus.
                    Base + (frais/km × distance à vol d&apos;oiseau), entre le minimum et le maximum.
                    Exemple à 3 km : <strong className="text-slate-800">{enF(Math.min(r.livraisonDistanceBamako.fraisMaximum, Math.max(r.livraisonDistanceBamako.fraisMinimum, r.livraisonDistanceBamako.fraisBase + 3 * r.livraisonDistanceBamako.fraisParKm)))}</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Num l="Frais de base" suffixe="F" v={r.livraisonDistanceBamako.fraisBase}
                      on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisBase: v })}
                      info="Le montant de départ du calcul, avant d'ajouter la distance. Formule : base + (frais/km × distance), plafonné entre le minimum et le maximum ci-dessous." />
                    <Num l="Frais par km" suffixe="F" v={r.livraisonDistanceBamako.fraisParKm}
                      on={(v) => maj('livraisonDistanceBamako', { ...r.livraisonDistanceBamako, fraisParKm: v })}
                      info="Ajouté au frais de base pour chaque kilomètre à vol d'oiseau entre le dépôt du fournisseur et le client." />
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

            {/* ── Formules boutiques ─────────────────────────────────────── */}
            <Section id="formules" titre="Formules boutiques"
              aide="Combien de boutiques un revendeur ou un fournisseur peut ouvrir. La formule à 0 F est la version gratuite. Les demandes Pro s’activent dans Back-office › Boutiques.">
              <div className="sm:col-span-2 space-y-2">
                {(r.formulesBoutiques || []).map((f, i) => (
                  <div key={f.id} className="flex gap-2 items-end">
                    <label className="flex-1 min-w-0 text-xs font-semibold text-slate-700">Nom
                      <input value={f.nom} aria-label="Nom de la formule" onChange={(e) => {
                        const l = [...(r.formulesBoutiques || [])]; l[i] = { ...l[i], nom: e.target.value }; maj('formulesBoutiques', l);
                      }} className={`${CHAMP} w-full mt-1`} />
                    </label>
                    <label className="w-28 shrink-0 text-xs font-semibold text-slate-700">F / mois
                      <Montant large valeur={f.prixMensuel} libelle={`Prix de ${f.nom}`} onChange={(v) => {
                        const l = [...(r.formulesBoutiques || [])]; l[i] = { ...l[i], prixMensuel: v }; maj('formulesBoutiques', l);
                      }} />
                    </label>
                    <label className="w-20 shrink-0 text-xs font-semibold text-slate-700">Boutiques
                      <Montant large valeur={f.boutiques} libelle={`Boutiques de ${f.nom}`} onChange={(v) => {
                        const l = [...(r.formulesBoutiques || [])]; l[i] = { ...l[i], boutiques: Math.max(1, Math.round(v)) }; maj('formulesBoutiques', l);
                      }} />
                    </label>
                    {f.prixMensuel > 0 && (
                      <BoutonSupprimer libelle={`Supprimer ${f.nom}`} onClick={() => maj('formulesBoutiques', (r.formulesBoutiques || []).filter((_, j) => j !== i))} />
                    )}
                  </div>
                ))}
                <BoutonAjouter onClick={() => maj('formulesBoutiques', [...(r.formulesBoutiques || []), { id: `formule_${Date.now().toString(36)}`, nom: 'Nouvelle formule', prixMensuel: 10000, boutiques: 10 }])}>
                  Ajouter une formule
                </BoutonAjouter>
              </div>
            </Section>
          </Bloc>

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

          {/* Barre d'enregistrement commune (ADM-13) : reste visible pendant le défilement,
              au-dessus de la barre de navigation du bas sur téléphone. */}
          <BarreEnregistrement
            modifie={modifie}
            envoi={envoi}
            onEnregistrer={enregistrer}
            onAnnuler={annuler}
            erreurs={[...erreursLocales, ...(erreur ? [erreur] : [])]}
            bloque={erreursLocales.length > 0}
            message={message}
            actionDisponible={recalculAReprendre}
            libelle={recalculAReprendre && !modifie ? 'Reprendre l’actualisation du catalogue' : 'Enregistrer les modifications'}
          />
        </div></SectionActive.Provider>
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

// ─────────────────────────── Prix de gros ───────────────────────────

function PrixDeGrosReglages({ g, r, onChange }: { g: ReglagesPrixDeGros; r: ReglagesPlateforme; onChange: (g: ReglagesPrixDeGros) => void }) {
  const [gros, setGros] = useState(20000);
  const conseille = prixConseilleGros(gros, r);
  const minimal = prixMinimalGros(gros, r);
  const t = calculerTarifGros(gros, conseille, r);
  return (
    <>
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Gain de Suguba sur le prix de gros">
        {MODES_GROS.map(([cle, titre, detail]) => {
          const actif = g.modeGain === cle;
          return (
            <button key={cle} type="button" role="radio" aria-checked={actif} onClick={() => onChange({ ...g, modeGain: cle })}
              className={`text-left p-3 rounded-2xl border transition-colors ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 hover:bg-suguba-sauge'}`}>
              <p className="text-sm font-semibold text-slate-900">{titre}</p>
              <p className="text-xs text-slate-600 mt-0.5">{detail}</p>
            </button>
          );
        })}
      </div>
      {(g.modeGain === 'marge_revendeur' || g.modeGain === 'ajout_prix_gros') && (
        <Num l={g.modeGain === 'marge_revendeur' ? 'Part Suguba (% de la marge du revendeur)' : 'Ajout Suguba (% du prix de gros)'}
          suffixe="%" v={g.taux} on={(v) => onChange({ ...g, taux: v })}
          info={g.modeGain === 'marge_revendeur'
            ? "Le revendeur fixe librement son prix de vente. Suguba prend ce % de ce que le revendeur gagne (son prix moins le prix de gros). À 0, le revendeur garde tout."
            : "Le revendeur achète au fournisseur au prix de gros majoré de ce %. Tout ce qu'il revend au-dessus de ce prix majoré est pour lui, Suguba ne touche rien de plus."} />
      )}
      {g.modeGain === 'montant_fixe' && (
        <Num l="Montant Suguba par article" suffixe="F" v={g.montantFixe} on={(v) => onChange({ ...g, montantFixe: v })}
          info="Suguba prend cette même somme en francs sur chaque article vendu en gros, quel que soit son prix." />
      )}
      <Num l="Prix conseillé (si le fournisseur n’en donne pas)" suffixe="% de marge revendeur" v={g.margeConseilleePct}
        on={(v) => onChange({ ...g, margeConseilleePct: v })}
        info="Si le fournisseur ne suggère pas de prix conseillé, Suguba en calcule un en visant cette marge (%) pour le revendeur au-dessus du prix de gros. Le revendeur reste libre de vendre plus cher ou moins cher (jamais sous le prix minimal)." />
      <div className="sm:col-span-2 rounded-2xl bg-suguba-sauge p-3 space-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          Exemple : prix de gros
          <span className="w-32"><Montant valeur={gros} libelle="Prix de gros de l'exemple" onChange={setGros} /></span>
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 [&>span]:whitespace-nowrap">
          <span>Prix minimal <strong className="text-slate-900">{enF(minimal)}</strong></span>
          <span>Prix conseillé <strong className="text-slate-900">{enF(conseille)}</strong></span>
          <span>Revendeur gagne <strong className="text-slate-900">{enF(t.commission)}</strong></span>
          <span>Suguba (net) <strong className={t.margeNetteSuguba < 0 ? 'text-rose-700' : 'text-slate-900'}>{enF(t.margeNetteSuguba)}</strong></span>
        </div>
        <p className="text-xs text-slate-600">Au prix conseillé. Le revendeur peut vendre plus cher (il gagne plus) mais jamais sous le prix minimal.</p>
      </div>
    </>
  );
}

// ─────────────────────────── Éléments de formulaire ───────────────────────────

// ─────────────────────────── Blocs (audit du 2026-09-27) ───────────────────────────

/**
 * Un bloc de réglages. Le badge dit QUAND ces réglages s'appliquent — à la
 * vente, à l'encaissement, au retrait — ou qu'ils ne prélèvent rien.
 */
function Bloc({ id, titre, moment, children }: { id: string; titre: string; moment: string; children: React.ReactNode }) {
  const active = React.useContext(SectionActive);
  if (active !== id) return null;
  return (
    <div id={`reglage-${id}`} className="scroll-mt-4 rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="text-base font-semibold text-slate-900">{titre}</h3>
        <span className="rounded-full bg-suguba-menthe text-suguba-profond text-xs font-semibold px-3 py-1">{moment}</span>
      </div>
      {children}
    </div>
  );
}

/** Choix en pastilles (quelques options courtes). */
function Choix<T extends string>({ libelle, valeur, options, onChange }: {
  libelle: string; valeur: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-700">{libelle}</p>
      <div role="radiogroup" aria-label={libelle} className="flex flex-wrap gap-1.5">
        {options.map(([v, texte]) => (
          <button key={v} type="button" role="radio" aria-checked={valeur === v} onClick={() => onChange(v)}
            className={`min-h-[36px] px-3 rounded-full border text-xs font-semibold ${valeur === v ? 'border-suguba-profond bg-suguba-menthe text-suguba-profond' : 'border-slate-200 bg-white text-slate-700'}`}>
            {texte}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Les quatre taux de retrait, complets (ceux réglés, sinon l'ancien taux unique). */
function tousLesTaux(r: ReglagesPlateforme): Record<RoleRetrait, { caisse: number; mobile: number }> {
  const t = (role: RoleRetrait) => ({ caisse: tauxRetraitSuguba(r, role, 'cash'), mobile: tauxRetraitSuguba(r, role, 'orange_money') });
  return { revendeur: t('revendeur'), fournisseur: t('fournisseur') };
}

const MOYENS_RETRAIT_EXEMPLE: readonly (readonly [MoyenRetrait, string])[] = [
  ['cash', 'Caisse Suguba'], ['orange_money', 'Orange Money'], ['moov', 'Moov Money'], ['wave', 'Wave'],
];
const MOYENS_PAIEMENT_SIMU: readonly (readonly [MoyenPaiementClient, string])[] = [
  ['especes', 'Espèces'], ['orange_ml', 'Orange'], ['moov_ml', 'Moov'], ['wave_ml', 'Wave'],
];
const MOYENS_RETRAIT_SIMU: readonly (readonly [MoyenRetrait, string])[] = [
  ['cash', 'Caisse'], ['orange_money', 'Orange'], ['moov', 'Moov'], ['wave', 'Wave'],
];

/** Grilles de retrait chez un agent : information des bénéficiaires, rien n'est facturé par Suguba. */
function GrillesAgent({ f, onChange }: { f: ReglagesFraisPaiement; onChange: (f: ReglagesFraisPaiement) => void }) {
  return (
    <>
      <Num l="Fonds de soutien de l'État" suffixe="%" v={f.fondsSoutienPct} on={(v) => onChange({ ...f, fondsSoutienPct: v })}
        info="Prélevé par l'opérateur sur un retrait d'espèces chez un agent (Ordonnance n° 2025-008/PT-RM du 7 février 2025, en vigueur depuis le 5 mars 2025 ; Wave aussi depuis la décision DGCC du 2 février 2026)." />
      <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {OPERATEURS_RETRAIT.map((op) => (
          <GrilleRetrait key={op} libelle={LIBELLES_MOYENS[op]} g={f.retraitOperateur[op]}
            onChange={(g) => onChange({ ...f, retraitOperateur: { ...f.retraitOperateur, [op]: g } })} />
        ))}
      </div>
      <p className="sm:col-span-2 text-xs text-slate-600">
        Retirer 10 000 F en espèces chez un agent, fonds de l&apos;État compris :{' '}
        {OPERATEURS_RETRAIT.map((op, i) => (
          <span key={op}>{i > 0 && ' · '}{LIBELLES_MOYENS[op]} <strong>{enF(estimerRetraitAgent(10000, op, f).total)}</strong></span>
        ))}
        .
      </p>
    </>
  );
}

/**
 * Simulateur du cycle complet (audit du 2026-09-27) : 1. la vente crée les
 * montants dus ; 2. l'encaissement a ses frais ; 3. les retraits ont les
 * leurs, PRÉVISIONNELS tant qu'ils n'ont pas eu lieu. Les coûts de Suguba
 * sont détaillés, jamais retirés pour rendre le résultat positif.
 */
function SimulateurCycle({ r }: { r: ReglagesPlateforme }) {
  const [e, setE] = useState<EntreeCycle>({
    mode: 'gros', prixFournisseur: 100000, prixVenteRevendeur: 110000, partRevendeur: 2000,
    paiement: 'especes', retraitFournisseur: 'cash', retraitRevendeur: 'cash',
  });
  const c = simulerCycle(e, r);
  const maj = <K extends keyof EntreeCycle>(cle: K, v: EntreeCycle[K]) => setE((x) => ({ ...x, [cle]: v }));
  // Clé = libellé : unique dans chaque liste (frais du paiement, coûts).
  const ligne = (libelle: string, montant: number, signe = '', fort = false) => (
    <div key={libelle} className={`flex justify-between gap-3 ${fort ? 'font-semibold text-slate-900' : ''}`}>
      <dt className="min-w-0">{libelle}</dt>
      <dd className="tabular-nums whitespace-nowrap">{signe}{enF(montant)}</dd>
    </div>
  );
  const retrait = (titre: string, cle: 'retraitFournisseur' | 'retraitRevendeur', d: DetailFraisRetrait | null) => (
    <div className="rounded-2xl bg-white p-3 space-y-2">
      <Choix libelle={titre} valeur={e[cle]} options={MOYENS_RETRAIT_SIMU} onChange={(v) => maj(cle, v)} />
      {d ? (
        <dl className="text-xs text-slate-700 space-y-0.5">
          {ligne('Retire de son solde', d.montantDemande)}
          {ligne('Frais Suguba', d.fraisSuguba, '− ')}
          {d.fraisSaspay + d.fraisOperateur > 0 && ligne('Autres frais (virement SasPay)', d.fraisSaspay + d.fraisOperateur, '− ')}
          {ligne('Reçoit', d.montantNet, '', true)}
        </dl>
      ) : <p className="text-xs text-slate-600">Rien à retirer.</p>}
    </div>
  );
  const resultat = (n: number) => <strong className={`tabular-nums ${n < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{enF(n)}</strong>;

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Choix libelle="Article" valeur={e.mode} options={[['gros', 'Prix de gros'], ['fixe', 'Prix fixe']] as const} onChange={(v) => maj('mode', v)} />
        <label className="text-xs font-semibold text-slate-700">{e.mode === 'gros' ? 'Prix de gros' : 'Prix fournisseur'}
          <Montant large valeur={e.prixFournisseur} libelle="Prix du fournisseur" onChange={(v) => maj('prixFournisseur', v)} />
        </label>
        {e.mode === 'gros' ? (
          <label className="text-xs font-semibold text-slate-700">Prix de vente du revendeur
            <Montant large valeur={e.prixVenteRevendeur || 0} libelle="Prix de vente du revendeur" onChange={(v) => maj('prixVenteRevendeur', v)} />
          </label>
        ) : (
          <label className="text-xs font-semibold text-slate-700">Part revendeur
            <Montant large valeur={e.partRevendeur || 0} libelle="Part revendeur" onChange={(v) => maj('partRevendeur', v)} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-suguba-sauge p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-900">1 · Vente</p>
          <dl className="text-xs text-slate-700 space-y-0.5">
            {ligne('Prix payé par le client', c.vente.prixClient, '', true)}
            {ligne('Dû au fournisseur', c.vente.duFournisseur)}
            {ligne('Dû au revendeur', c.vente.duRevendeur)}
            {ligne('Commission Suguba', c.vente.commissionSuguba)}
          </dl>
          <p className="text-xs text-slate-600">Commission : {c.vente.commission.base}, payée par {c.vente.commission.payeur}.</p>
        </div>

        <div className="rounded-2xl bg-suguba-sauge p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-900">2 · Encaissement</p>
          <Choix libelle="Le client paie en" valeur={e.paiement} options={MOYENS_PAIEMENT_SIMU} onChange={(v) => maj('paiement', v)} />
          {c.encaissement.lignes.length === 0 ? (
            <p className="text-xs text-slate-700">Espèces : aucun frais de paiement.</p>
          ) : (
            <dl className="text-xs text-slate-700 space-y-0.5">
              {c.encaissement.lignes.map((l) => ligne(`${l.libelle} (${l.detail})`, l.montant, '+ '))}
              {ligne('Le client débourse', c.encaissement.totalClient, '', true)}
            </dl>
          )}
          <p className="text-xs text-slate-600">Frais payés par le client, pour ce paiement seulement.</p>
        </div>

        <div className="rounded-2xl bg-suguba-sauge p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">3 · Retraits</p>
            <span className="rounded-full bg-white text-slate-700 text-xs font-semibold px-2.5 py-0.5">Prévisionnels</span>
          </div>
          {retrait('Le fournisseur retire par', 'retraitFournisseur', c.retraits.fournisseur)}
          {retrait('Le revendeur retire par', 'retraitRevendeur', c.retraits.revendeur)}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900">Ce que Suguba garde</p>
        <dl className="text-xs text-slate-700 space-y-0.5">
          {ligne('Commission de la vente', c.vente.commissionSuguba, '+ ')}
          {c.encaissement.gainSuguba > 0 && ligne('Frais de transaction du paiement', c.encaissement.gainSuguba, '+ ')}
          {c.couts.lignes.map((l) => ligne(l.libelle, l.montant, '− '))}
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-1">
            <dt>Résultat de la vente</dt><dd>{resultat(c.synthese.resultat)}</dd>
          </div>
          {ligne('Frais Suguba sur les retraits (prévisionnels)', c.synthese.previsionnel, '+ ')}
          <div className="flex justify-between gap-3 font-semibold text-slate-900">
            <dt>Si les retraits ont lieu comme simulé</dt><dd>{resultat(c.synthese.resultatAvecPrevisionnel)}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-600">
          Les frais des retraits ne comptent qu&apos;une fois le retrait fait : un bénéficiaire peut garder son solde.
          Un résultat négatif se corrige par la commission ou les coûts réels, jamais en cachant une ligne.
        </p>
      </div>
    </div>
  );
}

/** Sur quoi la commission est calculée et qui la paie, écrit en clair. */
function ExplicationCommission({ c }: { c: { base: string; payeur: string } }) {
  return (
    <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-3 text-xs text-slate-700 space-y-0.5">
      <p>Commission Suguba : <strong>{c.base}</strong>, payée par <strong>{c.payeur}</strong>.</p>
      <p className="text-slate-600">Fixée à la vente. Les frais de paiement et de retrait sont réglés à part, au moment de chaque opération.</p>
    </div>
  );
}

// ─────────────────────────── Frais de paiement ───────────────────────────

/** « 4 % », « 2 % + 100 F », « 3,8 % (min. 450 F) ». */
function textePalier(p: PalierSasPay): string {
  const base = texteTranche(p);
  const bornes = [p.plancher !== null ? `min. ${enF(p.plancher)}` : '', p.plafond !== null ? `max. ${enF(p.plafond)}` : ''].filter(Boolean);
  return bornes.length ? `${base} (${bornes.join(', ')})` : base;
}

const MOYENS_EXEMPLE: MoyenPaiementClient[] = ['especes', 'orange_ml', 'moov_ml', 'wave_ml'];
const RESEAUX_AFFICHES: { code: string; libelle: string }[] = [
  { code: 'orange_ml', libelle: 'Orange Money' },
  { code: 'moov_ml', libelle: 'Moov Money' },
  { code: 'wave_ml', libelle: 'Wave' },
  { code: 'card', libelle: 'Carte bancaire' },
];

/**
 * Frais de paiement (2026-09-27) : rien n'est écrit en dur. Taux Suguba et
 * État réglables ; grille de retrait de chaque opérateur PAR TRANCHES, à
 * corriger ici dès qu'un opérateur change ses prix ; tarifs SasPay relus
 * seuls chez SasPay toutes les heures ; exemple en direct des quatre moyens.
 * Le client paie tous ces frais ; seuls les « frais de transaction Suguba »
 * sont un gain.
 */
function FraisPaiementReglages({ f, ancien, onChange, onRelu }: {
  f: ReglagesFraisPaiement;
  ancien: boolean;
  onChange: (f: ReglagesFraisPaiement) => void;
  onRelu: (tarifs: TarifsSasPay) => void;
}) {
  const [exemple, setExemple] = useState(10000);
  const [lecture, setLecture] = useState<'repos' | 'encours'>('repos');
  const [avis, setAvis] = useState<{ ok: boolean; texte: string } | null>(null);


  const relire = async () => {
    setLecture('encours');
    setAvis(null);
    try {
      const res = await fetch('/api/admin/saspay-tarifs');
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.tarifs) {
        setAvis({ ok: false, texte: json.error || 'Lecture impossible. Réessayez.' });
        return;
      }
      const tarifs = json.tarifs as TarifsSasPay;
      // Seuls les réseaux proposés aux clients comptent.
      const vue = (t: TarifsSasPay) => JSON.stringify(RESEAUX_AFFICHES.map(({ code }) => t.reseaux[code] || null));
      const change = vue(tarifs) !== vue(f.saspay);
      onRelu({ releveLe: tarifs.releveLe, reseaux: { ...f.saspay.reseaux, ...tarifs.reseaux } });
      setAvis({ ok: true, texte: !json.enregistre
        ? 'Tarifs relus, mais pas enregistrés : lancez le SQL du 2026-09-27 dans Supabase.'
        : change ? 'SasPay a changé ses tarifs : ils s’appliquent dès maintenant aux paiements.' : 'Tarifs relus : inchangés.' });
    } catch {
      setAvis({ ok: false, texte: 'Erreur réseau : tarifs non relus.' });
    } finally {
      setLecture('repos');
    }
  };

  return (
    <>
      <Num l="Frais de transaction Suguba" suffixe="%" v={f.plateformePct} on={(v) => onChange({ ...f, plateformePct: v })}
        info="Le gain de Suguba sur chaque paiement Mobile Money, payé par le client. Le baisser demande le droit « Baisser la part Suguba » et un motif." />
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-700">Tarifs SasPay du compte Suguba</p>
            <p className="text-xs text-slate-600">
              {f.saspay.releveLe ? `Relevés chez SasPay le ${new Date(f.saspay.releveLe).toLocaleString('fr-FR', FORMAT_DATE.completHeure)}` : 'Jamais relevés'}
              {' · relus seuls dès que le relevé a plus de 6 heures, sans jamais ralentir un paiement.'}
              {ancien && ' Relecture en cours en arrière-plan.'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={relire} disabled={lecture === 'encours'}>
            {lecture === 'encours' ? <SugubaLoader className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            {lecture === 'encours' ? 'SasPay répond… (jusqu’à 30 s)' : 'Relire maintenant'}
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {RESEAUX_AFFICHES.map(({ code, libelle }) => {
            const t = f.saspay.reseaux[code];
            const enc = t?.encaissement[0];
            const ver = t?.versement[0];
            return (
              <div key={code} className="py-1.5 grid grid-cols-1 sm:grid-cols-3 gap-x-3 text-xs">
                <span className="font-semibold text-slate-900">{libelle}</span>
                <span className="text-slate-700">Paiement : {enc ? <><strong>{textePalier(enc)}</strong>{enc.mode === 'ADD_ON' ? ', ajoutés au client par SasPay' : ', retenus sur Suguba'}</> : 'non proposé'}</span>
                <span className="text-slate-700">Versement : {ver ? <strong>{textePalier(ver)}</strong> : 'non proposé'}</span>
              </div>
            );
          })}
        </div>
        {avis && (
          <p role="status" className={`text-xs ${avis.ok ? 'text-suguba-brand-dark' : 'text-rose-700'}`}>{avis.texte}</p>
        )}
      </div>

      <div className="sm:col-span-2 rounded-2xl bg-suguba-sauge p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">Ce que paie le client, en direct</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">Commande de
            <Montant valeur={exemple} libelle="Montant de la commande exemple" onChange={setExemple} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {MOYENS_EXEMPLE.map((moyen) => {
            const d = calculerFraisPaiement(exemple, moyen, f);
            const gainSuguba = d.lignes.find((l) => l.code === 'plateforme')?.montant || 0;
            return (
              <div key={moyen} className="rounded-2xl bg-white p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-900">{LIBELLES_MOYENS[moyen]}</p>
                {d.lignes.length === 0 ? (
                  <p className="text-xs text-suguba-brand-dark font-semibold">Sans frais</p>
                ) : (
                  <dl className="space-y-0.5 text-xs">
                    {d.lignes.map((l) => (
                      <div key={l.code} className="flex justify-between gap-2">
                        <dt className="text-slate-600 min-w-0">{l.libelle}</dt>
                        <dd className="tabular-nums text-slate-900 whitespace-nowrap">{enF(l.montant)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-sm text-slate-900 border-t border-slate-100 pt-1.5">
                  Le client paie <strong className="tabular-nums">{enF(d.totalClient)}</strong>
                </p>
                {d.fraisTotal > 0 && (
                  <p className="text-xs text-slate-600">
                    Soit {String(Math.round((d.fraisTotal / Math.max(1, d.montantCommande)) * 1000) / 10).replace('.', ',')} % de plus · Suguba gagne {enF(gainSuguba)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Grille de retrait d'un opérateur : tranches modifiables, source et date de vérification. */
function GrilleRetrait({ libelle, g, onChange }: { libelle: string; g: GrilleRetraitOperateur; onChange: (g: GrilleRetraitOperateur) => void }) {
  const majTranche = (i: number, cle: keyof TrancheRetrait, v: number) =>
    onChange({ ...g, tranches: g.tranches.map((t, j) => (j === i ? { ...t, [cle]: v } : t)) });
  const derniere = g.tranches[g.tranches.length - 1];
  return (
    <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
      <p className="text-sm font-semibold text-slate-900">Retrait {libelle}</p>
      <div className="space-y-2">
        {g.tranches.map((t, i) => (
          <div key={i} className="rounded-xl bg-slate-50 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">Tranche {i + 1} · {texteTranche(t)}</span>
              {g.tranches.length > 1 && (
                <BoutonSupprimer libelle={`Supprimer la tranche ${i + 1} du retrait ${libelle}`}
                  onClick={() => onChange({ ...g, tranches: g.tranches.filter((_, j) => j !== i) })} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {([['min', 'De (F)'], ['max', 'À (F)'], ['pct', '%'], ['fixe', '+ frais fixes (F)']] as const).map(([cle, titre]) => (
                <label key={cle} className="text-xs text-slate-600">{titre}
                  <ChampNombre valeur={t[cle]} libelle={`Retrait ${libelle}, tranche ${i + 1}, ${titre}`} onChange={(v) => majTranche(i, cle, v)} className="w-full mt-1 text-right" />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <BoutonAjouter onClick={() => onChange({ ...g, tranches: [...g.tranches, { min: (derniere?.max ?? 0) + 1, max: (derniere?.max ?? 0) + 1000000, pct: 0, fixe: 0 }] })}>
        Ajouter une tranche
      </BoutonAjouter>
      <label className="block text-xs text-slate-600">Source
        <input value={g.source} onChange={(e) => onChange({ ...g, source: e.target.value })} aria-label={`Source de la grille ${libelle}`}
          className={`${CHAMP} w-full mt-1`} />
      </label>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>{g.verifieLe ? `Vérifiée le ${new Date(g.verifieLe).toLocaleDateString('fr-FR', FORMAT_DATE.complet)}` : 'Jamais vérifiée'}</span>
        <button type="button" className="underline font-semibold text-suguba-profond"
          onClick={() => onChange({ ...g, verifieLe: new Date().toISOString().slice(0, 10) })}>
          Vérifiée aujourd&apos;hui
        </button>
      </div>
    </div>
  );
}

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
        e.target.setCustomValidity(n === null || !e.target.value.trim() ? "Saisissez un nombre positif ou zéro." : "");
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
        {aide && <p className="text-xs text-slate-600 mt-0.5">{aide}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Num({ l, v, on, suffixe, aide, info }: { l: string; v: number; on: (v: number) => void; suffixe?: string; aide?: string; info?: string }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="inline-flex items-center gap-1">{l}{info && <InfoBulle texte={info} />}</span>
      <div className="flex items-center mt-1">
        <ChampNombre valeur={v} onChange={on} libelle={l} className="flex-1 min-w-0" />
        {suffixe && <span className="ml-2 text-xs font-normal text-slate-600 whitespace-nowrap">{suffixe}</span>}
      </div>
      {aide && <span className="block mt-1 text-xs font-normal text-slate-600">{aide}</span>}
    </label>
  );
}

/**
 * Petite icône (i) : au clic (pas au survol, pour marcher au doigt sur
 * téléphone), affiche une bulle expliquant à quoi sert le réglage voisin.
 * `stopPropagation` évite que le clic ne remonte au <label> englobant, qui
 * sinon donnerait le focus au champ au lieu de juste ouvrir la bulle.
 */
function InfoBulle({ texte }: { texte: string }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = React.useRef<HTMLSpanElement>(null);

  // Un tap/clic n'importe où ailleurs referme la bulle. Écouteur document
  // standard plutôt qu'un calque plein écran superposé : plus fiable, et
  // n'intercepte pas les clics destinés au reste de la page pendant que la
  // bulle est fermée.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  return (
    <span ref={conteneur} className="relative inline-flex">
      <button
        type="button"
        aria-label="Explication de ce réglage"
        aria-expanded={ouvert}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOuvert((o) => !o); }}
        className="group w-6 h-6 -m-1 rounded-full inline-flex items-center justify-center shrink-0"
      >
        {/* Zone tactile de 24 px (WCAG 2.5.8), pastille visible inchangée. */}
        <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 group-hover:bg-suguba-menthe group-hover:text-suguba-profond inline-flex items-center justify-center">
          <Info className="w-3 h-3" strokeWidth={2.5} />
        </span>
      </button>
      {ouvert && (
        <span role="tooltip" className="absolute z-20 left-0 top-6 w-60 max-w-[80vw] rounded-xl bg-slate-900 text-white text-xs font-normal leading-snug p-2.5 shadow-lg">
          {texte}
        </span>
      )}
    </span>
  );
}

function PastilleStatut({ statut, margeNette }: { statut: string; margeNette: number }) {
  if (margeNette < 0) return <span className="shrink-0 rounded-full bg-amber-50 text-amber-900 text-xs font-semibold px-2 py-0.5">Vente à perte</span>;
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
      className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 flex items-center justify-center">
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
