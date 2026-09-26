'use client';

import { useEffect } from 'react';
import { cloudSyncService } from '@/lib/cloud-sync';
import { sugubaStore } from '@/lib/store';
import { rafraichirIdentite } from '@/lib/identite';

export default function CloudSyncInitializer() {
  useEffect(() => {
    // Filet : même si Supabase ne répond pas, les écrans cessent d'attendre
    // le catalogue (squelettes de chargement, voir useCatalogueCharge).
    const filet = setTimeout(() => sugubaStore.marquerCatalogueCharge(), 8000);

    if (cloudSyncService.isCloudActive()) {
      cloudSyncService.initRealtimeSync().catch((err) => {
        console.warn('Cloud sync initialization warning:', err);
      }).finally(() => sugubaStore.marquerCatalogueCharge());
    } else {
      sugubaStore.marquerCatalogueCharge();
    }

    // Identité RÉELLE de la personne connectée (2026-09-11). La mémoire locale
    // démarrait sur le compte de démonstration « Moussa Coulibaly », affiché
    // tel quel par 12 écrans (« Bonjour, Moussa », nom du livreur…).
    rafraichirIdentite({ forcer: true }).then((moi) => {
      // Seuls admin/livreur/revendeur ont des commandes à lire ici (voir
      // /api/orders/feed) : un client, fournisseur ou diaspora déclenchait
      // sinon un 401 sur CHAQUE page (constaté en vérification phase 9).
      cloudSyncService.fetchOrdersFromCloudSiEligible(moi?.authenticated ? (moi.role ?? null) : null);
    });

    // Relecture au retour sur l'app (2026-09-24) : après une connexion Google
    // ouverte dans un autre onglet, ou une page restaurée depuis le cache du
    // navigateur (iPhone), le layout ne remonte pas et l'identité restait
    // figée sur « visiteur » — d'où la double connexion signalée.
    const recharger = (forcer = false) => rafraichirIdentite({ forcer }).then((moi) => cloudSyncService.fetchOrdersFromCloudSiEligible(moi?.authenticated ? moi.role : null));
    // Retour sur l'app : identité ET catalogue (plus de temps réel sur les
    // produits depuis le 2026-09-26, voir cloud-sync).
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return;
      void recharger();
      void cloudSyncService.rafraichirCatalogue();
    };
    const aLaRestauration = (e: PageTransitionEvent) => { if (e.persisted) void recharger(true); };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('pageshow', aLaRestauration);

    return () => {
      clearTimeout(filet);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('pageshow', aLaRestauration);
    };
  }, []);

  return null;
}
