'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Suguba ServiceWorker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Suguba ServiceWorker registration failed:', error);
        });
    }
  }, []);

  return null;
}
