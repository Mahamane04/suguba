'use client';

import { useEffect } from 'react';
import { cloudSyncService } from '@/lib/cloud-sync';
import { sugubaStore } from '@/lib/store';

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
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((moi) => {
        sugubaStore.definirUtilisateur(
          moi?.authenticated
            ? { id: moi.uid, fullName: moi.fullName, phone: moi.phone, role: moi.role, city: moi.city }
            : null,
        );
      })
      .catch(() => {});

    return () => clearTimeout(filet);
  }, []);

  return null;
}
