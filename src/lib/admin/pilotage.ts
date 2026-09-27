/**
 * Pilotage (A5, 2026-09-27) — règles PURES : centre des modules, blocs de
 * l'accueil, diagnostic « Pourquoi c'est bloqué ? », champs du simulateur.
 * Aucune de ces aides ne contourne un contrôle : elles expliquent et
 * renvoient vers le bon réglage ou le bon dossier.
 */
import type { CleBlocAccueil } from '@/lib/reseau/reglages';
import type { Permission } from '@/lib/reseau/permissions';

// ── Centre des modules ──────────────────────────────────────────────────────

export interface Module {
  cle: string;
  titre: string;
  /** Ce que l'activation ouvre. */
  ouvre: string;
  /** Ce qui continue même fermé : un module fermé n'efface jamais le passé. */
  continue: string;
  /** Qui peut le changer. */
  permission: Permission;
  /** Interrupteur direct depuis le centre, ou page où il se règle. */
  interrupteur: 'priorite-reseau' | 'resultats' | null;
  lien: string;
}

export const MODULES: Module[] = [
  { cle: 'annuaireFournisseurs', titre: 'Annuaire des fournisseurs', ouvre: 'Les boutiques des fournisseurs apparaissent dans « près de chez moi » et dans la recherche des clients.',
    continue: 'Fermé : les revendeurs restent la porte d’entrée ; les boutiques fournisseurs existent toujours.', permission: 'plateforme.parametres', interrupteur: 'priorite-reseau', lien: '/admin/priorite-reseau' },
  { cle: 'venteDirecteFournisseurs', titre: 'Vente directe des fournisseurs', ouvre: 'Tous les fournisseurs peuvent vendre directement depuis leur boutique.',
    continue: 'Fermé : les fournisseurs autorisés un par un gardent la vente directe ; les commandes passées ne changent pas.', permission: 'plateforme.parametres', interrupteur: 'priorite-reseau', lien: '/admin/priorite-reseau' },
  { cle: 'protectionPrixDeGros', titre: 'Protection des prix de gros', ouvre: 'Un article au prix de gros proposé par un revendeur ne s’achète pas directement au prix conseillé : le client choisit l’offre d’un revendeur.',
    continue: 'Désactivée : l’achat direct au prix conseillé redevient possible ; les prix des revendeurs restent enregistrés.', permission: 'plateforme.parametres', interrupteur: 'priorite-reseau', lien: '/admin/priorite-reseau' },
  { cle: 'remunerationResultat', titre: 'Payer les résultats des campagnes', ouvre: 'Les visites et demandes qualifiées sont payées aux revendeurs ; les fournisseurs peuvent créer ces campagnes.',
    continue: 'Fermé : les visites restent mesurées, rien n’est payé ; les gains déjà acquis restent dus.', permission: 'plateforme.parametres', interrupteur: 'resultats', lien: '/admin/resultats' },
  { cle: 'paiementCarte', titre: 'Paiement par carte (diaspora)', ouvre: 'La carte bancaire est proposée sur la page diaspora.',
    continue: 'Fermé : le serveur refuse la carte ; paiement à la livraison et Mobile Money continuent.', permission: 'plateforme.parametres', interrupteur: null, lien: '/admin/parametres' },
  { cle: 'mfaObligatoire', titre: 'Double authentification obligatoire', ouvre: 'Chaque membre de l’équipe doit utiliser un code d’application à la connexion.',
    continue: 'Désactivée : qui l’a activée continue de saisir son code.', permission: 'plateforme.equipe', interrupteur: null, lien: '/admin/securite' },
  { cle: 'doubleValidation', titre: 'Double validation', ouvre: 'Retraits et avances au-dessus du seuil, baisses de la part Suguba : approbation d’un collègue.',
    continue: 'Désactivée (seuil 0) : les demandes déjà approuvées restent utilisables une fois.', permission: 'plateforme.equipe', interrupteur: null, lien: '/admin/securite' },
];

// ── Accueil ─────────────────────────────────────────────────────────────────

export const BLOCS_ACCUEIL: { cle: CleBlocAccueil; titre: string; description: string }[] = [
  { cle: 'a_la_une', titre: 'À la une', description: 'Sélection mise en avant sous la recherche.' },
  { cle: 'boutiques_quartier', titre: 'Boutiques près de chez vous', description: 'Les boutiques du quartier choisi par le client.' },
  { cle: 'gagner', titre: 'Gagner de l’argent avec Suguba', description: 'Carte vers « Devenir revendeur, fournisseur ou livreur ».' },
  { cle: 'garanties', titre: 'Garanties', description: 'Payez à la livraison, livraison 24 h, code secret à la remise.' },
];

// ── Diagnostic « Pourquoi c'est bloqué ? » ─────────────────────────────────

export interface Raison { bloquant: boolean; texte: string; lien?: string; libelleLien?: string }
export interface Diagnostic { titre: string; etat: string; raisons: Raison[] }

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const dateFr = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function diagnostiquerRetrait(r: { id: string; status: string; payment_method: string; amount: number },
  ctx: { seuil: number; validation: string | null; reseauxMobile: string[] }): Diagnostic {
  const raisons: Raison[] = [];
  const titre = `Retrait ${r.id} · ${fcfa(r.amount)}`;
  if (r.status === 'completed') return { titre, etat: 'Payé', raisons: [{ bloquant: false, texte: 'Ce retrait est déjà payé.' }] };
  if (r.status === 'rejected') return { titre, etat: 'Rejeté', raisons: [{ bloquant: false, texte: 'Ce retrait a été rejeté ; les gains sont revenus sur le solde du partenaire.' }] };
  if (r.status === 'processing') raisons.push({ bloquant: true, texte: 'Virement en cours chez l’opérateur : attendre sa confirmation (ne pas relancer un autre retrait).' });
  if (r.payment_method === 'cash') raisons.push({ bloquant: false, texte: 'Retrait en agence : à payer en espèces au guichet, puis « Payé ».', lien: '/admin/retraits', libelleLien: 'Retraits' });
  else if (!ctx.reseauxMobile.includes(r.payment_method)) raisons.push({ bloquant: true, texte: `« ${r.payment_method} » n’est pas pris en charge pour les virements : demandez au partenaire un numéro Orange Money ou Moov Money.` });
  if (ctx.seuil > 0 && r.amount >= ctx.seuil) {
    if (ctx.validation === 'approuvee') raisons.push({ bloquant: false, texte: 'Double validation : approuvée par un collègue, le paiement peut être lancé.' });
    else if (ctx.validation === 'en_attente') raisons.push({ bloquant: true, texte: `Double validation : au-dessus du seuil (${fcfa(ctx.seuil)}), en attente de l’approbation d’un collègue.`, lien: '/admin/validations', libelleLien: 'Validations' });
    else raisons.push({ bloquant: true, texte: `Double validation : au-dessus du seuil (${fcfa(ctx.seuil)}). Lancez le paiement : une demande d’approbation partira à un collègue.` });
  }
  if (!raisons.some((x) => x.bloquant) && r.status === 'pending') raisons.push({ bloquant: false, texte: 'Rien ne bloque : le retrait peut être payé.', lien: '/admin/retraits', libelleLien: 'Retraits' });
  return { titre, etat: r.status === 'pending' ? 'En attente' : 'En cours', raisons };
}

export function diagnostiquerCommission(c: { id: string; status: string; amount: number; unlock_at: string | null },
  ctx: { fondsRecus: boolean | null; maintenant?: number }): Diagnostic {
  const titre = `Commission ${c.id.slice(0, 8)} · ${fcfa(c.amount)}`;
  const m = ctx.maintenant ?? Date.now();
  const raisons: Raison[] = [];
  switch (c.status) {
    case 'available': return { titre, etat: 'Disponible', raisons: [{ bloquant: false, texte: 'Disponible : le revendeur peut la retirer.' }] };
    case 'reserved': return { titre, etat: 'Réservée', raisons: [{ bloquant: false, texte: 'Réservée pour une demande de retrait en cours.', lien: '/admin/retraits', libelleLien: 'Retraits' }] };
    case 'paid': return { titre, etat: 'Payée', raisons: [{ bloquant: false, texte: 'Déjà versée au revendeur.' }] };
    case 'reversed': return { titre, etat: 'Annulée', raisons: [{ bloquant: false, texte: 'Annulée (commande annulée ou retournée).' }] };
  }
  if (c.unlock_at && Date.parse(c.unlock_at) > m) raisons.push({ bloquant: true, texte: `Délai de sécurité : se débloque le ${dateFr(c.unlock_at)} (le temps d’un éventuel retour).` });
  if (ctx.fondsRecus === false) raisons.push({ bloquant: true, texte: 'Vente payée en espèces : l’argent n’est pas encore reversé à Suguba par le livreur ou le fournisseur.', lien: '/admin/caisse-livreurs', libelleLien: 'Caisse livreurs' });
  if (!raisons.length) raisons.push({ bloquant: false, texte: 'Rien ne bloque : elle se débloquera au prochain passage automatique.' });
  return { titre, etat: 'Bloquée', raisons };
}

export function diagnostiquerCommande(o: { order_number: string; status: string; assigned_driver_id: string | null; payment_method: string | null; delivered_at: string | null; cash_remittance_id?: string | null }): Diagnostic {
  const titre = `Commande ${o.order_number}`;
  const raisons: Raison[] = [];
  const lien = `/admin/commandes?q=${encodeURIComponent(o.order_number)}`;
  switch (o.status) {
    case 'pending_call': raisons.push({ bloquant: true, texte: 'À confirmer : le client doit être appelé (Support).', lien, libelleLien: 'Ouvrir la commande' }); break;
    case 'confirmed': raisons.push(o.assigned_driver_id
      ? { bloquant: false, texte: 'Confirmée, livreur attribué : en attente du ramassage.' }
      : { bloquant: true, texte: 'Confirmée mais aucun livreur attribué (Livraisons).', lien, libelleLien: 'Ouvrir la commande' }); break;
    case 'dispatched': case 'in_transit': raisons.push({ bloquant: false, texte: 'En cours de livraison.' }); break;
    case 'delivered':
      raisons.push({ bloquant: false, texte: 'Livrée.' });
      if (o.payment_method === 'cash' && o.assigned_driver_id && !o.cash_remittance_id) raisons.push({ bloquant: true, texte: 'Espèces encaissées pas encore reversées à Suguba : la commission du revendeur attend ce versement.', lien: '/admin/caisse-livreurs', libelleLien: 'Caisse livreurs' });
      break;
    case 'cancelled': raisons.push({ bloquant: false, texte: 'Annulée.' }); break;
    case 'returned': raisons.push({ bloquant: false, texte: 'Retournée.' }); break;
    default: raisons.push({ bloquant: false, texte: `Statut « ${o.status} ».` });
  }
  return { titre, etat: o.status, raisons };
}

export function diagnostiquerSponsorisation(s: { id: string; label: string | null; status: string; budget: number; paid_amount: number }): Diagnostic {
  const titre = s.label || `Sponsorisation ${s.id.slice(0, 8)}`;
  const raisons: Raison[] = [];
  const reste = Math.max(0, s.budget - s.paid_amount);
  if (s.status === 'active') return { titre, etat: 'Active', raisons: [{ bloquant: false, texte: 'Active.' }] };
  if (s.status === 'rejected') return { titre, etat: 'Refusée', raisons: [{ bloquant: false, texte: 'Refusée par l’équipe Marketing.' }] };
  if (s.status === 'ended') return { titre, etat: 'Terminée', raisons: [{ bloquant: false, texte: 'Terminée (date de fin ou budget épuisé).' }] };
  if (reste > 0) raisons.push({ bloquant: true, texte: `Budget pas entièrement réglé : il manque ${fcfa(reste)}. Enregistrez le paiement reçu avant d’activer.`, lien: '/admin/sponsorisations', libelleLien: 'Sponsorisations' });
  if (s.status === 'paused') raisons.push({ bloquant: true, texte: 'En pause.', lien: '/admin/sponsorisations', libelleLien: 'Sponsorisations' });
  if (s.status === 'pending' && reste === 0) raisons.push({ bloquant: true, texte: 'Réglée : attend la décision de l’équipe Marketing.', lien: '/admin/sponsorisations', libelleLien: 'Sponsorisations' });
  return { titre, etat: s.status === 'pending' ? 'En attente' : s.status, raisons };
}

export const TYPES_DIAGNOSTIC: { cle: 'retrait' | 'commission' | 'commande' | 'sponsorisation'; titre: string; aide: string; permission: Permission }[] = [
  { cle: 'commande', titre: 'Commande', aide: 'Numéro de commande (SG-…)', permission: 'commande.lire' },
  { cle: 'retrait', titre: 'Retrait', aide: 'Code du retrait', permission: 'finance.lire' },
  { cle: 'commission', titre: 'Commission', aide: 'Identifiant de la commission', permission: 'finance.lire' },
  { cle: 'sponsorisation', titre: 'Sponsorisation', aide: 'Identifiant de la sponsorisation', permission: 'sponsorisation.gerer' },
];

// ── Simulateur ─────────────────────────────────────────────────────────────

export const CHAMPS_SIMULATION: { cle: string; titre: string; unite: string }[] = [
  { cle: 'partRevendeurPct', titre: 'Part revendeur visée', unite: '%' },
  { cle: 'commissionCiblePct', titre: 'Commission visée (prix recommandé)', unite: '% du prix fournisseur' },
  { cle: 'commissionMinimale', titre: 'Commission minimale', unite: 'F' },
  { cle: 'margeNetteMinPct', titre: 'Marge nette minimale Suguba', unite: '%' },
  { cle: 'fraisPaiementPct', titre: 'Frais de paiement', unite: '%' },
  { cle: 'provisionRefusPct', titre: 'Provision pour refus', unite: '%' },
  { cle: 'coutMessageParCommande', titre: 'Coût des messages par commande', unite: 'F' },
  { cle: 'remunerationLivreur', titre: 'Rémunération du livreur', unite: 'F' },
  { cle: 'volumeReference', titre: 'Volume de référence', unite: 'commandes / mois' },
];

/** Modifications demandées → nombres valides pour des champs connus seulement. */
export function lireModifs(brut: unknown): Record<string, number> {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  const connus = CHAMPS_SIMULATION.map((c) => c.cle);
  return Object.fromEntries(Object.entries(o)
    .filter(([k, v]) => connus.includes(k) && typeof v !== 'boolean' && v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0)
    .map(([k, v]) => [k, Number(v)]));
}
