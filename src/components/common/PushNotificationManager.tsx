'use client';

import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, Sparkles } from 'lucide-react';

export default function PushNotificationManager() {
  const pathname = usePathname();
  const postpone = () => {
    setShowBanner(false);
    try { localStorage.setItem('suguba_notification_postponed', String(Date.now())); } catch { /* stockage facultatif */ }
  };
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showBanner, setShowBanner] = useState(false);
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    setShowBanner(false);
    if (pathname !== '/notifications' || !('Notification' in window)) return;
    setPermission(Notification.permission);
    let postponed = 0;
    try { postponed = Number(localStorage.getItem('suguba_notification_postponed')) || 0; } catch { /* facultatif */ }
    if (Notification.permission === 'default' && Date.now() - postponed > 7 * 86400000) setShowBanner(true);
  }, [pathname]);

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        setShowBanner(false);

        if (result === 'granted') {
          // Send welcome test notification
          sendLocalNotification(
            'Notification de test Suguba',
            'Ce test concerne cet appareil. Consultez la page Notifications pour vos alertes.'
          );
        }
      } catch (e) {
        console.warn('Error requesting notification permission:', e);
        setShowBanner(false);
      }
    }
  };

  const sendLocalNotification = (title: string, body: string) => {
    // Vibreur mobile
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      } catch (e) {
        // Fallback to in-app toast
        setActiveToast({ title, body });
        setTimeout(() => setActiveToast(null), 5000);
      }
    } else {
      // In-app toast
      setActiveToast({ title, body });
      setTimeout(() => setActiveToast(null), 5000);
    }
  };

  return (
    <>
      {/* 1. Permission Request Banner */}
      {showBanner && permission === 'default' && (
        <div className="fixed top-4 left-4 right-4 max-w-md mx-auto z-50 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl border border-slate-700 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-suguba-profond flex items-center justify-center text-white shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">Tester les notifications sur cet appareil ?</p>
                <p className="text-xs text-slate-300 leading-tight">
                  Ce test local ne garantit pas les alertes en arrière-plan. Vos notifications restent consultables dans cette page.
                </p>
                <div className="flex items-center space-x-2 pt-1.5">
                  <button
                    onClick={handleRequestPermission}
                    className="min-h-11 px-3.5 py-1.5 bg-suguba-profond hover:bg-suguba-profond-2 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
                  >
                    Tester
                  </button>
                  <button
                    onClick={postpone}
                    className="min-h-11 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={postpone}
              aria-label="Fermer la proposition de notification"
              className="text-slate-300 hover:text-white p-1 min-w-11 min-h-11"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. In-App Interactive Toast Fallback */}
      {activeToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-right-4 duration-200">
          <div className="bg-emerald-800 text-white p-3.5 rounded-2xl shadow-xl border border-emerald-600 flex items-start space-x-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <strong className="block text-white font-bold">{activeToast.title}</strong>
              <p className="text-xs text-emerald-100">{activeToast.body}</p>
            </div>
            <button onClick={() => setActiveToast(null)} aria-label="Fermer la notification" className="text-emerald-300 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
