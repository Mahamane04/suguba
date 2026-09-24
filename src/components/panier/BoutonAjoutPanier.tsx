'use client';

import React, { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ajouterAuPanier } from '@/lib/panier';
import { useToast } from '@/components/ui/Toast';

/**
 * « Ajouter au panier » — action SECONDAIRE de la fiche produit (bouton
 * neutre) : « Commander » reste l'action principale, en vert. Après ajout, le
 * bouton propose d'aller au panier plutôt que d'y envoyer d'office : le
 * client qui remplit son panier veut continuer ses achats.
 */
export default function BoutonAjoutPanier({ productId, quantite }: { productId: string; quantite: number }) {
  const { toast } = useToast();
  const [ajoute, setAjoute] = useState(false);

  if (ajoute) {
    return (
      <Button href="/panier" variant="ghost" fullWidth>
        <Check className="w-4 h-4 text-suguba-brand-dark" />
        Dans le panier — voir mon panier
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      fullWidth
      onClick={() => {
        if (ajouterAuPanier(productId, quantite) === 'plein') {
          toast('Votre panier contient déjà 20 articles différents.', { ton: 'info' });
          return;
        }
        setAjoute(true);
      }}
    >
      <ShoppingBag className="w-4 h-4" />
      Ajouter au panier
    </Button>
  );
}
