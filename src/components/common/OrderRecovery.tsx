'use client';

import type { OrderAttempt } from '@/lib/order-submit';

export default function OrderRecovery({ attempt, onResume, disabled }: {
  attempt: OrderAttempt | null; onResume: () => void; disabled: boolean;
}) {
  if (!attempt) return null;
  return (
    <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900 space-y-2">
      <p>Une demande pour {attempt.input.customerName} est conservée dans cet onglet.
        Reprenez-la pour retrouver sa confirmation sans créer de doublon.</p>
      <button type="button" disabled={disabled} onClick={onResume}
        className="min-h-12 rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">
        {disabled ? 'Vérification…' : 'Reprendre ma commande'}
      </button>
    </div>
  );
}
