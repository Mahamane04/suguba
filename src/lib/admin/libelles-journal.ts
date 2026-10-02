/**
 * Le journal de l'équipe en français (ADM-07, lot 6 de l'audit UI/UX du
 * 2026-10-02) — règles PURES, partagées navigateur / tests.
 *
 * Avant : la colonne « Action » affichait le code technique de la route
 * (« POST /api/admin/products/price »), le dossier un identifiant brut
 * (« payouts:7f3c… ») et le détail un bloc JSON. On lisait le journal comme un
 * fichier de logs. Ici : une phrase par action, le type de dossier en clair, et
 * les champs envoyés en libellés français (montants en F).
 */
import { formatF } from '../montant';

const ACTIONS: Record<string, string> = {
  connexion: 'Connexion à l’espace équipe',
  'note.ajouter': 'Note ajoutée au dossier',
  'affectation.prendre': 'Dossier pris en charge',
  'affectation.transferer': 'Dossier transféré',
  accueil: 'Accueil modifié',
  'boutique-suguba': 'Boutique Suguba modifiée',
  boutiques: 'Boutique modérée',
  'caisse-livreurs': 'Versement de livreur enregistré',
  commandes: 'Commande mise à jour',
  diffusion: 'Message diffusé',
  'drivers/verify': 'Livreur vérifié',
  equipe: 'Équipe modifiée',
  messages: 'Message modéré',
  missions: 'Mission modifiée',
  'missions/preuves': 'Preuve de mission vérifiée',
  'paiements-recus': 'Paiement reçu rapproché',
  payouts: 'Retrait traité',
  prestations: 'Prestation arbitrée',
  'preview-role': 'Vue d’un autre profil',
  'priorite-reseau': 'Priorité au réseau modifiée',
  'products/price': 'Prix d’un produit fixé',
  'products/status': 'Statut d’un produit changé',
  'products/unite': 'Unité de vente corrigée',
  'produits-groupes': 'Action groupée sur des produits',
  'recherche-synonymes': 'Synonymes de recherche modifiés',
  recompenses: 'Récompense versée ou refusée',
  'reseau-reglages': 'Réglages du réseau modifiés',
  'reset-otp-lock': 'Code SMS débloqué',
  resultats: 'Résultats publiés',
  'review-profile': 'Profil examiné',
  sav: 'Réclamation SAV traitée',
  securite: 'Sécurité de l’équipe modifiée',
  settings: 'Réglages économiques modifiés',
  sponsorisations: 'Sponsorisation examinée',
  'unlock-commission': 'Commission débloquée',
  utilisateurs: 'Compte utilisateur modifié',
  validations: 'Validation décidée',
  verifications: 'Pièce d’identité examinée',
  vues: 'Vue enregistrée modifiée',
};

/** Préfixe de dossier (« payouts:… ») → nature du dossier. */
const DOSSIERS: Record<string, string> = {
  payouts: 'Retrait', commandes: 'Commande', 'products/price': 'Produit', 'products/status': 'Produit', 'products/unite': 'Produit',
  'produits-groupes': 'Produits', sav: 'Réclamation', verifications: 'Pièce', 'drivers/verify': 'Livreur', utilisateurs: 'Compte',
  validations: 'Validation', membre: 'Membre', export: 'Export', sponsorisations: 'Sponsorisation', missions: 'Mission',
  boutiques: 'Boutique', 'caisse-livreurs': 'Livreur', 'paiements-recus': 'Paiement', recompenses: 'Récompense',
  'review-profile': 'Profil', 'preview-role': 'Profil',
};

const CHAMPS: Record<string, string> = {
  status: 'Statut', statut: 'Statut', decision: 'Décision', motif: 'Motif', raison: 'Raison', note: 'Note',
  publicPrice: 'Prix client', prix: 'Prix', price: 'Prix', montant: 'Montant', amount: 'Montant', commission: 'Commission',
  resellerCommission: 'Commission revendeur', stock: 'Stock', responsable: 'Responsable', lignes: 'Lignes exportées',
  appareil: 'Appareil', aal: 'Double vérification', role: 'Profil', action: 'Geste', reference: 'Référence',
};
const CHAMPS_ARGENT = /^(publicPrice|prix|price|montant|amount|commission|resellerCommission|frais)/i;
const CHAMPS_IDENTIFIANTS = /(^id$|Id$|^uid$|^slug$|orderIds?$)/;

/** « POST /api/admin/products/price » ou « note.ajouter » → la clé du dictionnaire. */
export function cleAction(code: string): string {
  const route = code.match(/^[A-Z]+ \/api\/admin\/(.+)$/);
  if (route) return route[1];
  if (code.startsWith('export.')) return 'export';
  return code;
}

export function libelleAction(code: string): string {
  const cle = cleAction(code);
  if (cle === 'export') return `Export ${code.slice('export.'.length) || 'de données'}`;
  if (code.startsWith('DELETE ')) return `${ACTIONS[cle] || 'Élément'} (suppression)`;
  return ACTIONS[cle] || 'Autre action de l’équipe';
}

/** « payouts:7f3c… » → « Retrait 7f3c… ». */
export function libelleDossier(dossier: string | null): string {
  if (!dossier) return '—';
  const i = dossier.indexOf(':');
  if (i < 0) return dossier;
  const nature = DOSSIERS[dossier.slice(0, i)];
  const id = dossier.slice(i + 1);
  return `${nature || 'Dossier'} ${id.length > 14 ? `${id.slice(0, 8)}…` : id}`;
}

/** Les champs envoyés, en libellés lisibles ; les identifiants techniques sont écartés. */
export function detailsLisibles(apres: Record<string, unknown> | null): { libelle: string; valeur: string }[] {
  if (!apres) return [];
  return Object.entries(apres)
    .filter(([k, v]) => !CHAMPS_IDENTIFIANTS.test(k) && v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => ({
      libelle: CHAMPS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      valeur: typeof v === 'number' && CHAMPS_ARGENT.test(k) ? formatF(v)
        : typeof v === 'boolean' ? (v ? 'oui' : 'non')
        : typeof v === 'object' ? JSON.stringify(v)
        : String(v),
    }));
}
