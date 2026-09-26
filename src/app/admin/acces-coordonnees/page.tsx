'use client';

import React, { useEffect, useState } from 'react';
import { Contact } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';

interface Personne {
  id: string; nom: string; role: 'driver' | 'supplier';
  courses: number; remises: number; devis: number; devisSansReponse: number;
}

/**
 * Accès aux coordonnées (2026-09-26, Protection Suguba lot 2) : qui a reçu
 * les coordonnées de quels dossiers sur 30 jours. Chaque intervenant ne les
 * reçoit que pour un dossier et une étape où il en a besoin.
 */
export default function AccesCoordonneesPage() {
  const [personnes, setPersonnes] = useState<Personne[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);

  useEffect(() => {
    fetch('/api/admin/acces-coordonnees', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setPersonnes(j.personnes || []); setMigration(Boolean(j.migrationRequise)); })
      .catch((e) => setErreur((e as Error).message));
  }, []);

  return (
    <PageReseau titre="Accès aux coordonnées" sousTitre="Qui a reçu les coordonnées de quels dossiers, sur 30 jours."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}>
      {erreur ? <EmptyState icone={Contact} titre="Journal indisponible" texte={erreur} />
        : !personnes ? <Skeleton className="h-48" />
        : migration ? <EmptyState icone={Contact} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-26-acces-coordonnees.sql dans Supabase, puis rechargez la page." />
        : personnes.length === 0 ? <EmptyState icone={Contact} titre="Aucun accès pour l’instant" texte="Les coordonnées remises aux livreurs et aux fournisseurs apparaîtront ici." />
        : (
          <>
            <Card className="text-xs text-slate-600 space-y-1">
              <p>Un livreur reçoit le téléphone du client et le point de retrait seulement pendant une course en cours.</p>
              <p>Un fournisseur reçoit le téléphone du client pour une remise qu’il a prise en charge, ou pour une demande de devis à laquelle il n’a pas encore répondu.</p>
              <p className="font-semibold text-slate-800">Beaucoup de devis consultés sans réponse peuvent signaler des contacts récupérés hors Suguba.</p>
            </Card>
            <Card>
              <ul className="divide-y divide-slate-100">
                {personnes.map((p) => (
                  <li key={p.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 truncate">{p.nom}</span>
                      <StatusPill ton="neutre">{p.role === 'driver' ? 'Livreur' : 'Fournisseur'}</StatusPill>
                    </div>
                    <p className="text-xs text-slate-600">
                      {p.role === 'driver'
                        ? `${p.courses} course${p.courses > 1 ? 's' : ''}`
                        : `${p.remises} remise${p.remises > 1 ? 's' : ''} · ${p.devis} devis consulté${p.devis > 1 ? 's' : ''}`}
                    </p>
                    {p.devisSansReponse > 0 && (
                      <StatusPill ton="attente">{p.devisSansReponse} devis consulté{p.devisSansReponse > 1 ? 's' : ''} sans réponse</StatusPill>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
    </PageReseau>
  );
}
