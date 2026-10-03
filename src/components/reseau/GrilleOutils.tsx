import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { sansPrechargement } from '@/lib/reseau/porte-boutique';

export interface Outil { href: string; titre: string; aide: string; icone: React.ElementType }
export interface GroupeOutils { titre: string; outils: Outil[] }

/**
 * Page « Outils » des espaces revendeur et fournisseur (REV-12, lot 7 de l'audit
 * UI/UX du 2026-10-02).
 *
 * Les deux pages étaient une seule ligne de balises, sans la coquille commune,
 * avec des intitulés qui ne correspondaient pas au titre de la page ouverte
 * (« Ma carte » ouvrait « Votre carte professionnelle », « Résultats des
 * partages » ouvrait « Mes partages ») et des outils manquants. Ici : chaque
 * entrée porte le titre exact de sa page, rangée par usage.
 */
export default function GrilleOutils({ groupes }: { groupes: GroupeOutils[] }) {
  return (
    <div className="space-y-6">
      {groupes.map((g) => (
        <section key={g.titre} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">{g.titre}</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {g.outils.map(({ href, titre, aide, icone: Icone }) => (
              <li key={href}>
                <Link href={href} prefetch={sansPrechargement(href) ? false : undefined} className="flex items-center gap-3 min-h-16 rounded-2xl border border-slate-200 bg-white p-4 hover:border-suguba-profond transition-colors">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-suguba-menthe text-suguba-profond flex items-center justify-center">
                    <Icone className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{titre}</span>
                    <span className="block text-sm text-slate-600">{aide}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
