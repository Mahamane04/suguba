import React from 'react';
import type { LucideIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import { EmptyState as EtatVide } from '@/components/ui/Surface';

/**
 * État vide commun (2026-09-12) — inspiré d'Etsy (« Your cart is empty » +
 * illustration + « See trending items ») : la plupart des écrans de SUGUBA se
 * contentaient d'une phrase grise sans repère visuel ni action ("Aucune
 * commande trouvée pour ce filtre.", "Aucun produit en attente de
 * modération."). Une icône donne un repère immédiat, et un CTA optionnel
 * transforme une impasse en prochaine étape.
 *
 * Lot 3 de l'audit UI/UX du 2026-10-02 (ADM-09) : deux composants « écran vide »
 * coexistaient, avec deux rendus (celui-ci avait un bouton noir hors charte).
 * Ce fichier garde son API mais affiche désormais l'état vide de Surface.
 */
export default function EmptyState({
  icon,
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
    <EtatVide
      icone={icon}
      titre={title}
      texte={description}
      action={action ? <Button href={action.href}>{action.label}</Button> : undefined}
    />
  );
}
