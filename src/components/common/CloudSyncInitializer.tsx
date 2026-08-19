'use client';

import { useEffect } from 'react';
import { cloudSyncService } from '@/lib/cloud-sync';

export default function CloudSyncInitializer() {
  useEffect(() => {
    if (cloudSyncService.isCloudActive()) {
      cloudSyncService.initRealtimeSync().catch((err) => {
        console.warn('Cloud sync initialization warning:', err);
      });
    }
  }, []);

  return null;
}
