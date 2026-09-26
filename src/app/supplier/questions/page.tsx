'use client';

import { Suspense } from 'react';
import PageQuestions from '@/components/messagerie/PageQuestions';

/** Questions des revendeurs sur les offres du fournisseur (Protection Suguba, lot 3). */
export default function QuestionsFournisseur() {
  return <Suspense><PageQuestions espace="supplier" /></Suspense>;
}
