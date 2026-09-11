'use client';

import { useEffect, useMemo, useState } from 'react';
import { sugubaStore } from './store';
import type { OrderInput } from './order-input';
import { OrderCheckout, type OrderAttempt } from './order-submit';

/** La restauration se fait après le montage, jamais pendant le rendu serveur. */
export function useOrderCheckout(formId: string) {
  const checkout = useMemo(() => new OrderCheckout(`suguba_order_attempt:${formId}`, {
    getItem: key => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: key => sessionStorage.removeItem(key),
  }, sugubaStore.createOrder), [formId]);
  const [recovery, setRecovery] = useState<OrderAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => { setRecovery(checkout.restore()); }, [checkout]);

  const submitOrder = async (value?: OrderInput) => {
    setIsSubmitting(true);
    try { return await checkout.submit(value); }
    finally { setRecovery(checkout.restore()); setIsSubmitting(false); }
  };
  const resetAttempt = () => { checkout.reset(); setRecovery(null); };
  return { submitOrder, isSubmitting, resetAttempt, recovery };
}
