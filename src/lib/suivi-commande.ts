/**
 * Où en est la commande, vu par le client (PUB-03, lot 5 de l'audit UI/UX du
 * 2026-10-02).
 *
 * Avant : l'étape courante était calculée mais jamais affichée, toutes les
 * étapes avaient le même poids, et les libellés parlaient le langage de
 * l'équipe (« Livré & Encaissé », « Étapes d'Acheminement »). Le client devait
 * deviner ce qui se passait maintenant et ce qu'on attendait de lui.
 */
import { formatF, FORMAT_DATE } from './montant';

export interface CommandeSuivie {
  status: string;
  callVerifiedBy?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  paymentCollected?: boolean | null;
  totalAmount?: number | null;
}

export interface EtapeSuivi {
  id: string;
  titre: string;
  detail: string;
  faite: boolean;
  enCours: boolean;
}

const ORDRE = ['new', 'pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered'];
const rang = (statut: string) => ORDRE.indexOf(statut);

export const commandeArretee = (statut: string) => statut === 'cancelled' || statut === 'returned';

export function etapesSuivi(c: CommandeSuivie): EtapeSuivi[] {
  const r = rang(c.status);
  const etapes = [
    { id: 'recue', titre: 'Commande reçue', detail: 'Nous avons bien votre commande', faite: true },
    {
      id: 'appel', titre: 'Appel de confirmation',
      detail: c.callVerifiedBy ? `Confirmée par ${c.callVerifiedBy}` : 'Suguba vous appelle pour confirmer',
      faite: r >= rang('confirmed'),
    },
    {
      id: 'livreur', titre: 'Livreur choisi',
      detail: c.driverName ? `${c.driverName}${c.driverPhone ? ` · ${c.driverPhone}` : ''}` : 'Nous choisissons votre livreur',
      faite: r >= rang('dispatched'),
    },
    {
      id: 'ramassage', titre: 'Colis récupéré chez le vendeur',
      detail: c.pickedUpAt
        ? `Le ${new Date(c.pickedUpAt).toLocaleString('fr-FR', FORMAT_DATE.jourHeure)} · en route vers vous`
        : 'Le livreur va chercher votre article',
      faite: r >= rang('in_transit'),
    },
    {
      id: 'livree', titre: 'Livrée',
      detail: c.deliveredAt ? 'Remise contre votre code secret' : 'Vous donnez votre code secret au livreur',
      faite: c.status === 'delivered',
    },
  ];
  // L'étape en cours est la première qui n'est pas faite ; aucune si la commande est arrêtée.
  const premiere = commandeArretee(c.status) ? -1 : etapes.findIndex((e) => !e.faite);
  return etapes.map((e, i) => ({ ...e, enCours: i === premiere }));
}

/** Ce qui se passe maintenant, et ce que le client doit faire, en une phrase. */
export function maintenantSuivi(c: CommandeSuivie): { titre: string; texte: string } {
  const aPayer = !c.paymentCollected && typeof c.totalAmount === 'number'
    ? ` et ${formatF(c.totalAmount)}` : '';
  switch (c.status) {
    case 'confirmed':
      return { titre: 'Commande confirmée', texte: 'Nous choisissons le livreur qui vous apportera votre colis.' };
    case 'dispatched':
      return {
        titre: 'Un livreur s’occupe de votre colis',
        texte: `${c.driverName || 'Il'} le récupère chez le vendeur, puis vous l’apporte.`,
      };
    case 'in_transit':
      return { titre: 'Votre colis est en route', texte: `Préparez votre code secret${aPayer} pour le livreur.` };
    case 'delivered':
      return { titre: 'Commande livrée', texte: 'Merci ! Votre reçu reste disponible ici.' };
    case 'cancelled':
      return { titre: 'Commande annulée', texte: 'Rien ne vous sera demandé.' };
    case 'returned':
      return { titre: 'Colis retourné', texte: 'Écrivez-nous si c’est une erreur.' };
    default:
      return { titre: 'Suguba va vous appeler', texte: 'Pour confirmer votre commande. Gardez votre téléphone allumé.' };
  }
}
