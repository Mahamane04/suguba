'use client';

import React, { useEffect, useState } from 'react';
import PageReseau from '@/components/reseau/PageReseau';
import DriverVerificationPanel from '@/components/admin/DriverVerificationPanel';
import TableauAdmin from '@/components/admin/TableauAdmin';
import { Card, Skeleton } from '@/components/ui/Surface';

/**
 * Livreurs (lot U2, 2026-09-27) — la vérification au guichet était enfouie
 * dans l'ancienne vue d'ensemble, sous des onglets « Validation des
 * inscriptions » dont trois sur quatre n'avaient aucune action.
 *
 * Ici : les livreurs à rencontrer (le compte existe dès l'inscription ; la
 * vérification donne le droit de recevoir des courses) et les livreurs
 * actifs, ceux qu'on peut attribuer à une commande.
 */

interface LivreurActif { id: string; fullName: string; phone: string | null; vehicleType: string | null }

export default function LivreursAdminPage() {
  const [actifs, setActifs] = useState<LivreurActif[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/admin/drivers/active', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Liste illisible.'); return j; })
      .then((j) => setActifs(Array.isArray(j.drivers) ? j.drivers : []))
      .catch((e) => { setErreur((e as Error).message); setActifs([]); });
  }, []);

  return (
    <PageReseau titre="Livreurs" large sousTitre="Vérification au guichet, puis livreurs actifs à qui attribuer des courses.">
      <DriverVerificationPanel />

      <section className="space-y-2" aria-labelledby="titre-actifs">
        <h2 id="titre-actifs" className="text-sm font-bold text-slate-900">Livreurs actifs{actifs ? ` (${actifs.length})` : ''}</h2>
        {erreur && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
        {actifs === null ? <Skeleton className="h-32" />
          : actifs.length === 0 ? <Card padding="p-4" className="text-sm text-slate-500">Aucun livreur actif pour l’instant : vérifiez-en un au guichet ci-dessus.</Card>
          : (
            <TableauAdmin titre="Livreurs actifs" memoire="livreurs-actifs" lignes={actifs} cleLigne={(l) => l.id}
              colonnes={[
                { cle: 'nom', titre: 'Livreur', fixe: true, tri: (l) => l.fullName, rendu: (l) => <span className="font-bold text-slate-900">{l.fullName}</span> },
                { cle: 'telephone', titre: 'Téléphone', rendu: (l) => (l.phone ? <a href={`tel:${l.phone}`} className="tabular-nums text-suguba-profond hover:underline">{l.phone}</a> : '—') },
                { cle: 'vehicule', titre: 'Véhicule', tri: (l) => l.vehicleType || '', rendu: (l) => l.vehicleType || 'Non renseigné' },
              ]} />
          )}
      </section>
    </PageReseau>
  );
}
