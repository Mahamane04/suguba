'use client';

import React, { useEffect, useState } from 'react';
import { Users, ShoppingBag, Coins } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatCard } from '@/components/ui/Surface';

/**
 * Mes clients (§ 15 des écrans).
 *
 * Les numéros sont volontairement MASQUÉS (voir /api/reseller/clients) :
 * Suguba livre et rappelle, le revendeur n'a pas besoin d'un fichier de
 * numéros exploitable en dehors de la plateforme.
 */

interface ClientAcquis {
  prenom: string;
  telephoneMasque: string;
  source: string;
  depuis: string;
  dernierPassage: string;
  commandes: number;
  chiffreAffaires: number;
}

export default function ClientsRevendeurPage() {
  const [clients, setClients] = useState<ClientAcquis[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseller/clients')
      .then((r) => r.json())
      .then((data) => { if (!annule) setClients(data.clients || []); })
      .catch(() => { /* état vide */ })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const totalCommandes = clients.reduce((s, c) => s + c.commandes, 0);
  const totalCa = clients.reduce((s, c) => s + c.chiffreAffaires, 0);

  return (
    <PageReseau
      titre="Mes clients"
      sousTitre="Les personnes que vous avez amenées sur Suguba."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Clients" valeur={clients.length} icone={Users} accent />
        <StatCard label="Commandes" valeur={totalCommandes} icone={ShoppingBag} />
        <StatCard label="Total" valeur={`${(totalCa / 1000).toFixed(0)}k F`} icone={Coins} />
      </div>

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : clients.length === 0 ? (
        <EmptyState
          icone={Users}
          titre="Aucun client pour l’instant"
          texte="Dès qu’une personne arrive par votre lien ou votre QR code, elle vous est rattachée — et toutes ses commandes suivantes aussi."
          action={<Button href="/reseller/boutique">Partager ma boutique</Button>}
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {clients.map((c, i) => (
            <div key={`${c.telephoneMasque}-${i}`} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{c.prenom}</p>
                <p className="text-xs text-slate-500">
                  {c.telephoneMasque} · depuis le{' '}
                  {new Date(c.depuis).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{c.chiffreAffaires.toLocaleString('fr-FR')} F</p>
                <p className="text-xs text-slate-500">{c.commandes} commande{c.commandes > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-xs text-slate-500 px-1">
        Les numéros sont masqués : c’est Suguba qui appelle et livre. Vous touchez votre commission
        sur chaque commande de ces clients, même quand ils commandent sans repasser par votre lien.
      </p>
    </PageReseau>
  );
}
