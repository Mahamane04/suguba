'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { viderCacheNotifications } from '@/components/reseau/ClocheNotifications';

/** Notifications du compte (§ W). Ouvrir la page marque tout comme lu. */

interface Notification {
  id: number;
  titre: string;
  texte: string | null;
  lien: string | null;
  lue: boolean;
  creeLe: string;
}

function quand(date: string): string {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseau/notifications')
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        setNotifications(data.notifications || []);
        // Marquées lues APRÈS affichage : l'utilisateur voit encore lesquelles
        // étaient nouvelles pendant cette visite.
        if ((data.nonLues || 0) > 0) {
          fetch('/api/reseau/notifications', { method: 'POST' }).catch(() => undefined);
        }
        viderCacheNotifications();
      })
      .catch(() => { /* état vide */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  return (
    <PageReseau titre="Notifications" sousTitre="Missions, gains, nouveautés de vos boutiques.">
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icone={Bell}
          titre="Rien de nouveau"
          texte="Vous serez prévenu ici quand une mission est validée, une prime versée, ou qu’une boutique que vous suivez publie une nouveauté."
          action={<Button href="/boutiques-suivies" variant="ghost">Mes boutiques suivies</Button>}
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {notifications.map((n) => {
            const contenu = (
              <div className="flex items-start gap-3 p-4">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.lue ? 'bg-transparent' : 'bg-suguba-brand'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-slate-900 ${n.lue ? 'font-semibold' : 'font-bold'}`}>{n.titre}</p>
                  {n.texte && <p className="text-xs text-slate-600 mt-0.5">{n.texte}</p>}
                  <p className="text-xs text-slate-400 mt-1">{quand(n.creeLe)}</p>
                </div>
                {n.lien && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
              </div>
            );
            return n.lien ? (
              <Link key={n.id} href={n.lien} className="block hover:bg-slate-50 active:bg-slate-100">{contenu}</Link>
            ) : (
              <div key={n.id}>{contenu}</div>
            );
          })}
        </Card>
      )}
    </PageReseau>
  );
}
