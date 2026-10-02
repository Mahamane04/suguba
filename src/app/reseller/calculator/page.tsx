'use client';

import React from 'react';
import PageReseau from '@/components/reseau/PageReseau';
import EarningsCalculator from '@/components/reseller/EarningsCalculator';

export default function ResellerCalculatorPage() {
  return (
    // REV-14 (lot 6 de l'audit UI/UX du 2026-10-02) : coquille commune des espaces.
    <PageReseau titre="Combien pouvez-vous gagner ?"
      sousTitre="Réglez votre rythme de vente : vos gains estimés, versés par Orange Money ou Moov Money."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}>
        {/* The Interactive Calculator Component */}
        <EarningsCalculator showCta={true} />
    </PageReseau>
  );
}
