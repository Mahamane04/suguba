'use client';

import { Suspense } from 'react';
import PageQuestions from '@/components/messagerie/PageQuestions';

/** Questions du revendeur aux fournisseurs (Protection Suguba, lot 3). */
export default function QuestionsRevendeur() {
  return <Suspense><PageQuestions espace="reseller" /></Suspense>;
}
