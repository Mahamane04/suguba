'use client';

import { useEffect } from 'react';
import { cloudSyncService } from '@/lib/cloud-sync';
import { sugubaStore } from '@/lib/store';

export default function CloudSyncInitializer() {
  useEffect(() => {
    if (cloudSyncService.isCloudActive()) {
      cloudSyncService.initRealtimeSync().catch((err) => {
        console.warn('Cloud sync initialization warning:', err);
      });
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
  }, []);

  return null;
}
