import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * État vide commun (2026-09-12) — inspiré d'Etsy (« Your cart is empty » +
 * illustration + « See trending items ») : la plupart des écrans de SUGUBA se
 * contentaient d'une phrase grise sans repère visuel ni action ("Aucune
 * commande trouvée pour ce filtre.", "Aucun produit en attente de
 * modération."). Une icône donne un repère immédiat, et un CTA optionnel
 * transforme une impasse en prochaine étape.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-black text-slate-700">{title}</p>
        {description && <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center justify-center h-10 px-5 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
